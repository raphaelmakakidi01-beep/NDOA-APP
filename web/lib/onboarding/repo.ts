"use client";

import { del, get, set } from "idb-keyval";
import { getSupabase } from "@/lib/supabase/client";
import { uploadWithProgress } from "@/lib/media";
import { toE164 } from "@/lib/validation";
import { uid } from "@/lib/utils";
import { emptyDraft, type Draft, type MediaRef, type StepKey } from "./types";

/* =========================================================
   Persistance de l’onboarding
   - Mode démo : brouillon dans localStorage, images dans IndexedDB.
   - Supabase : le brouillon local sert de cache ; chaque étape validée
     est écrite dans la base (tables vendors, vendor_categories, media,
     packages) et les images dans le bucket vendor-media.
   ========================================================= */

const draftKey = (userId: string) => `eclat.onboarding.${userId}`;
type Result = { ok: true; draft: Draft } | { ok: false; error: string };

function toStorable(d: Draft): Draft {
  // les URL blob ne survivent pas à un rechargement : on les régénère depuis IndexedDB
  const strip = (m?: MediaRef) => (m && m.source === "local" ? { ...m, url: "" } : m);
  return { ...d, avatar: strip(d.avatar), cover: strip(d.cover), photos: d.photos.filter((p) => p.status !== "uploading").map((p) => strip(p)!) };
}

async function hydrate(m?: MediaRef): Promise<MediaRef | undefined> {
  if (!m || m.source !== "local") return m;
  const blob = await get<Blob>(`eclat-media:${m.id}`);
  return blob ? { ...m, url: URL.createObjectURL(blob) } : { ...m, status: "error", error: "Image introuvable, ajoutez-la à nouveau." };
}

export async function loadDraft(userId: string): Promise<Draft> {
  let d = emptyDraft();
  try {
    const raw = localStorage.getItem(draftKey(userId));
    if (raw) d = { ...d, ...(JSON.parse(raw) as Draft) };
  } catch { /* brouillon illisible : on repart de zéro */ }
  return {
    ...d,
    avatar: await hydrate(d.avatar),
    cover: await hydrate(d.cover),
    photos: (await Promise.all(d.photos.map(hydrate))).filter(Boolean) as MediaRef[],
  };
}

export function cacheDraft(userId: string, d: Draft) {
  try { localStorage.setItem(draftKey(userId), JSON.stringify(toStorable(d))); } catch { /* quota plein */ }
}

/** Stocke une image traitée et renvoie sa référence (démo : IndexedDB ; Supabase : bucket) */
export async function storeImage(
  ctx: { vendorId?: string },
  file: { blob: Blob; width: number; height: number; name: string },
  onProgress: (p: number) => void,
  kind: "avatar" | "cover" | "photo",
): Promise<MediaRef> {
  const id = uid();
  const sb = getSupabase();
  if (!sb || !ctx.vendorId) {
    // Mode démo (ou prestataire pas encore créé) : stockage local + progression simulée
    await set(`eclat-media:${id}`, file.blob);
    for (let p = 15; p <= 100; p += 17) { onProgress(Math.min(p, 100)); await new Promise((r) => setTimeout(r, 90)); }
    return { id, url: URL.createObjectURL(file.blob), source: "local", name: file.name, size: file.blob.size, width: file.width, height: file.height, status: "ready", progress: 100 };
  }
  const path = `${ctx.vendorId}/${kind}-${id}.webp`;
  const { data: signed, error: signErr } = await sb.storage.from("vendor-media").createSignedUploadUrl(path);
  if (signErr || !signed) throw new Error("Envoi refusé par le serveur.");
  await uploadWithProgress(signed.signedUrl, file.blob, onProgress);
  if (kind === "photo" || kind === "cover") {
    const { error } = await sb.from("media").insert({
      id, vendor_id: ctx.vendorId, kind: "photo", storage_path: path, mime_type: "image/webp",
      size_bytes: file.blob.size, width: file.width, height: file.height, status: "ready",
    });
    if (error) {
      await sb.storage.from("vendor-media").remove([path]);
      throw new Error(error.message.includes("QUOTA") ? "Limite de photos de votre offre atteinte." : "La photo n’a pas pu être enregistrée.");
    }
  }
  const url = sb.storage.from("vendor-media").getPublicUrl(path).data.publicUrl;
  return { id, url, source: "remote", name: file.name, size: file.blob.size, width: file.width, height: file.height, status: "ready", progress: 100 };
}

export async function forgetImage(m: MediaRef) {
  if (m.source === "local") await del(`eclat-media:${m.id}`);
  const sb = getSupabase();
  if (sb && m.source === "remote" && !m.url.includes("images.unsplash.com")) await sb.from("media").delete().eq("id", m.id);
}

/** Écrit une étape validée dans la base (no-op en mode démo) */
export async function persistStep(userId: string, step: StepKey, d: Draft): Promise<Result> {
  const sb = getSupabase();
  if (!sb) { await new Promise((r) => setTimeout(r, 350)); return { ok: true, draft: d }; }
  try {
    let vendorId = d.vendorId;
    if (step === "entreprise") {
      const row = {
        name: d.name.trim(), slug: d.slug, tagline: d.tagline || null, bio: d.bio || null, city: d.city,
        zones: d.zones, languages: d.languages, onboarding_step: 3,
      };
      if (!vendorId) {
        const { data, error } = await sb.from("vendors").insert({ ...row, owner_id: userId }).select("id").single();
        if (error) return { ok: false, error: error.code === "23505" ? "Cette adresse de page est déjà prise : choisissez-en une autre." : "Enregistrement impossible. Réessayez." };
        vendorId = data.id as string;
      } else {
        const { error } = await sb.from("vendors").update(row).eq("id", vendorId);
        if (error) return { ok: false, error: error.code === "23505" ? "Cette adresse de page est déjà prise." : "Enregistrement impossible. Réessayez." };
      }
      const { data: cats } = await sb.from("categories").select("id, slug").in("slug", d.categories);
      await sb.from("vendor_categories").delete().eq("vendor_id", vendorId);
      if (cats?.length)
        await sb.from("vendor_categories").insert(cats.map((c) => ({ vendor_id: vendorId, category_id: c.id, is_primary: c.slug === (d.primaryCategory ?? d.categories[0]) })));
      // la photo de profil a pu être choisie avant la création du prestataire : on l’envoie maintenant
      if (d.avatar?.source === "local") {
        const blob = await get<Blob>(`eclat-media:${d.avatar.id}`);
        if (blob) {
          const path = `${vendorId}/avatar-${d.avatar.id}.webp`;
          const up = await sb.storage.from("vendor-media").upload(path, blob, { contentType: "image/webp", upsert: true });
          if (!up.error) {
            await sb.from("vendors").update({ avatar_path: path }).eq("id", vendorId);
            await del(`eclat-media:${d.avatar.id}`);
            d = { ...d, avatar: { ...d.avatar, source: "remote", url: sb.storage.from("vendor-media").getPublicUrl(path).data.publicUrl } };
          }
        }
      }
    }
    if (!vendorId) return { ok: true, draft: d };
    if (step === "photos" && d.cover) {
      await sb.from("vendors").update({ cover_media_id: d.cover.id, onboarding_step: 4 }).eq("id", vendorId);
      await Promise.all(d.photos.map((p, i) => sb.from("media").update({ sort: i, is_featured: i < 6 }).eq("id", p.id)));
    }
    if (step === "tarif") {
      const amount = Number(d.pkg.amount) * (d.pkg.currency === "USD" ? 100 : 1);
      const { data: existing } = await sb.from("packages").select("id").eq("vendor_id", vendorId).order("sort").limit(1);
      const row = {
        vendor_id: vendorId, name: d.pkg.name.trim(), description: d.pkg.description || null, price_mode: d.pkg.priceMode,
        price_amount: amount, currency: d.pkg.currency, duration_label: d.pkg.duration || null,
        includes: d.pkg.includes, excludes: d.pkg.excludes, is_visible: true,
      };
      const { error } = existing?.length
        ? await sb.from("packages").update(row).eq("id", existing[0].id)
        : await sb.from("packages").insert(row);
      if (error) return { ok: false, error: "Le forfait n’a pas pu être enregistré." };
      await sb.from("vendors").update({ onboarding_step: 5 }).eq("id", vendorId);
    }
    if (step === "contacts") {
      const c = d.contacts;
      const phone = toE164(c.country, c.phone);
      const { error } = await sb.from("vendors").update({
        phone, whatsapp: c.whatsappSame ? phone : toE164(c.country, c.whatsapp), email: c.email || null,
        socials: Object.fromEntries(Object.entries({ instagram: c.instagram, tiktok: c.tiktok, facebook: c.facebook, youtube: c.youtube, site: c.website }).filter(([, v]) => v)),
        onboarding_step: 6,
      }).eq("id", vendorId);
      if (error) return { ok: false, error: "Les contacts n’ont pas pu être enregistrés." };
    }
    return { ok: true, draft: { ...d, vendorId } };
  } catch {
    return { ok: false, error: "Connexion perdue. Vos saisies sont conservées : réessayez." };
  }
}

const PUBLISH_ERRORS: Record<string, string> = {
  PUBLISH_NEEDS_6_PHOTOS: "Il faut au moins 6 photos publiées.",
  PUBLISH_NEEDS_PACKAGE: "Il faut au moins un forfait visible.",
  PUBLISH_NEEDS_CONTACT: "Il faut un numéro de téléphone ou WhatsApp.",
  PUBLISH_NEEDS_CATEGORY: "Choisissez au moins une activité.",
};

export async function publish(d: Draft): Promise<Result> {
  const sb = getSupabase();
  if (!sb || !d.vendorId) {
    await new Promise((r) => setTimeout(r, 900));
    return { ok: true, draft: { ...d, publishedAt: new Date().toISOString() } };
  }
  const { error } = await sb.from("vendors").update({ status: "published", onboarding_step: 7 }).eq("id", d.vendorId);
  if (error) {
    const code = Object.keys(PUBLISH_ERRORS).find((k) => error.message.includes(k));
    return { ok: false, error: code ? PUBLISH_ERRORS[code] : "La publication a échoué. Réessayez." };
  }
  return { ok: true, draft: { ...d, publishedAt: new Date().toISOString() } };
}
