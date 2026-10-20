"use client";

/*
 * Modération, mise en avant de l'accueil, catégories et villes.
 * Écritures directes autorisées par la RLS (admin) ou via admin_* ; toutes journalisées en base.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEMO } from "@/lib/config";
import { compressPhoto } from "@/lib/media";
import { CATEGORIES, CITIES, U } from "@/lib/onboarding/catalog";
import { getSupabase } from "@/lib/supabase/client";
import { uid } from "@/lib/utils";
import { adminError } from "./api";
import { demo, demoLog } from "./demo";
import type {
  AdminCategory, AdminCity, FeaturedStory, HiddenMedia, HomePick, MediaOption, PendingReview, ReportGroup, ReportTarget, Slide, StoryOption, VendorRef,
} from "./content-types";

type Row = Record<string, unknown>;
const wait = (ms = 300) => new Promise((r) => setTimeout(r, ms));
/** Relation PostgREST : objet ou tableau d'un élément selon la jointure */
const one = (x: unknown): Row | undefined => ((Array.isArray(x) ? x[0] : x) as Row | null | undefined) ?? undefined;
function sb(): SupabaseClient {
  const c = getSupabase();
  if (!c) throw new Error("Supabase indisponible");
  return c;
}
const pub = (c: SupabaseClient, bucket: string, path?: string | null) =>
  !path ? undefined : /^https?:/.test(path) ? path : c.storage.from(bucket).getPublicUrl(path).data.publicUrl;
const media = (c: SupabaseClient, path?: string | null) => pub(c, "vendor-media", path);
const check = (r: { error: { message: string } | null }) => { if (r.error) throw new Error(adminError(r.error.message)); };

const vendorRef = (c: SupabaseClient, v?: Row | null): VendorRef => {
  const cats = (v?.vendor_categories as Row[] | undefined) ?? [];
  const cat = one((cats.find((x) => x.is_primary) ?? cats[0])?.categories as Row | Row[] | undefined);
  return { id: String(v?.id ?? ""), name: String(v?.name ?? "Vitrine supprimée"), slug: String(v?.slug ?? ""), city: (v?.city as string) ?? undefined,
    category: (cat?.name as string) ?? undefined, avatarUrl: media(c, v?.avatar_path as string | null) };
};
const VENDOR_REF = "id, name, slug, city, avatar_path, vendor_categories(is_primary, categories(name))";

/* ================================================================== */
/* Démo : données en mémoire (réinitialisées au rechargement)          */
/* ================================================================== */
const dRef = (i: number): VendorRef => { const v = demo.vendors[i]; return { id: v.id, name: v.name, slug: v.slug, city: v.city, category: v.category?.name, avatarUrl: v.avatarUrl, coverUrl: v.coverUrl }; };
const ago = (h: number) => new Date(Date.now() - h * 3600000).toISOString();
const dm = {
  reports: [
    { key: "media:m-0-2", targetType: "media" as const, targetId: "m-0-2", vendor: dRef(0), count: 3, reasons: ["droits_auteur", "inapproprie"], details: ["Cette photo vient du compte Instagram d’un autre photographe."], firstAt: ago(30), lastAt: ago(2), preview: { url: demo.vendors[0].media[2]?.url, kind: "photo" as const } },
    { key: "review:r-1", targetType: "review" as const, targetId: "r-1", vendor: dRef(3), count: 2, reasons: ["faux_avis"], details: ["Le prestataire a écrit cet avis lui-même."], firstAt: ago(50), lastAt: ago(8), preview: { text: "Service exceptionnel, je recommande à 1000 % ! Meilleure salle de Kinshasa, tous les autres sont nuls.", rating: 5, author: "Client satisfait" } },
    { key: "media:m-7-1", targetType: "media" as const, targetId: "m-7-1", vendor: dRef(7), count: 1, reasons: ["hors_sujet"], details: [], firstAt: ago(20), lastAt: ago(20), preview: { url: demo.vendors[7].media[1]?.url, kind: "photo" as const } },
    { key: "vendor:demo-17", targetType: "vendor" as const, targetId: "demo-17", vendor: dRef(16), count: 4, reasons: ["arnaque", "informations_fausses"], details: ["Acompte encaissé puis plus de nouvelles.", "Adresse inexistante."], firstAt: ago(120), lastAt: ago(5), preview: { title: "Salle Les Palmiers" } },
    { key: "review:r-2", targetType: "review" as const, targetId: "r-2", vendor: dRef(6), count: 1, reasons: ["spam"], details: [], firstAt: ago(4), lastAt: ago(4), preview: { text: "Visitez www.promo-mariage-pas-cher.cd pour -50 % !!!", rating: 1, author: "Promo" } },
  ] as ReportGroup[],
  pendingReviews: [
    { id: "pr-1", vendor: dRef(1), author: "Grâce & Patrick", rating: 5, body: "Kasa Films a filmé notre mariage coutumier et religieux : un film magnifique, livré en 3 semaines. Merci pour votre écoute !", city: "Kinshasa", createdAt: ago(6), verified: true },
    { id: "pr-2", vendor: dRef(4), author: "Divine & Jonathan", rating: 4, body: "Très belle décoration, quelques retards à l’installation mais un résultat superbe le jour J.", city: "Goma", createdAt: ago(26), verified: false },
    { id: "pr-3", vendor: dRef(6), author: "Mireille & Hervé", rating: 5, body: "Le buffet était délicieux et le service impeccable du début à la fin.", city: "Lubumbashi", createdAt: ago(40), verified: true },
    { id: "pr-4", vendor: dRef(9), author: "Prisca", rating: 2, body: "Voiture arrivée avec 45 minutes de retard, pas d’excuses du chauffeur.", city: "Kinshasa", createdAt: ago(55), verified: false },
  ] as PendingReview[],
  hidden: [{ id: "m-16-0", url: demo.vendors[16].media[0]?.url ?? "", kind: "photo" as const, vendor: dRef(16), reason: "inapproprie", moderatedAt: ago(70) }] as HiddenMedia[],
  slides: [
    { id: "s1", vendor: dRef(0), mediaId: "m-0-0", imageUrl: demo.vendors[0].media[0].url, mediaKind: "photo" as const, title: "L’art de raconter votre jour J", subtitle: "Studio Lumière Mbala · Kinshasa", isActive: true, sort: 1 },
    { id: "s2", vendor: dRef(3), imageUrl: U("1519225421980-715cb0215aed", 1400), title: "Le Fleuve d’Or", subtitle: "La salle de réception au bord du fleuve", startsAt: ago(-72), isActive: true, sort: 2 },
    { id: "s3", vendor: dRef(6), mediaId: "m-6-1", imageUrl: demo.vendors[6].media[1].url, mediaKind: "photo" as const, title: "Saveurs de Mama Tshala", subtitle: "Traiteur à Lubumbashi", endsAt: ago(48), isActive: true, sort: 3 },
  ] as Slide[],
  picks: [
    { id: "p0", section: "a_la_une" as const, vendor: dRef(8), sort: 0 },
    ...[0, 1, 2, 3].map((i) => ({ id: `p${i + 1}`, section: "recommandations" as const, vendor: dRef(i), sort: i + 1 })),
  ] as HomePick[],
  stories: [
    { storyId: "st-1", title: "Coulisses", coverUrl: demo.vendors[0].media[3].url, vendor: dRef(0), sort: 1 },
    { storyId: "st-2", title: "Mariage à Goma", coverUrl: demo.vendors[4].media[2].url, vendor: dRef(4), sort: 2 },
  ] as FeaturedStory[],
  categories: CATEGORIES.map((c, i) => ({ id: i + 1, slug: c.slug, name: c.name, namePlural: c.name.endsWith("s") ? c.name : `${c.name}s`, icon: ["camera", "video", "plane", "building", "sparkles", "flower", "utensils", "music", "brush", "car", "clipboard"][i], imageUrl: U(c.img, 600), isActive: true, sort: i + 1, vendors: demo.vendors.filter((v) => v.category?.slug === c.slug).length })) as AdminCategory[],
  cities: CITIES.map((name, i) => ({ id: i + 1, name, slug: name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-"), province: ["Kinshasa", "Haut-Katanga", "Nord-Kivu", "Kongo-Central", "Sud-Kivu", "Tshopo", "Kasaï-Oriental", "Lualaba", "Kongo-Central", "Kasaï-Central"][i], isActive: true, sort: i + 1, vendors: demo.vendors.filter((v) => v.city === name).length })) as AdminCity[],
};
const demoStoryOptions = (): StoryOption[] => demo.vendors.filter((v) => v.status === "published").slice(0, 8).map((v, i) => ({ id: `st-${i + 1}`, title: ["Coulisses", "Mariage à Goma", "Avant / après", "Nos tables", "Le cortège", "Préparatifs", "Première danse", "Dessert"][i], coverUrl: v.media[3]?.url, vendor: dRef(demo.vendors.indexOf(v)) }));

/* ================================================================== */
/* Modération                                                          */
/* ================================================================== */
export async function listReports(): Promise<ReportGroup[]> {
  if (DEMO) { await wait(); return structuredClone(dm.reports); }
  const c = sb();
  const r = await c.from("reports").select(`id, target_type, target_id, reason, details, created_at, vendor:vendors(${VENDOR_REF})`)
    .eq("status", "open").order("created_at", { ascending: false }).limit(500);
  check(r);
  const groups = new Map<string, ReportGroup>();
  for (const x of (r.data ?? []) as Row[]) {
    const key = `${x.target_type}:${x.target_id}`;
    const g = groups.get(key) ?? { key, targetType: x.target_type as ReportTarget, targetId: String(x.target_id), vendor: vendorRef(c, one(x.vendor as Row)), count: 0, reasons: [], details: [], firstAt: String(x.created_at), lastAt: String(x.created_at), preview: {} };
    g.count++;
    if (!g.reasons.includes(String(x.reason))) g.reasons.push(String(x.reason));
    if (x.details) g.details.push(String(x.details));
    g.firstAt = String(x.created_at);
    groups.set(key, g);
  }
  const list = [...groups.values()];
  const ids = (t: ReportTarget) => list.filter((g) => g.targetType === t).map((g) => g.targetId);
  const [m, rv, st] = await Promise.all([
    ids("media").length ? c.from("media").select("id, kind, storage_path, poster_path, is_hidden").in("id", ids("media")) : null,
    ids("review").length ? c.from("reviews").select("id, body, rating, author_names, status").in("id", ids("review")) : null,
    ids("story").length ? c.from("stories").select("id, title, is_archived, cover:media!stories_cover_media_id_fkey(storage_path)").in("id", ids("story")) : null,
  ]);
  for (const g of list) {
    if (g.targetType === "media") {
      const x = ((m?.data ?? []) as Row[]).find((y) => y.id === g.targetId);
      g.preview = x ? { url: media(c, (x.kind === "video" ? x.poster_path ?? x.storage_path : x.storage_path) as string), kind: x.kind as "photo", hidden: !!x.is_hidden } : { missing: true };
    } else if (g.targetType === "review") {
      const x = ((rv?.data ?? []) as Row[]).find((y) => y.id === g.targetId);
      g.preview = x ? { text: String(x.body), rating: Number(x.rating), author: String(x.author_names), hidden: x.status === "hidden" } : { missing: true };
    } else if (g.targetType === "story") {
      const x = ((st?.data ?? []) as Row[]).find((y) => y.id === g.targetId);
      g.preview = x ? { title: String(x.title), url: media(c, one(x.cover as Row)?.storage_path as string), hidden: !!x.is_archived } : { missing: true };
    } else g.preview = { title: g.vendor.name };
  }
  return list.sort((a, b) => b.count - a.count || b.lastAt.localeCompare(a.lastAt));
}

export async function listPendingReviews(): Promise<PendingReview[]> {
  if (DEMO) { await wait(); return structuredClone(dm.pendingReviews); }
  const c = sb();
  const r = await c.from("reviews").select(`id, author_names, rating, body, city, created_at, is_verified, vendor:vendors(${VENDOR_REF})`)
    .eq("status", "pending").order("created_at", { ascending: true }).limit(200);
  check(r);
  return ((r.data ?? []) as Row[]).map((x) => ({ id: String(x.id), vendor: vendorRef(c, one(x.vendor as Row)), author: String(x.author_names), rating: Number(x.rating), body: String(x.body), city: (x.city as string) ?? undefined, createdAt: String(x.created_at), verified: !!x.is_verified }));
}

export async function listHiddenMedia(): Promise<HiddenMedia[]> {
  if (DEMO) { await wait(); return structuredClone(dm.hidden); }
  const c = sb();
  const r = await c.from("media").select(`id, kind, storage_path, poster_path, hidden_reason, moderated_at, vendor:vendors(${VENDOR_REF})`)
    .eq("is_hidden", true).order("moderated_at", { ascending: false }).limit(200);
  check(r);
  return ((r.data ?? []) as Row[]).map((x) => ({ id: String(x.id), kind: x.kind as "photo", url: media(c, (x.kind === "video" ? x.poster_path ?? x.storage_path : x.storage_path) as string) ?? "", vendor: vendorRef(c, one(x.vendor as Row)), reason: (x.hidden_reason as string) ?? undefined, moderatedAt: (x.moderated_at as string) ?? undefined }));
}

/** Décision de modération (clôt aussi les signalements ouverts sur l'élément) */
export async function moderate(type: ReportTarget, id: string, action: "approve" | "hide" | "delete", reason?: string, note?: string) {
  if (DEMO) {
    await wait();
    if (type === "vendor" && action !== "approve") { const v = demo.vendors.find((x) => x.id === id); if (v) v.status = "suspended"; }
    dm.reports = dm.reports.filter((g) => !(g.targetType === type && g.targetId === id));
    dm.pendingReviews = dm.pendingReviews.filter((r) => r.id !== id);
    if (type === "media" && action === "approve") dm.hidden = dm.hidden.filter((m) => m.id !== id);
    if (type === "media" && action === "hide") { const v = demo.vendors.find((x) => x.media.some((m) => m.id === id)); const m = v?.media.find((y) => y.id === id); if (v && m) dm.hidden.unshift({ id, url: m.url, kind: "photo", vendor: { id: v.id, name: v.name, slug: v.slug }, reason, moderatedAt: new Date().toISOString() }); }
    demoLog(`${type}.${action}`, undefined, reason);
    return;
  }
  if (type === "media" && action === "delete") {
    // route serveur : décision en base (session du modérateur) puis retrait du fichier du stockage
    const res = await fetch(`/api/admin/media/${encodeURIComponent(id)}`, {
      method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason, note }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(adminError(body.error ?? "FAILED"));
    return;
  }
  check(await sb().rpc("admin_moderate", { p_target_type: type, p_target_id: id, p_action: action, p_reason: reason ?? null, p_note: note ?? null }));
}

/* ================================================================== */
/* Mise en avant de l'accueil                                          */
/* ================================================================== */
export async function getHome(): Promise<{ slides: Slide[]; picks: HomePick[]; stories: FeaturedStory[] }> {
  if (DEMO) { await wait(); return structuredClone({ slides: dm.slides, picks: dm.picks, stories: dm.stories }); }
  const c = sb();
  const [s, p, f] = await Promise.all([
    c.from("featured_slides").select(`*, vendor:vendors(${VENDOR_REF}), media:media(kind, storage_path, poster_path)`).order("sort"),
    c.from("home_picks").select(`*, vendor:vendors(${VENDOR_REF})`).order("sort"),
    c.from("featured_stories").select(`*, story:stories(id, title, vendor:vendors(${VENDOR_REF}), cover:media!stories_cover_media_id_fkey(storage_path))`).order("sort"),
  ]);
  check(s); check(p); check(f);
  return {
    slides: ((s.data ?? []) as Row[]).map((x) => {
      const m = one(x.media as Row);
      return { id: String(x.id), vendor: vendorRef(c, one(x.vendor as Row)), mediaId: (x.media_id as string) ?? undefined, imagePath: (x.image_path as string) ?? undefined,
        imageUrl: x.image_path ? pub(c, "site-media", x.image_path as string) : media(c, (m?.kind === "video" ? m?.poster_path ?? m?.storage_path : m?.storage_path) as string),
        mediaKind: (m?.kind as "photo") ?? undefined, title: (x.title as string) ?? "", subtitle: (x.subtitle as string) ?? "",
        startsAt: (x.starts_at as string) ?? undefined, endsAt: (x.ends_at as string) ?? undefined, isActive: !!x.is_active, sort: Number(x.sort) };
    }),
    picks: ((p.data ?? []) as Row[]).map((x) => ({ id: String(x.id), section: x.section as "recommandations", vendor: vendorRef(c, one(x.vendor as Row)), startsAt: (x.starts_at as string) ?? undefined, endsAt: (x.ends_at as string) ?? undefined, sort: Number(x.sort) })),
    stories: ((f.data ?? []) as Row[]).map((x) => {
      const st = one(x.story as Row);
      return { storyId: String(x.story_id), title: String(st?.title ?? ""), coverUrl: media(c, one(st?.cover as Row)?.storage_path as string), vendor: vendorRef(c, one(st?.vendor as Row)), startsAt: (x.starts_at as string) ?? undefined, endsAt: (x.ends_at as string) ?? undefined, sort: Number(x.sort) };
    }),
  };
}

/** Vitrines publiées (sélecteur) */
export async function searchVendors(q: string): Promise<VendorRef[]> {
  if (DEMO) {
    await wait(150);
    const s = q.trim().toLowerCase();
    return demo.vendors.filter((v) => v.status === "published" && (!s || `${v.name} ${v.city}`.toLowerCase().includes(s))).slice(0, 20).map((v) => dRef(demo.vendors.indexOf(v)));
  }
  const c = sb();
  const s = q.replace(/[%,()*\\.:]/g, " ").trim();
  let query = c.from("vendors").select(VENDOR_REF).eq("status", "published").order("name").limit(20);
  if (s) query = query.or(`name.ilike.%${s}%,city.ilike.%${s}%`);
  const r = await query;
  check(r);
  return ((r.data ?? []) as Row[]).map((v) => vendorRef(c, v));
}

export async function vendorMedia(vendorId: string): Promise<MediaOption[]> {
  if (DEMO) { await wait(150); return (demo.vendors.find((v) => v.id === vendorId)?.media ?? []).filter((m) => !m.isHidden).map((m) => ({ id: m.id, url: m.url, kind: m.kind })); }
  const c = sb();
  const r = await c.from("media").select("id, kind, storage_path, poster_path").eq("vendor_id", vendorId).eq("status", "ready").eq("is_hidden", false).order("sort").limit(60);
  check(r);
  return ((r.data ?? []) as Row[]).map((m) => ({ id: String(m.id), kind: m.kind as "photo", url: media(c, (m.kind === "video" ? m.poster_path ?? m.storage_path : m.storage_path) as string) ?? "" }));
}

/** Visuel dédié (bandeau d'accueil, image de catégorie) : compressé en WebP puis envoyé dans site-media */
export async function uploadSiteImage(file: File, folder: "hero" | "categories"): Promise<{ path: string; url: string }> {
  const { blob } = await compressPhoto(file, folder === "hero" ? 2400 : 1200);
  if (DEMO) { await wait(); return { path: `${folder}/${uid()}.webp`, url: URL.createObjectURL(blob) }; }
  const c = sb();
  const path = `${folder}/${uid()}.webp`;
  const r = await c.storage.from("site-media").upload(path, blob, { contentType: "image/webp", upsert: false });
  if (r.error) throw new Error("Envoi de l’image impossible.");
  return { path, url: pub(c, "site-media", path)! };
}

export type SlideInput = Omit<Slide, "id" | "sort" | "vendor"> & { id?: string; vendorId: string };
export async function saveSlide(s: SlideInput, vendor: VendorRef) {
  if (DEMO) {
    await wait();
    const existing = dm.slides.find((x) => x.id === s.id);
    const next: Slide = { ...s, id: s.id ?? uid(), vendor, sort: existing?.sort ?? dm.slides.length + 1 };
    dm.slides = existing ? dm.slides.map((x) => (x.id === s.id ? next : x)) : [...dm.slides, next];
    demoLog(existing ? "featured_slides.update" : "featured_slides.insert", vendor.id);
    return;
  }
  const row = { vendor_id: s.vendorId, media_id: s.mediaId ?? null, image_path: s.imagePath ?? null, title: s.title || null, subtitle: s.subtitle || null,
    starts_at: s.startsAt || null, ends_at: s.endsAt || null, is_active: s.isActive, updated_at: new Date().toISOString() };
  const c = sb();
  if (s.id) check(await c.from("featured_slides").update(row).eq("id", s.id));
  else {
    const { count } = await c.from("featured_slides").select("id", { count: "exact", head: true });
    check(await c.from("featured_slides").insert({ ...row, sort: (count ?? 0) + 1 }));
  }
}
export async function setSlideActive(id: string, active: boolean) {
  if (DEMO) { await wait(150); dm.slides = dm.slides.map((x) => (x.id === id ? { ...x, isActive: active } : x)); return; }
  check(await sb().from("featured_slides").update({ is_active: active }).eq("id", id));
}
export async function deleteSlide(id: string) {
  if (DEMO) { await wait(); dm.slides = dm.slides.filter((x) => x.id !== id); demoLog("featured_slides.delete", undefined); return; }
  check(await sb().from("featured_slides").delete().eq("id", id));
}

export async function addPick(section: "recommandations" | "a_la_une", vendor: VendorRef) {
  if (DEMO) {
    await wait();
    if (section === "a_la_une") dm.picks = dm.picks.filter((p) => p.section !== "a_la_une");
    if (dm.picks.some((p) => p.section === section && p.vendor.id === vendor.id)) return;
    dm.picks.push({ id: uid(), section, vendor, sort: dm.picks.filter((p) => p.section === section).length + 1 });
    demoLog(`home_picks.${section}`, vendor.id);
    return;
  }
  const c = sb();
  if (section === "a_la_une") check(await c.from("home_picks").delete().eq("section", "a_la_une"));
  const { count } = await c.from("home_picks").select("id", { count: "exact", head: true }).eq("section", section);
  const r = await c.from("home_picks").insert({ section, vendor_id: vendor.id, sort: (count ?? 0) + 1 });
  if (r.error && !/duplicate|unique/i.test(r.error.message)) throw new Error(adminError(r.error.message));
}
export async function removePick(id: string) {
  if (DEMO) { await wait(); dm.picks = dm.picks.filter((p) => p.id !== id); return; }
  check(await sb().from("home_picks").delete().eq("id", id));
}

export async function listStoryOptions(): Promise<StoryOption[]> {
  if (DEMO) { await wait(150); return demoStoryOptions(); }
  const c = sb();
  const r = await c.from("stories").select(`id, title, vendor:vendors!inner(${VENDOR_REF}, status), cover:media!stories_cover_media_id_fkey(storage_path)`)
    .eq("is_archived", false).eq("vendor.status", "published").order("created_at", { ascending: false }).limit(60);
  check(r);
  return ((r.data ?? []) as Row[]).map((x) => ({ id: String(x.id), title: String(x.title), coverUrl: media(c, one(x.cover as Row)?.storage_path as string), vendor: vendorRef(c, one(x.vendor as Row)) }));
}
export async function addFeaturedStory(s: StoryOption) {
  if (DEMO) { await wait(); if (!dm.stories.some((x) => x.storyId === s.id)) dm.stories.push({ storyId: s.id, title: s.title, coverUrl: s.coverUrl, vendor: s.vendor, sort: dm.stories.length + 1 }); return; }
  const c = sb();
  const { count } = await c.from("featured_stories").select("story_id", { count: "exact", head: true });
  const r = await c.from("featured_stories").insert({ story_id: s.id, sort: (count ?? 0) + 1 });
  if (r.error && !/duplicate|unique/i.test(r.error.message)) throw new Error(adminError(r.error.message));
}
export async function removeFeaturedStory(storyId: string) {
  if (DEMO) { await wait(); dm.stories = dm.stories.filter((x) => x.storyId !== storyId); return; }
  check(await sb().from("featured_stories").delete().eq("story_id", storyId));
}

/** Période de diffusion d'une recommandation ou d'une story mise en avant */
export async function setPeriod(kind: "home_picks" | "featured_stories", id: string, startsAt?: string, endsAt?: string) {
  if (endsAt && startsAt && endsAt <= startsAt) throw new Error("La date de fin doit suivre la date de début.");
  if (DEMO) {
    await wait(150);
    if (kind === "home_picks") dm.picks = dm.picks.map((p) => (p.id === id ? { ...p, startsAt, endsAt } : p));
    else dm.stories = dm.stories.map((s) => (s.storyId === id ? { ...s, startsAt, endsAt } : s));
    return;
  }
  check(await sb().from(kind).update({ starts_at: startsAt || null, ends_at: endsAt || null }).eq(kind === "home_picks" ? "id" : "story_id", id));
}

/** Nouvel ordre après glisser-déposer : un seul appel, journalisé */
export async function reorder(kind: "featured_slides" | "home_picks" | "featured_stories" | "categories" | "cities", ids: (string | number)[]) {
  if (DEMO) {
    await wait(120);
    const pos = (id: string | number) => ids.map(String).indexOf(String(id)) + 1;
    if (kind === "featured_slides") dm.slides = dm.slides.map((x) => ({ ...x, sort: pos(x.id) || x.sort })).sort((a, b) => a.sort - b.sort);
    if (kind === "home_picks") dm.picks = dm.picks.map((x) => ({ ...x, sort: pos(x.id) || x.sort })).sort((a, b) => a.sort - b.sort);
    if (kind === "featured_stories") dm.stories = dm.stories.map((x) => ({ ...x, sort: pos(x.storyId) || x.sort })).sort((a, b) => a.sort - b.sort);
    if (kind === "categories") dm.categories = dm.categories.map((x) => ({ ...x, sort: pos(x.id) || x.sort })).sort((a, b) => a.sort - b.sort);
    if (kind === "cities") dm.cities = dm.cities.map((x) => ({ ...x, sort: pos(x.id) || x.sort })).sort((a, b) => a.sort - b.sort);
    return;
  }
  check(await sb().rpc("admin_reorder", { p_kind: kind, p_ids: ids.map(String) }));
}

/* ================================================================== */
/* Catégories et villes                                                */
/* ================================================================== */
export async function listCategories(): Promise<AdminCategory[]> {
  if (DEMO) { await wait(); return structuredClone(dm.categories); }
  const c = sb();
  const r = await c.from("categories").select("id, slug, name, name_plural, icon, image_path, is_active, sort, vendor_categories(count)").order("sort");
  check(r);
  return ((r.data ?? []) as Row[]).map((x) => ({
    id: Number(x.id), slug: String(x.slug), name: String(x.name), namePlural: String(x.name_plural), icon: (x.icon as string) ?? "sparkles",
    imagePath: (x.image_path as string) ?? undefined, imageUrl: pub(c, "site-media", x.image_path as string), isActive: !!x.is_active, sort: Number(x.sort),
    vendors: Number(one(x.vendor_categories as Row)?.count ?? 0),
  }));
}

export type CategoryInput = Omit<AdminCategory, "id" | "sort" | "vendors" | "imageUrl"> & { id?: number; imageUrl?: string };
export async function saveCategory(cat: CategoryInput) {
  if (DEMO) {
    await wait();
    if (cat.id) dm.categories = dm.categories.map((x) => (x.id === cat.id ? { ...x, ...cat, id: x.id } : x));
    else dm.categories.push({ ...cat, id: Math.max(0, ...dm.categories.map((x) => x.id)) + 1, sort: dm.categories.length + 1, vendors: 0 } as AdminCategory);
    demoLog(cat.id ? "categories.update" : "categories.insert", undefined);
    return;
  }
  const c = sb();
  const row = { slug: cat.slug, name: cat.name, name_plural: cat.namePlural, icon: cat.icon, image_path: cat.imagePath ?? null, is_active: cat.isActive };
  if (cat.id) check(await c.from("categories").update(row).eq("id", cat.id));
  else {
    const { count } = await c.from("categories").select("id", { count: "exact", head: true });
    const r = await c.from("categories").insert({ ...row, sort: (count ?? 0) + 1 });
    if (r.error) throw new Error(/duplicate|unique/i.test(r.error.message) ? "Ce nom d’URL (slug) existe déjà." : adminError(r.error.message));
  }
}
export async function deleteCategory(id: number) {
  if (DEMO) {
    await wait();
    const cat = dm.categories.find((x) => x.id === id);
    if (cat?.vendors) throw new Error(`${cat.vendors} prestataire(s) utilisent cette catégorie : désactivez-la plutôt.`);
    dm.categories = dm.categories.filter((x) => x.id !== id);
    return;
  }
  const r = await sb().from("categories").delete().eq("id", id);
  if (r.error) throw new Error(/foreign key|violates/i.test(r.error.message) ? "Des prestataires utilisent cette catégorie : désactivez-la plutôt." : adminError(r.error.message));
}

export async function listCities(): Promise<AdminCity[]> {
  if (DEMO) { await wait(); return structuredClone(dm.cities); }
  const c = sb();
  const [r, v] = await Promise.all([c.from("cities").select("*").order("sort"), c.from("vendors").select("city").limit(10000)]);
  check(r);
  const counts = new Map<string, number>();
  for (const x of (v.data ?? []) as Row[]) counts.set(String(x.city), (counts.get(String(x.city)) ?? 0) + 1);
  return ((r.data ?? []) as Row[]).map((x) => ({ id: Number(x.id), name: String(x.name), slug: String(x.slug), province: (x.province as string) ?? "", isActive: !!x.is_active, sort: Number(x.sort), vendors: counts.get(String(x.name)) ?? 0 }));
}

export type CityInput = Omit<AdminCity, "id" | "sort" | "vendors"> & { id?: number };
export async function saveCity(city: CityInput) {
  if (DEMO) {
    await wait();
    if (city.id) dm.cities = dm.cities.map((x) => (x.id === city.id ? { ...x, ...city, id: x.id } : x));
    else dm.cities.push({ ...city, id: Math.max(0, ...dm.cities.map((x) => x.id)) + 1, sort: dm.cities.length + 1, vendors: 0 } as AdminCity);
    return;
  }
  const c = sb();
  const row = { name: city.name, slug: city.slug, province: city.province || null, is_active: city.isActive };
  if (city.id) check(await c.from("cities").update(row).eq("id", city.id));
  else {
    const { count } = await c.from("cities").select("id", { count: "exact", head: true });
    const r = await c.from("cities").insert({ ...row, sort: (count ?? 0) + 1 });
    if (r.error) throw new Error(/duplicate|unique/i.test(r.error.message) ? "Cette ville existe déjà." : adminError(r.error.message));
  }
}
export async function deleteCity(city: AdminCity) {
  if (city.vendors) throw new Error(`${city.vendors} prestataire(s) sont situés à ${city.name} : désactivez-la plutôt.`);
  if (DEMO) { await wait(); dm.cities = dm.cities.filter((x) => x.id !== city.id); return; }
  check(await sb().from("cities").delete().eq("id", city.id));
}
