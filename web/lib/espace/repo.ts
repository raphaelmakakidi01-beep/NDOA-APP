"use client";

import { del, get, set } from "idb-keyval";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/client";
import { uploadWithProgress } from "@/lib/media";
import { toE164 } from "@/lib/validation";
import type { Draft } from "@/lib/onboarding/types";
import { seedEspace, seedStats, seedStep4, seedStep5 } from "./demo";
import type { Album, DayStat, EspaceData, MediaItem, Story } from "./types";
import { loadStep4, mapInquiryExtras } from "./remote-step4";
import { loadStep5 } from "./remote-step5";

/* =========================================================
   Persistance de l’espace prestataire
   - Démo : localStorage (métadonnées) + IndexedDB (fichiers).
   - Supabase : lecture des tables, écritures ciblées (RLS).
   ========================================================= */

const key = (userId: string) => `eclat.espace.${userId}`;
export const blobKey = (id: string, poster = false) => `eclat-media:${id}${poster ? ":poster" : ""}`;

export async function putBlob(id: string, blob: Blob, poster = false) { await set(blobKey(id, poster), blob); }

async function hydrate(m: MediaItem): Promise<MediaItem> {
  if (m.source !== "local") return m;
  const [file, poster] = await Promise.all([get<Blob>(blobKey(m.id)), get<Blob>(blobKey(m.id, true))]);
  if (!file) return { ...m, status: "error", error: "Fichier introuvable sur cet appareil." };
  return { ...m, url: URL.createObjectURL(file), posterUrl: poster ? URL.createObjectURL(poster) : m.posterUrl };
}

/** Charge (ou crée) les données de démonstration de l’espace */
export async function loadDemoEspace(userId: string, draft: Draft, empty: boolean): Promise<EspaceData> {
  if (empty) return seedEspace({ ...draft, photos: [] }, true);
  let data: EspaceData | null = null;
  try { const raw = localStorage.getItem(key(userId)); if (raw) data = JSON.parse(raw) as EspaceData; } catch { /* données illisibles */ }
  if (!data) data = seedEspace(draft);
  // données enregistrées avant l’étape 4 : on ajoute forfaits, messages, devis et dates
  if (!data.packages) data = { ...seedStep4(draft, data.inquiries), ...data };
  // … et avant l’étape 5 : avis, abonnement, équipe, préférences, 180 jours de statistiques
  if (!data.subscription) data = { ...seedStep5(data), ...data, stats: seedStats() };
  return { ...data, media: await Promise.all(data.media.map(hydrate)) };
}

export function cacheEspace(userId: string, d: EspaceData) {
  const strip = (m: MediaItem) => (m.source === "local" ? { ...m, url: "", posterUrl: undefined } : m);
  try {
    localStorage.setItem(key(userId), JSON.stringify({ ...d, media: d.media.filter((m) => m.status !== "uploading").map(strip) }));
  } catch { /* stockage plein */ }
}

export async function forgetBlob(id: string) { await Promise.all([del(blobKey(id)), del(blobKey(id, true))]); }

/* ---------------------------------------------------------
   Vidéos : contrôle, durée et vignette extraite dans le navigateur
   --------------------------------------------------------- */

export function probeVideo(file: File): Promise<{ duration: number; width: number; height: number; poster: Blob | null }> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata"; v.muted = true; v.playsInline = true;
    const url = URL.createObjectURL(file);
    v.src = url;
    v.onloadedmetadata = () => { v.currentTime = Math.min(1, (v.duration || 2) / 3); };
    v.onseeked = () => {
      const c = document.createElement("canvas");
      const scale = Math.min(1, 1280 / (v.videoWidth || 1280));
      c.width = Math.round((v.videoWidth || 1280) * scale); c.height = Math.round((v.videoHeight || 720) * scale);
      c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
      c.toBlob((poster) => { URL.revokeObjectURL(url); resolve({ duration: v.duration, width: v.videoWidth, height: v.videoHeight, poster }); }, "image/webp", 0.8);
    };
    v.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Vidéo illisible (format non pris en charge).")); };
  });
}

/* ---------------------------------------------------------
   Supabase — lecture et écritures (aucun effet en mode démo)
   Chemins : vendor-media/{vendor_id}/...
   --------------------------------------------------------- */
const publicUrl = (sb: SupabaseClient, path: string) => sb.storage.from("vendor-media").getPublicUrl(path).data.publicUrl;

export async function loadFromDb(userId: string, email?: string): Promise<{ draft: Partial<Draft>; data: EspaceData } | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data: v } = await sb.from("vendors")
    .select("*, vendor_categories(is_primary, categories(slug)), subscriptions(plan_id), packages(*)")
    .eq("owner_id", userId).limit(1).maybeSingle();
  if (!v) return null;
  const since = new Date(Date.now() - 180 * 86400_000).toISOString().slice(0, 10);
  const [media, albums, stories, stats, inquiries, reviews, notifs] = await Promise.all([
    sb.from("media").select("*").eq("vendor_id", v.id).order("sort"),
    sb.from("albums").select("*").eq("vendor_id", v.id).order("sort"),
    sb.from("stories").select("*, story_items(media_id, duration_ms, sort)").eq("vendor_id", v.id).order("sort"),
    sb.from("vendor_stats_daily").select("*").eq("vendor_id", v.id).gte("day", since).order("day"),
    sb.from("inquiries").select("*, packages(name)").eq("vendor_id", v.id).order("last_message_at", { ascending: false }).limit(30),
    sb.from("reviews").select("*").eq("vendor_id", v.id).order("created_at", { ascending: false }).limit(200),
    sb.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(30),
  ]);
  type Row = Record<string, unknown>;
  const s = (r: Row, k: string) => r[k] as string;
  const pkg = (v.packages as Row[] | null)?.[0];
  const cats = (v.vendor_categories as { is_primary: boolean; categories: { slug: string } }[] | null) ?? [];
  const draft: Partial<Draft> = {
    vendorId: v.id, name: v.name, slug: v.slug, tagline: v.tagline ?? "", bio: v.bio ?? "", city: v.city, zones: v.zones, languages: v.languages,
    categories: cats.map((c) => c.categories.slug), primaryCategory: cats.find((c) => c.is_primary)?.categories.slug,
    styleTags: v.style_tags, details: v.details ?? {}, publishedAt: v.published_at ?? undefined,
    avatar: v.avatar_path ? { id: "avatar", url: publicUrl(sb, v.avatar_path), source: "remote", name: "avatar", size: 0, status: "ready", progress: 100 } : undefined,
    contacts: {
      country: "+243", phone: (v.phone ?? "").replace(/^\+243/, ""), whatsappSame: v.phone === v.whatsapp, whatsapp: (v.whatsapp ?? "").replace(/^\+243/, ""),
      email: v.email ?? "", instagram: v.socials?.instagram ?? "", tiktok: v.socials?.tiktok ?? "", facebook: v.socials?.facebook ?? "", youtube: v.socials?.youtube ?? "", website: v.socials?.site ?? "",
    },
    ...(pkg ? { pkg: { name: s(pkg, "name"), priceMode: s(pkg, "price_mode") as "from", amount: String(Number(pkg.price_amount) / (pkg.currency === "USD" ? 100 : 1)), currency: s(pkg, "currency") as "USD", duration: s(pkg, "duration_label") ?? "", description: s(pkg, "description") ?? "", includes: pkg.includes as string[], excludes: pkg.excludes as string[] } } : {}),
  };
  const items: MediaItem[] = ((media.data ?? []) as Row[]).map((m) => ({
    id: s(m, "id"), kind: s(m, "kind") as "photo", url: publicUrl(sb, s(m, "storage_path")), posterUrl: m.poster_path ? publicUrl(sb, s(m, "poster_path")) : undefined,
    source: "remote", name: s(m, "storage_path").split("/").pop() ?? "", size: Number(m.size_bytes), width: m.width as number, height: m.height as number,
    duration: m.duration_s ? Number(m.duration_s) : undefined, albumId: (m.album_id as string) ?? undefined, featured: !!m.is_featured, alt: (m.alt as string) ?? "",
    status: m.status === "ready" ? "ready" : m.status === "failed" ? "error" : "processing", progress: 100, createdAt: s(m, "created_at"),
  }));
  const plan = ((v.subscriptions as { plan_id: string }[] | { plan_id: string } | null) && (Array.isArray(v.subscriptions) ? v.subscriptions[0]?.plan_id : (v.subscriptions as { plan_id: string }).plan_id)) ?? "free";
  return {
    draft,
    data: {
      plan: plan as EspaceData["plan"],
      media: items,
      albums: ((albums.data ?? []) as Row[]).map((a) => ({ id: s(a, "id"), title: s(a, "title"), kind: s(a, "kind") as "wedding", date: (a.wedding_date as string) ?? undefined, coverId: (a.cover_media_id as string) ?? undefined, createdAt: s(a, "created_at") })),
      stories: ((stories.data ?? []) as Row[]).map((st) => {
        const its = ((st.story_items as Row[]) ?? []).sort((x, y) => Number(x.sort) - Number(y.sort));
        return { id: s(st, "id"), title: s(st, "title"), mediaIds: its.map((i) => s(i, "media_id")), durationSec: Math.round(Number(its[0]?.duration_ms ?? 5000) / 1000), kind: st.expires_at ? "story" : "highlight", expiresAt: (st.expires_at as string) ?? undefined, archived: !!st.is_archived, createdAt: s(st, "created_at") };
      }),
      stats: ((stats.data ?? []) as Row[]).map((d) => ({ day: s(d, "day"), views: Number(d.views), whatsapp: Number(d.whatsapp_clicks), calls: Number(d.call_clicks), inquiries: Number(d.quote_requests), followers: Number(d.new_followers), photoViews: Number(d.photo_views ?? 0), sources: (d.sources as DayStat["sources"]) ?? {} })),
      inquiries: ((inquiries.data ?? []) as Row[]).map((q) => ({ id: s(q, "id"), couple: s(q, "couple_names"), weddingDate: s(q, "wedding_date"), city: s(q, "city"), guests: q.guests as number, packageName: (q.packages as { name: string } | null)?.name, status: s(q, "status") as "new", message: s(q, "message") ?? "", unread: Number(q.unread_vendor) > 0, createdAt: s(q, "created_at"), ...mapInquiryExtras(q) })),
      reviews: ((reviews.data ?? []) as Row[]).map((rv) => ({ id: s(rv, "id"), names: s(rv, "author_names"), photo: rv.photo_path ? publicUrl(sb, s(rv, "photo_path")) : "", rating: Number(rv.rating), text: s(rv, "body"), weddingDate: s(rv, "wedding_date"), reply: (rv.reply as string) ?? undefined, createdAt: s(rv, "created_at"), status: s(rv, "status") as "published", verified: !!rv.is_verified, city: (rv.city as string) ?? undefined, repliedAt: (rv.replied_at as string) ?? undefined, inquiryId: (rv.inquiry_id as string) ?? undefined })),
      notifications: ((notifs.data ?? []) as Row[]).map((n) => ({ id: s(n, "id"), type: s(n, "type") as "tip", title: s(n, "title"), body: (n.body as string) ?? undefined, link: s(n, "link") ?? "/espace", read: !!n.read_at, createdAt: s(n, "created_at") })),
      followers: Number(v.followers_count ?? 0),
      ...(await loadStep4(sb, v.id, ((inquiries.data ?? []) as Row[]).map((q) => s(q, "id")))),
      ...(await loadStep5(sb, v.id, userId, email)),
    },
  };
}

export const remote = {
  async upload(vendorId: string | undefined, id: string, kind: "photo" | "video", blob: Blob, onProgress: (p: number) => void, extra: { width?: number; height?: number; duration?: number; poster?: Blob | null; albumId?: string }) {
    const sb = getSupabase();
    if (!sb || !vendorId) return null;
    const ext = kind === "photo" ? "webp" : "mp4";
    const path = `${vendorId}/${kind}-${id}.${ext}`;
    const { data: signed, error } = await sb.storage.from("vendor-media").createSignedUploadUrl(path);
    if (error || !signed) throw new Error("Envoi refusé par le serveur.");
    await uploadWithProgress(signed.signedUrl, blob, onProgress);
    let posterPath: string | null = null;
    if (extra.poster) {
      posterPath = `${vendorId}/poster-${id}.webp`;
      await sb.storage.from("vendor-media").upload(posterPath, extra.poster, { contentType: "image/webp" });
    }
    const { error: insErr } = await sb.from("media").insert({
      id, vendor_id: vendorId, kind, storage_path: path, poster_path: posterPath, mime_type: blob.type, size_bytes: blob.size,
      width: extra.width, height: extra.height, duration_s: extra.duration, album_id: extra.albumId ?? null, status: "ready",
    });
    if (insErr) {
      await sb.storage.from("vendor-media").remove([path, ...(posterPath ? [posterPath] : [])]);
      throw new Error(/QUOTA_PHOTOS|QUOTA_VIDEOS/.test(insErr.message) ? "Limite de votre offre atteinte." : /QUOTA_STORAGE/.test(insErr.message) ? "Espace de stockage plein." : /FILE_TOO_LARGE/.test(insErr.message) ? "Fichier trop volumineux pour votre offre." : "Le fichier n’a pas pu être enregistré.");
    }
    return { url: publicUrl(sb, path), posterUrl: posterPath ? publicUrl(sb, posterPath) : undefined };
  },
  /** Remplace le fichier d’une photo (recadrage) au même chemin */
  async replacePhoto(vendorId: string | undefined, id: string, blob: Blob, width: number, height: number) {
    const sb = getSupabase();
    if (!sb || !vendorId) return null;
    const path = `${vendorId}/photo-${id}.webp`;
    const { error } = await sb.storage.from("vendor-media").upload(path, blob, { contentType: "image/webp", upsert: true });
    if (error) throw new Error("Le recadrage n’a pas pu être enregistré.");
    await sb.from("media").update({ storage_path: path, size_bytes: blob.size, width, height }).eq("id", id);
    return `${publicUrl(sb, path)}?v=${Date.now()}`;
  },
  async updateMedia(id: string, patch: Partial<MediaItem>) {
    const sb = getSupabase(); if (!sb) return;
    const row: Record<string, unknown> = {};
    if ("featured" in patch) row.is_featured = patch.featured;
    if ("alt" in patch) row.alt = patch.alt;
    if ("albumId" in patch) row.album_id = patch.albumId ?? null;
    if (Object.keys(row).length) await sb.from("media").update(row).eq("id", id);
  },
  async reorder(ids: string[]) {
    const sb = getSupabase(); if (!sb) return;
    await Promise.all(ids.map((id, i) => sb.from("media").update({ sort: i }).eq("id", id)));
  },
  async deleteMedia(m: MediaItem) {
    const sb = getSupabase(); if (!sb) return;
    const { data } = await sb.from("media").delete().eq("id", m.id).select("storage_path, poster_path").maybeSingle();
    if (data) await sb.storage.from("vendor-media").remove([data.storage_path, data.poster_path].filter(Boolean) as string[]);
  },
  async upsertAlbum(vendorId: string | undefined, a: Album) {
    const sb = getSupabase(); if (!sb || !vendorId) return;
    await sb.from("albums").upsert({ id: a.id, vendor_id: vendorId, title: a.title, kind: a.kind, wedding_date: a.date ?? null, cover_media_id: a.coverId ?? null });
  },
  async deleteAlbum(id: string) { const sb = getSupabase(); if (sb) await sb.from("albums").delete().eq("id", id); },
  async upsertStory(vendorId: string | undefined, st: Story) {
    const sb = getSupabase(); if (!sb || !vendorId) return;
    await sb.from("stories").upsert({ id: st.id, vendor_id: vendorId, title: st.title, cover_media_id: st.mediaIds[0] ?? null, expires_at: st.expiresAt ?? null, is_archived: st.archived });
    await sb.from("story_items").delete().eq("story_id", st.id);
    await sb.from("story_items").insert(st.mediaIds.map((m, i) => ({ story_id: st.id, media_id: m, duration_ms: st.durationSec * 1000, sort: i })));
  },
  async deleteStory(id: string) { const sb = getSupabase(); if (sb) await sb.from("stories").delete().eq("id", id); },
  async saveVitrine(d: Draft) {
    const sb = getSupabase(); if (!sb || !d.vendorId) return { ok: true as const };
    const c = d.contacts, phone = toE164(c.country, c.phone);
    const { error } = await sb.from("vendors").update({
      name: d.name.trim(), tagline: d.tagline || null, bio: d.bio || null, city: d.city, zones: d.zones, languages: d.languages,
      style_tags: d.styleTags ?? [], details: d.details ?? {}, phone, whatsapp: c.whatsappSame ? phone : toE164(c.country, c.whatsapp), email: c.email || null,
      socials: Object.fromEntries(Object.entries({ instagram: c.instagram, tiktok: c.tiktok, facebook: c.facebook, youtube: c.youtube, site: c.website }).filter(([, x]) => x)),
      cover_media_id: d.cover?.source === "remote" ? d.cover.id : undefined,
      // photo de profil envoyée depuis l’espace : même convention de chemin que lib/onboarding/repo.ts
      avatar_path: d.avatar?.source === "remote" && d.avatar.id !== "avatar" ? `${d.vendorId}/avatar-${d.avatar.id}.webp` : undefined,
    }).eq("id", d.vendorId);
    return error ? { ok: false as const, error: "Enregistrement impossible. Réessayez." } : { ok: true as const };
  },
  async markNotificationsRead(ids: string[]) {
    const sb = getSupabase(); if (!sb || !ids.length) return;
    await sb.from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids);
  },
};
