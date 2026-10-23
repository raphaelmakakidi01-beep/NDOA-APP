import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/config";

/*
 * Contenus éditables depuis l'admin (Pages et contenus) : pages légales, FAQ, textes de l'accueil.
 * Lus avec la clé publique (RLS : uniquement ce qui est publié / public), mis en cache et
 * rafraîchis par l'admin via /api/admin/revalidate. Sans contenu publié : texte par défaut du site.
 */
let client: SupabaseClient | null = null;
const db = () => (SUPABASE_URL && SUPABASE_ANON_KEY ? (client ??= createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })) : null);

export async function getSitePage(slug: string): Promise<{ title: string; body: string; updatedAt?: string } | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(`page-${slug}`, "pages");
  const c = db();
  if (!c) return null;
  const { data } = await c.from("site_pages").select("title, body, updated_at").eq("slug", slug).eq("is_published", true).maybeSingle();
  return data && String(data.body ?? "").trim() ? { title: String(data.title), body: String(data.body), updatedAt: (data.updated_at as string) ?? undefined } : null;
}

export async function getFaqs(audience: "couples" | "prestataires"): Promise<[string, string][]> {
  "use cache";
  cacheLife("hours");
  cacheTag("faq", "pages");
  const c = db();
  if (!c) return [];
  const { data } = await c.from("faqs").select("question, answer").eq("audience", audience).eq("is_published", true).order("sort");
  return ((data ?? []) as { question: string; answer: string }[]).map((f) => [f.question, f.answer]);
}

export type SiteTexts = { heroTitle?: string; heroSubtitle?: string; contactEmail?: string; contactWhatsapp?: string };

export async function getSiteTexts(): Promise<SiteTexts> {
  "use cache";
  cacheLife("hours");
  cacheTag("accueil", "pages");
  const c = db();
  if (!c) return {};
  const { data } = await c.from("site_settings").select("key, value").in("key", ["accueil.hero", "general.contact"]);
  const get = (k: string) => ((data ?? []).find((x) => x.key === k)?.value ?? {}) as Record<string, string>;
  const t = (v?: string) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  return { heroTitle: t(get("accueil.hero").titre), heroSubtitle: t(get("accueil.hero").sous_titre), contactEmail: t(get("general.contact").email), contactWhatsapp: t(get("general.contact").whatsapp) };
}
