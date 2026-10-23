import "server-only";
/*
 * Lecture des données publiques de la marketplace (serveur uniquement, clé publique, RLS).
 * Seules les vitrines publiées sont visibles : une vitrine n'est publiée qu'après validation par l'équipe NDOA.
 * Mises en cache quelques minutes ; mode démo (développement local) : données de lib/public/demo.ts.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";
import { DEMO, SUPABASE_ANON_KEY, SUPABASE_MISSING, SUPABASE_URL } from "@/lib/config";
import { CATEGORIES, U } from "@/lib/onboarding/catalog";
import { DEMO_CARDS, DEMO_HOME, DEMO_INSPIRATION, demoProfile } from "./demo";
import type { Card, Category, DirectoryQuery, Home, InspirationItem, Profile, Testimonial } from "./types";

type Row = Record<string, unknown>;
let client: SupabaseClient | null = null;
function sb(): SupabaseClient | null {
  if (SUPABASE_MISSING) return null;
  client ??= createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}
const file = (path: unknown, bucket = "vendor-media") =>
  typeof path === "string" && path ? `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}` : "";
const FALLBACK_IMAGE = "/brand/og-ndoa.jpg";
const one = (x: unknown): Row | undefined => ((Array.isArray(x) ? x[0] : x) as Row | null | undefined) ?? undefined;
const s = (x: unknown) => (typeof x === "string" ? x : "");
const n = (x: unknown) => Number(x) || 0;
const catLabel = (slug: string) => CATEGORIES.find((c) => c.slug === slug)?.name ?? "Prestataire";
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const longDate = (iso: string) => { const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
const monthYear = (iso: string) => { const d = new Date(iso); const m = MONTHS[d.getUTCMonth()]; return `${m[0].toUpperCase()}${m.slice(1)} ${d.getUTCFullYear()}`; };

/** Carte publique renvoyée par vendor_card() (voir migration 20261025000000_site_public.sql) */
function toCard(v: Row): Card {
  const cover = file(v.cover_path);
  const photos = ((v.photos as string[] | null) ?? []).map((p) => file(p)).filter(Boolean);
  const gallery = photos.length ? photos : [cover || FALLBACK_IMAGE];
  return {
    id: s(v.id), slug: s(v.slug), name: s(v.name), cat: s(v.category), catName: s(v.category_name) || catLabel(s(v.category)), city: s(v.city),
    tagline: s(v.tagline), rating: n(v.rating_avg), reviews: n(v.rating_count), followers: n(v.followers_count),
    price: v.price_from == null ? null : n(v.price_from), verified: !!v.is_verified, recommended: !!v.is_recommended,
    avatar: file(v.avatar_path) || cover || "/brand/ndoa-monogramme-ivoire.webp", cover: cover || gallery[0], gallery,
  };
}

/* ------------------------------------------------------------------ */
/* Annuaire                                                             */
/* ------------------------------------------------------------------ */
export async function getDirectory(): Promise<Card[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("prestataires");
  if (DEMO) return DEMO_CARDS;
  const c = sb();
  if (!c) return [];
  const { data, error } = await c.rpc("get_public_vendors", { p_limit: 1000 });
  if (error) { console.error("get_public_vendors", error.message); return []; }
  return ((data as Row[] | null) ?? []).map(toCard);
}

async function unavailableOn(day: string): Promise<string[]> {
  "use cache";
  cacheLife("minutes");
  if (DEMO) return [];
  const { data } = (await sb()?.rpc("get_unavailable_vendor_slugs", { p_day: day })) ?? {};
  return (data as string[] | null) ?? [];
}

export const BUDGETS = [
  { value: "0-500", label: "Moins de 500 $", min: 0, max: 500 },
  { value: "500-1500", label: "500 – 1 500 $", min: 500, max: 1500 },
  { value: "1500-5000", label: "1 500 – 5 000 $", min: 1500, max: 5000 },
  { value: "5000+", label: "Plus de 5 000 $", min: 5000, max: Infinity },
] as const;
export const SORTS = [
  { value: "pertinence", label: "Recommandés" },
  { value: "note", label: "Mieux notés" },
  { value: "prix-asc", label: "Prix croissant" },
  { value: "prix-desc", label: "Prix décroissant" },
] as const;
export const PAGE_SIZE = 12;

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Recherche, filtres, tri et pagination de l'annuaire */
export async function searchDirectory(q: DirectoryQuery) {
  const all = await getDirectory();
  const blocked = q.date && /^\d{4}-\d{2}-\d{2}$/.test(q.date) ? new Set(await unavailableOn(q.date)) : null;
  const budget = BUDGETS.find((b) => b.value === q.budget);
  const minRating = Number(q.note) || 0;
  const words = norm(q.q ?? "").split(/\s+/).filter(Boolean);
  let list = all.filter((v) =>
    (!q.categorie || v.cat === q.categorie) &&
    (!q.ville || v.city === q.ville) &&
    (!budget || (v.price != null && v.price >= budget.min && v.price < budget.max)) &&
    (!minRating || (v.reviews > 0 && v.rating >= minRating)) &&
    (!blocked || !blocked.has(v.slug)) &&
    (!words.length || words.every((w) => norm(`${v.name} ${v.catName} ${v.city} ${v.tagline}`).includes(w))));
  const price = (v: Card) => v.price ?? Infinity;
  if (q.tri === "note") list = [...list].sort((a, b) => b.rating - a.rating || b.reviews - a.reviews);
  else if (q.tri === "prix-asc") list = [...list].sort((a, b) => price(a) - price(b));
  else if (q.tri === "prix-desc") list = [...list].sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, q.page ?? 1), pages);
  return { total: list.length, page, pages, items: list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) };
}

/* ------------------------------------------------------------------ */
/* Catégories et villes (gérées dans l'admin)                          */
/* ------------------------------------------------------------------ */
export async function getHome(): Promise<Home> {
  "use cache";
  cacheLife("minutes");
  cacheTag("accueil");
  if (DEMO) return DEMO_HOME;
  const c = sb();
  const vendors = await getDirectory();
  const empty: Home = { slides: [], feature: null, picks: [], stories: [], categories: [], cities: [], vendors, testimonials: [] };
  if (!c) return empty;
  const [home, reviews] = await Promise.all([
    c.rpc("get_home_content"),
    c.from("reviews").select("author_names, city, wedding_date, created_at, rating, body, vendors(slug, name)")
      .eq("status", "published").gte("rating", 4).order("created_at", { ascending: false }).limit(12),
  ]);
  if (home.error) console.error("get_home_content", home.error.message);
  const h = (home.data ?? {}) as Row;
  const categories: Category[] = ((h.categories as Row[] | null) ?? []).map((x) => {
    const known = CATEGORIES.find((k) => k.slug === x.slug);
    return { slug: s(x.slug), name: s(x.name), plural: s(x.name_plural) || s(x.name), count: n(x.vendor_count),
      image: file(x.image_path, "site-media") || (known ? U(known.img, 900) : FALLBACK_IMAGE) };
  });
  const slides = ((h.slides as Row[] | null) ?? []).map((x) => {
    const image = x.image_path ? file(x.image_path, "site-media") : file(x.media_kind === "video" ? x.poster_path : x.media_path);
    return image ? { image, title: s(x.title), subtitle: s(x.subtitle), video: x.media_kind === "video", vendor: toCard(x.vendor as Row) } : null;
  }).filter((x): x is NonNullable<typeof x> => !!x);
  const stories = ((h.stories as Row[] | null) ?? []).map((x) => {
    const vendor = toCard(x.vendor as Row);
    const frames = ((x.items as Row[] | null) ?? []).map((i) => ({ image: file(i.path), caption: s(i.caption) })).filter((f) => f.image);
    const ring = file(x.cover_path) || frames[0]?.image || vendor.cover;
    return { id: s(x.id), title: s(x.title), ring, frames: frames.length ? frames : [{ image: ring, caption: "" }], vendor };
  });
  const testimonials: Testimonial[] = ((reviews.data as Row[] | null) ?? []).filter((r) => s(r.body).length >= 40 && one(r.vendors)).slice(0, 6).map((r) => ({
    names: s(r.author_names), city: s(r.city), date: monthYear(s(r.wedding_date) || s(r.created_at)), rating: n(r.rating), text: s(r.body),
    vendor: { slug: s(one(r.vendors)!.slug), name: s(one(r.vendors)!.name) },
  }));
  // Sans sélection dans l'admin : les vitrines recommandées puis les mieux notées (toujours de vraies vitrines)
  const ranked = [...vendors].sort((a, b) => Number(b.recommended) - Number(a.recommended) || b.rating - a.rating);
  const picks = ((h.recommandations as Row[] | null) ?? []).map(toCard);
  const feature = h.a_la_une ? toCard(h.a_la_une as Row) : null;
  return {
    slides: slides.length ? slides : ranked.slice(0, 5).filter((v) => v.cover !== FALLBACK_IMAGE).map((v) => ({ image: v.cover, title: "", subtitle: "", video: false, vendor: v })),
    feature: feature ?? picks[0] ?? ranked[0] ?? null,
    picks: (picks.length ? picks : ranked.slice(1, 5)).filter((v) => v.slug !== (feature ?? picks[0] ?? ranked[0])?.slug).slice(0, 4),
    stories, categories: categories.length ? categories : CATEGORIES.map((k) => ({ slug: k.slug, name: k.name, plural: k.name, count: vendors.filter((v) => v.cat === k.slug).length, image: U(k.img, 900) })),
    cities: ((h.cities as Row[] | null) ?? []).map((x) => s(x.name)), vendors, testimonials,
  };
}

/* ------------------------------------------------------------------ */
/* Profil                                                               */
/* ------------------------------------------------------------------ */
const PROFILE_SELECT = [
  "id, slug, name, tagline, bio, style_tags, city, zones, languages, avatar_path, phone, whatsapp, details, is_verified, is_recommended",
  "rating_avg, rating_count, followers_count, response_minutes",
  "cover:media!vendors_cover_fk(storage_path, kind, status)",
  "vendor_categories(is_primary, categories(slug, name, name_plural, detail_schema))",
  "media!media_vendor_id_fkey(kind, storage_path, poster_path, width, height, alt, duration_s, sort, status, albums!media_album_id_fkey(title))",
  "packages(id, name, description, price_mode, price_amount, currency, includes, excludes, is_featured, sort, is_visible)",
  "package_options(id, name, price_amount, currency, sort)",
  "reviews(author_names, photo_path, wedding_date, city, rating, body, reply, created_at, status)",
  "stories(title, sort, is_archived, story_items(caption, sort, media(kind, storage_path, poster_path)))",
].join(", ");
const LANG: Record<string, string> = { fr: "Français", ln: "Lingala", sw: "Swahili", en: "Anglais", kg: "Kikongo", lu: "Tshiluba" };
const money = (amount: unknown, cur: unknown) => (cur === "USD" ? Math.round(n(amount) / 100) : n(amount));
const bySort = (a: Row, b: Row) => n(a.sort) - n(b.sort);

export async function getProfile(slug: string): Promise<Profile | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(`prestataire-${slug}`);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return null;
  if (DEMO) return demoProfile(slug);
  const c = sb();
  if (!c) return null;
  const [{ data, error }, avail, card] = await Promise.all([
    c.from("vendors").select(PROFILE_SELECT).eq("slug", slug).eq("status", "published").maybeSingle(),
    c.rpc("get_public_availability", { p_vendor_slug: slug }),
    getDirectory().then((all) => all.find((v) => v.slug === slug)),
  ]);
  if (error) console.error("profil", error.message);
  const r = data as Row | null;
  if (!r) return null;
  const vc = (r.vendor_categories as Row[] | null) ?? [];
  const pc = one((vc.find((x) => x.is_primary) ?? vc[0])?.categories);
  const media = ((r.media as Row[] | null) ?? []).filter((m) => m.status === "ready" && (m.kind === "photo" || m.poster_path)).sort(bySort);
  const gallery2 = media.map((m) => ({
    image: file(m.kind === "video" ? m.poster_path : m.storage_path), width: n(m.width) || 1000, height: n(m.height) || 1250, alt: s(m.alt),
    album: s(one(m.albums)?.title),
    video: m.kind === "video" ? { src: file(m.storage_path), duration: m.duration_s ? `${Math.floor(n(m.duration_s) / 60)}:${String(Math.round(n(m.duration_s) % 60)).padStart(2, "0")}` : "" } : null,
  }));
  const photos = gallery2.filter((g) => !g.video);
  const cover = r.cover as Row | null;
  const coverImage = (cover && cover.kind === "photo" && cover.status === "ready" && file(cover.storage_path)) || photos[0]?.image || card?.cover || FALLBACK_IMAGE;
  const reviewList = ((r.reviews as Row[] | null) ?? []).filter((x) => x.status === "published")
    .sort((a, b) => s(b.created_at).localeCompare(s(a.created_at))).slice(0, 30)
    .map((x) => ({ names: s(x.author_names), image: file(x.photo_path) || null, date: longDate(s(x.wedding_date) || s(x.created_at)), city: s(x.city), rating: n(x.rating), text: s(x.body), reply: s(x.reply) }));
  const d = (r.details as Record<string, unknown> | null) ?? {};
  const facts: string[] = [], keyFigures: [string, string][] = [];
  for (const f of ((pc?.detail_schema as Row[] | null) ?? [])) {
    const key = s(f.key), val = d[key];
    if (val == null || val === "" || (Array.isArray(val) && !val.length) || key === "adresse" || key === "acces") continue;
    if (f.type === "list") (Array.isArray(val) ? val : String(val).split("\n")).map((x) => String(x).trim()).filter(Boolean).forEach((x) => facts.push(x));
    else if (f.type === "number") keyFigures.push([new Intl.NumberFormat("fr-FR").format(Number(val)), s(f.label).toLowerCase()]);
    else facts.push(`${s(f.label)} : ${val}`);
  }
  if (n(r.rating_count)) keyFigures.push([String(n(r.rating_count)), "avis vérifiés"]);
  if (photos.length) keyFigures.push([String(photos.length), "réalisations en ligne"]);
  const rm = r.response_minutes == null ? null : n(r.response_minutes);
  const availability: Profile["availability"] = {};
  for (const a of ((avail.data as Row[] | null) ?? [])) availability[s(a.day)] = a.status === "option" ? "option" : "booked";
  const base: Card = card ?? {
    id: s(r.id), slug, name: s(r.name), cat: s(pc?.slug), catName: s(pc?.name) || "Prestataire", city: s(r.city), tagline: s(r.tagline),
    rating: n(r.rating_avg), reviews: n(r.rating_count), followers: n(r.followers_count), price: null, verified: !!r.is_verified,
    recommended: !!r.is_recommended, avatar: file(r.avatar_path) || coverImage, cover: coverImage, gallery: photos.slice(0, 3).map((p) => p.image),
  };
  return {
    ...base,
    bio: (s(r.bio) || s(r.tagline) || `${s(r.name)} accompagne les mariés à ${s(r.city)}.`).split(/\n+/).map((x) => x.trim()).filter(Boolean),
    styleTags: (r.style_tags as string[] | null) ?? [], zone: ((r.zones as string[] | null) ?? []).join(", ") || `${s(r.city)} et environs`,
    languages: ((r.languages as string[] | null) ?? []).map((l) => LANG[l] ?? l),
    coverImage, gallery2,
    packages: ((r.packages as Row[] | null) ?? []).filter((p) => p.is_visible !== false).sort(bySort).map((p) => ({
      id: s(p.id) || null, name: s(p.name), description: s(p.description), price: money(p.price_amount, p.currency), currency: p.currency === "CDF" ? "CDF" : "USD",
      fixed: p.price_mode === "fixed", featured: !!p.is_featured, includes: (p.includes as string[] | null) ?? [], excludes: (p.excludes as string[] | null) ?? [],
    })),
    options: ((r.package_options as Row[] | null) ?? []).sort(bySort).map((o) => ({ id: s(o.id) || null, name: s(o.name), price: money(o.price_amount, o.currency), currency: o.currency === "CDF" ? "CDF" : "USD" })),
    reviewList,
    dist: [5, 4, 3, 2, 1].map((k) => (reviewList.length ? Math.round((100 * reviewList.filter((x) => x.rating === k).length) / reviewList.length) : 0)),
    facts, keyFigures: keyFigures.slice(0, 4), address: s(d.adresse), access: s(d.acces),
    highlights: ((r.stories as Row[] | null) ?? []).filter((x) => !x.is_archived).sort(bySort).map((st) => {
      const items = ((st.story_items as Row[] | null) ?? []).sort(bySort).filter((i) => one(i.media));
      return { title: s(st.title), caption: s(items.find((i) => i.caption)?.caption), frames: items.map((i) => { const m = one(i.media)!; return file(m.kind === "video" ? m.poster_path : m.storage_path); }).filter(Boolean) };
    }).filter((h) => h.frames.length),
    availability,
    response: rm == null ? "" : rm < 60 ? "moins d’une heure" : `moins de ${Math.ceil(rm / 60)} h`,
    hasPhone: !!s(r.phone), hasWhatsapp: !!(s(r.whatsapp) || s(r.phone)),
  };
}

/** Numéros d'un prestataire : jamais dans la page, demandés au clic (route /api/prestataires/[slug]/contact) */
export async function getContact(slug: string) {
  if (DEMO) return { phone: "+243 000 000 000", whatsapp: "243000000000" };
  const { data } = (await sb()?.from("vendors").select("phone, whatsapp").eq("slug", slug).eq("status", "published").maybeSingle()) ?? {};
  if (!data) return null;
  return { phone: s(data.phone), whatsapp: (s(data.whatsapp) || s(data.phone)).replace(/\D/g, "") };
}

/* ------------------------------------------------------------------ */
/* Inspiration                                                          */
/* ------------------------------------------------------------------ */
export async function getInspiration(): Promise<InspirationItem[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("inspiration");
  if (DEMO) return DEMO_INSPIRATION;
  const { data, error } = (await sb()?.from("media")
    .select("storage_path, width, height, alt, vendors!media_vendor_id_fkey(slug, name, city, status, vendor_categories(is_primary, categories(name)))")
    .eq("kind", "photo").eq("status", "ready")
    .order("is_featured", { ascending: false }).order("created_at", { ascending: false }).limit(90)) ?? {};
  if (error) console.error("inspiration", error.message);
  return ((data as Row[] | null) ?? []).map((m) => {
    const v = one(m.vendors);
    if (!v || v.status !== "published") return null;
    const vc = (v.vendor_categories as Row[] | null) ?? [];
    return { image: file(m.storage_path), width: n(m.width) || 1000, height: n(m.height) || 1250, alt: s(m.alt) || `Réalisation de ${s(v.name)}`,
      vendor: { slug: s(v.slug), name: s(v.name), city: s(v.city), catName: s(one((vc.find((x) => x.is_primary) ?? vc[0])?.categories)?.name) } };
  }).filter((x): x is InspirationItem => !!x);
}
