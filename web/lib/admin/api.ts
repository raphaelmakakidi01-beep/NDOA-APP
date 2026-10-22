"use client";

/*
 * Accès aux données de l'espace admin.
 * Toutes les lectures et actions passent par la session de l'utilisateur : la RLS et les
 * fonctions admin_* revérifient son rôle en base. Aucune clé secrète dans le navigateur.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEMO } from "@/lib/config";
import { getSupabase } from "@/lib/supabase/client";
import { demo, demoDashboard, demoLog } from "./demo";
import type {
  AdminMedia, AdminVendorDetail, AdminVendorRow, AuditEntry, Dashboard, PlanId, ReviewResult, VendorFilters, VendorStatus,
} from "./types";

type Row = Record<string, unknown>;
const wait = (ms = 350) => new Promise((r) => setTimeout(r, ms));

/** Message d'erreur lisible à partir du code renvoyé par la base */
export function adminError(message: string) {
  const codes: Record<string, string> = {
    ADMIN_ONLY: "Action réservée aux administrateurs.",
    REASON_REQUIRED: "Indiquez un motif.",
    INVALID_STATE: "Cette vitrine a changé de statut entre-temps. Rechargez la page.",
    CONFIRMATION_MISMATCH: "Le nom de la vitrine retapé ne correspond pas.",
    NOT_FOUND: "Élément introuvable (déjà supprimé ?).",
    TOO_MANY: "100 vitrines au maximum par action groupée.",
    PUBLISH_NEEDS_6_PHOTOS: "Il manque des photos (6 minimum) : refusez avec ce motif.",
    PUBLISH_NEEDS_PACKAGE: "Aucun forfait visible : refusez avec ce motif.",
    PUBLISH_NEEDS_CONTACT: "Aucun téléphone ni WhatsApp : refusez avec ce motif.",
    PUBLISH_NEEDS_CATEGORY: "Aucune activité choisie : refusez avec ce motif.",
    FORBIDDEN: "Accès refusé.",
    UNAUTHENTICATED: "Session expirée : reconnectez-vous.",
  };
  const code = Object.keys(codes).find((k) => message.includes(k));
  return code ? codes[code] : "L’action a échoué. Réessayez.";
}

function sbOrThrow(): SupabaseClient {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase indisponible");
  return sb;
}
const mediaUrl = (sb: SupabaseClient, path?: string | null) =>
  !path ? undefined : /^https?:/.test(path) ? path : sb.storage.from("vendor-media").getPublicUrl(path).data.publicUrl;
const one = <T,>(x: T | T[] | null | undefined) => (Array.isArray(x) ? x[0] : x) ?? undefined;

/** Rafraîchit l'annuaire et l'accueil publics après une décision (sinon : quelques minutes) */
function refreshPublic() {
  return fetch("/api/admin/revalidate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tags: ["prestataires", "accueil"] }) }).catch(() => {});
}

/* ------------------------------------------------------------------ */
/* Session                                                             */
/* ------------------------------------------------------------------ */
export type StaffMe = { id: string; name: string; email?: string; role: "admin" | "moderateur" };

export async function getMe(): Promise<StaffMe | null> {
  if (DEMO) return { id: "demo-admin", name: "Admin démo", email: "admin@ndoa.cd", role: "admin" };
  const sb = sbOrThrow();
  const { data } = await sb.auth.getUser();
  if (!data.user) return null;
  const { data: p } = await sb.from("profiles").select("full_name, role").eq("id", data.user.id).maybeSingle();
  if (!p || (p.role !== "admin" && p.role !== "moderateur")) return null;
  return { id: data.user.id, name: (p.full_name as string) || data.user.email || "Équipe NDOA", email: data.user.email, role: p.role };
}

/* ------------------------------------------------------------------ */
/* Tableau de bord                                                     */
/* ------------------------------------------------------------------ */
export async function getDashboard(days: number): Promise<Dashboard> {
  if (DEMO) { await wait(); return demoDashboard(days); }
  const { data, error } = await sbOrThrow().rpc("admin_dashboard", { p_days: days });
  if (error) throw new Error(adminError(error.message));
  return data as Dashboard;
}

export async function pendingCount(): Promise<number> {
  if (DEMO) return demo.vendors.filter((v) => v.status === "pending_review").length;
  const { count } = await sbOrThrow().from("vendors").select("id", { count: "exact", head: true }).eq("status", "pending_review");
  return count ?? 0;
}

/* ------------------------------------------------------------------ */
/* Prestataires                                                        */
/* ------------------------------------------------------------------ */
function rowFrom(sb: SupabaseClient, v: Row): AdminVendorRow {
  const cats = (v.vendor_categories as Row[] | undefined) ?? [];
  const primary = cats.find((c) => c.is_primary) ?? cats[0];
  const cat = one(primary?.categories as Row | Row[] | undefined);
  const sub = one(v.subscriptions as Row | Row[] | undefined);
  return {
    id: String(v.id), slug: String(v.slug), name: String(v.name), city: String(v.city), status: v.status as VendorStatus,
    isVerified: !!v.is_verified, isRecommended: !!v.is_recommended,
    category: cat ? { slug: String(cat.slug), name: String(cat.name) } : undefined,
    plan: ((sub?.plan_id as PlanId) ?? "free"), rating: Number(v.rating_avg ?? 0), ratingCount: Number(v.rating_count ?? 0),
    createdAt: String(v.created_at), submittedAt: (v.submitted_at as string) ?? undefined, publishedAt: (v.published_at as string) ?? undefined,
    avatarUrl: mediaUrl(sb, v.avatar_path as string | null),
  };
}

const LIST_COLUMNS = "id, slug, name, city, status, is_verified, is_recommended, rating_avg, rating_count, created_at, submitted_at, published_at, avatar_path";

export async function listVendors(f: VendorFilters): Promise<{ rows: AdminVendorRow[]; total: number }> {
  if (DEMO) {
    await wait();
    const q = f.q.trim().toLowerCase();
    let rows = demo.vendors.filter((v) =>
      (!q || `${v.name} ${v.slug} ${v.city}`.toLowerCase().includes(q)) && (!f.category || v.category?.slug === f.category)
      && (!f.city || v.city === f.city) && (!f.status || v.status === f.status) && (!f.plan || v.plan === f.plan));
    const key = { created_at: "createdAt", name: "name", rating_avg: "rating", submitted_at: "submittedAt" }[f.sort] as keyof AdminVendorRow;
    rows = [...rows].sort((a, b) => String(a[key] ?? "").localeCompare(String(b[key] ?? ""), "fr", { numeric: true }) * (f.dir === "asc" ? 1 : -1));
    return { rows: rows.slice((f.page - 1) * f.pageSize, f.page * f.pageSize), total: rows.length };
  }
  const sb = sbOrThrow();
  const inner = (on: boolean) => (on ? "!inner" : "");
  let query = sb.from("vendors").select(
    `${LIST_COLUMNS}, vendor_categories${inner(!!f.category)}(is_primary, categories${inner(!!f.category)}(slug, name)), subscriptions${inner(!!f.plan)}(plan_id)`,
    { count: "exact" });
  const search = f.q.replace(/[%,()*\\.:]/g, " ").trim();
  if (search) query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%,city.ilike.%${search}%`);
  if (f.category) query = query.eq("vendor_categories.categories.slug", f.category);
  if (f.plan) query = query.eq("subscriptions.plan_id", f.plan);
  if (f.city) query = query.eq("city", f.city);
  if (f.status) query = query.eq("status", f.status);
  query = query.order(f.sort, { ascending: f.dir === "asc", nullsFirst: false }).range((f.page - 1) * f.pageSize, f.page * f.pageSize - 1);
  const { data, count, error } = await query;
  if (error) throw new Error(adminError(error.message));
  return { rows: ((data ?? []) as Row[]).map((v) => rowFrom(sb, v)), total: count ?? 0 };
}

/** Toutes les lignes correspondant aux filtres (export CSV, 5 000 max) */
export async function exportVendors(f: VendorFilters) {
  const all: AdminVendorRow[] = [];
  for (let page = 1; page <= 50; page++) {
    const { rows, total } = await listVendors({ ...f, page, pageSize: 100 });
    all.push(...rows);
    if (all.length >= total || !rows.length) break;
  }
  if (!DEMO) await getSupabase()?.rpc("admin_log", { p_action: "export.csv", p_target_type: "vendors", p_target_id: String(all.length) });
  return all;
}

const DETAIL_COLUMNS = `${LIST_COLUMNS}, tagline, bio, phone, whatsapp, email, zones, languages, socials, cover_media_id, owner_id,
  rejection_reason, suspended_reason, approved_at, reviewed_at,
  vendor_categories(is_primary, categories(slug, name)), subscriptions(plan_id),
  media(id, kind, storage_path, poster_path, status, is_hidden, hidden_reason, sort),
  packages(id, name, price_mode, price_amount, currency, is_visible, duration_label, includes, sort)`;

function detailFrom(sb: SupabaseClient, v: Row): AdminVendorDetail {
  const media = ((v.media as Row[]) ?? []).filter((m) => m.status === "ready")
    .sort((a, b) => Number(a.sort) - Number(b.sort))
    .map((m): AdminMedia => ({ id: String(m.id), kind: m.kind as "photo", url: mediaUrl(sb, (m.kind === "video" ? m.poster_path ?? m.storage_path : m.storage_path) as string)!, isHidden: !!m.is_hidden, hiddenReason: (m.hidden_reason as string) ?? undefined }));
  const cover = ((v.media as Row[]) ?? []).find((m) => m.id === v.cover_media_id);
  return {
    ...rowFrom(sb, v),
    tagline: (v.tagline as string) ?? undefined, bio: (v.bio as string) ?? undefined,
    phone: (v.phone as string) ?? undefined, whatsapp: (v.whatsapp as string) ?? undefined, email: (v.email as string) ?? undefined,
    zones: (v.zones as string[]) ?? [], languages: (v.languages as string[]) ?? [], socials: (v.socials as Record<string, string>) ?? {},
    coverUrl: cover ? mediaUrl(sb, cover.storage_path as string) : media[0]?.url,
    categories: ((v.vendor_categories as Row[]) ?? []).map((c) => { const cat = one(c.categories as Row | Row[] | undefined); return { slug: String(cat?.slug), name: String(cat?.name), primary: !!c.is_primary }; }),
    rejectionReason: (v.rejection_reason as string) ?? undefined, suspendedReason: (v.suspended_reason as string) ?? undefined,
    approvedAt: (v.approved_at as string) ?? undefined, reviewedAt: (v.reviewed_at as string) ?? undefined,
    owner: { id: String(v.owner_id) },
    media,
    packages: ((v.packages as Row[]) ?? []).sort((a, b) => Number(a.sort) - Number(b.sort)).map((p) => ({
      id: String(p.id), name: String(p.name), priceMode: p.price_mode as "from", amount: Number(p.price_amount) / (p.currency === "USD" ? 100 : 1), currency: p.currency as "USD",
      isVisible: !!p.is_visible, duration: (p.duration_label as string) ?? undefined, includes: (p.includes as string[]) ?? [],
    })),
    stats: null, history: null,
  };
}

export async function getVendor(id: string, role: "admin" | "moderateur"): Promise<AdminVendorDetail | null> {
  if (DEMO) { await wait(); const v = demo.vendors.find((x) => x.id === id); return v ? structuredClone(v) : null; }
  const sb = sbOrThrow();
  const { data, error } = await sb.from("vendors").select(DETAIL_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(adminError(error.message));
  if (!data) return null;
  const v = detailFrom(sb, data as Row);
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const [owner, inquiries, views, history] = await Promise.all([
    sb.from("profiles").select("full_name, phone").eq("id", v.owner!.id).maybeSingle(),
    role === "admin" ? sb.from("inquiries").select("id", { count: "exact", head: true }).eq("vendor_id", id).gte("created_at", since) : null,
    role === "admin" ? sb.from("vendor_stats_daily").select("views").eq("vendor_id", id).gte("day", since.slice(0, 10)) : null,
    role === "admin" ? sb.from("audit_logs").select("id, action, reason, actor_role, created_at, actor:profiles!audit_logs_actor_id_fkey(full_name)").eq("vendor_id", id).order("created_at", { ascending: false }).limit(50) : null,
  ]);
  v.owner = { id: v.owner!.id, name: (owner.data?.full_name as string) ?? undefined, phone: (owner.data?.phone as string) ?? undefined };
  if (role === "admin") {
    v.stats = { inquiries30: inquiries?.count ?? 0, views30: ((views?.data ?? []) as Row[]).reduce((s, r) => s + Number(r.views), 0) };
    v.history = ((history?.data ?? []) as Row[]).map((h): AuditEntry => ({
      id: String(h.id), action: String(h.action), reason: (h.reason as string) ?? undefined, actorRole: (h.actor_role as string) ?? undefined,
      actor: (one(h.actor as Row | Row[])?.full_name as string) ?? "Équipe NDOA", createdAt: String(h.created_at),
    }));
  }
  return v;
}

/** File de validation : plus anciennes demandes d'abord */
export async function getQueue(): Promise<AdminVendorDetail[]> {
  if (DEMO) {
    await wait();
    return structuredClone(demo.vendors.filter((v) => v.status === "pending_review")
      .sort((a, b) => (a.submittedAt ?? "").localeCompare(b.submittedAt ?? "")));
  }
  const sb = sbOrThrow();
  const { data, error } = await sb.from("vendors").select(DETAIL_COLUMNS).eq("status", "pending_review")
    .order("submitted_at", { ascending: true, nullsFirst: false }).limit(100);
  if (error) throw new Error(adminError(error.message));
  return ((data ?? []) as Row[]).map((v) => detailFrom(sb, v));
}

/* ------------------------------------------------------------------ */
/* Actions (journalisées en base)                                      */
/* ------------------------------------------------------------------ */
export async function reviewVendors(ids: string[], decision: "approve" | "reject", reason?: string): Promise<ReviewResult> {
  if (DEMO) {
    await wait(500);
    const errors: ReviewResult["errors"] = [];
    let ok = 0;
    for (const id of ids) {
      const v = demo.vendors.find((x) => x.id === id);
      if (!v || !["pending_review", "rejected"].includes(v.status)) { errors.push({ id, error: "INVALID_STATE" }); continue; }
      if (decision === "approve" && v.media.filter((m) => !m.isHidden).length < 6) { errors.push({ id, error: "PUBLISH_NEEDS_6_PHOTOS" }); continue; }
      if (decision === "approve" && (!v.phone && !v.whatsapp)) { errors.push({ id, error: "PUBLISH_NEEDS_CONTACT" }); continue; }
      v.status = decision === "approve" ? "published" : "rejected";
      v.rejectionReason = decision === "reject" ? reason : undefined;
      if (decision === "approve") { v.approvedAt = new Date().toISOString(); v.publishedAt = v.approvedAt; }
      demoLog(`vendor.${decision}`, id, reason);
      ok++;
    }
    return { ok, errors };
  }
  const { data, error } = await sbOrThrow().rpc("admin_review_vendors", { p_ids: ids, p_decision: decision, p_reason: reason ?? null });
  if (error) throw new Error(adminError(error.message));
  if (decision === "approve") void refreshPublic();
  return data as ReviewResult;
}

export async function setVerified(id: string, verified: boolean) {
  if (DEMO) { await wait(); const v = demo.vendors.find((x) => x.id === id)!; v.isVerified = verified; demoLog(verified ? "vendor.verify" : "vendor.unverify", id); return; }
  const { error } = await sbOrThrow().rpc("admin_set_verified", { p_vendor: id, p_verified: verified });
  if (error) throw new Error(adminError(error.message));
  void refreshPublic();
}

export async function suspendVendor(id: string, suspend: boolean, reason: string) {
  if (DEMO) {
    await wait();
    const v = demo.vendors.find((x) => x.id === id)!;
    v.status = suspend ? "suspended" : v.approvedAt ? "published" : "draft";
    v.suspendedReason = suspend ? reason : undefined;
    demoLog(suspend ? "vendor.suspend" : "vendor.unsuspend", id, reason);
    return;
  }
  const { error } = await sbOrThrow().rpc("admin_suspend_vendor", { p_vendor: id, p_suspend: suspend, p_reason: reason });
  if (error) throw new Error(adminError(error.message));
  void refreshPublic();
}

/** Suppression : route serveur (vérifie le rôle, appelle la base, nettoie le stockage avec la clé serveur) */
export async function deleteVendor(id: string, confirmSlug: string, reason: string) {
  if (DEMO) {
    await wait();
    const v = demo.vendors.find((x) => x.id === id);
    if (!v || v.slug !== confirmSlug) throw new Error(adminError("CONFIRMATION_MISMATCH"));
    demo.vendors.splice(demo.vendors.indexOf(v), 1);
    demoLog("vendor.delete", id, reason);
    return { storageCleaned: true };
  }
  const r = await fetch(`/api/admin/vendors/${encodeURIComponent(id)}`, {
    method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirmSlug, reason }),
  });
  const body = (await r.json().catch(() => ({}))) as { error?: string; storageCleaned?: boolean };
  if (!r.ok) throw new Error(adminError(body.error ?? "FAILED"));
  void refreshPublic();
  return { storageCleaned: !!body.storageCleaned };
}

/** Trace la consultation « en tant que » (lecture seule) */
export async function logViewAs(id: string) {
  if (DEMO) { demoLog("vendor.view_as", id); return; }
  await getSupabase()?.rpc("admin_log", { p_action: "vendor.view_as", p_target_type: "vendor", p_target_id: id, p_vendor: id });
}

export type Workspace = {
  inquiries: { id: string; names: string; date?: string; status: string; createdAt: string; answered: boolean }[];
  reviews: { id: string; names: string; rating: number; status: string; createdAt: string }[];
};

/** Vue « en tant que » : ce que le prestataire voit dans son espace (lecture seule) */
export async function getVendorWorkspace(id: string): Promise<Workspace> {
  if (DEMO) {
    await wait();
    seedViewAs(id);
    return { inquiries: viewAsDemo.inquiries, reviews: viewAsDemo.reviews };
  }
  const sb = sbOrThrow();
  const [inq, rev] = await Promise.all([
    sb.from("inquiries").select("id, couple_names, wedding_date, status, created_at, first_response_at").eq("vendor_id", id).order("created_at", { ascending: false }).limit(20),
    sb.from("reviews").select("id, author_names, rating, status, created_at").eq("vendor_id", id).order("created_at", { ascending: false }).limit(10),
  ]);
  return {
    inquiries: ((inq.data ?? []) as Row[]).map((i) => ({ id: String(i.id), names: String(i.couple_names), date: (i.wedding_date as string) ?? undefined, status: String(i.status), createdAt: String(i.created_at), answered: !!i.first_response_at })),
    reviews: ((rev.data ?? []) as Row[]).map((r) => ({ id: String(r.id), names: String(r.author_names), rating: Number(r.rating), status: String(r.status), createdAt: String(r.created_at) })),
  };
}

const viewAsDemo: Workspace = { inquiries: [], reviews: [] };
function seedViewAs(id: string) {
  const n = Number(id.replace(/\D/g, "")) || 1;
  const names = ["Grâce & Patrick", "Divine & Jonathan", "Mireille & Hervé", "Prisca & Olivier", "Sarah & Ben"];
  const st = ["new", "discussing", "quote_sent", "confirmed", "lost"];
  viewAsDemo.inquiries = names.map((names, i) => ({
    id: `i${i}`, names, date: new Date(Date.now() + (40 + i * 23) * 86400000).toISOString().slice(0, 10), status: st[(i + n) % 5],
    createdAt: new Date(Date.now() - (i + 1) * 86400000 * 2).toISOString(), answered: (i + n) % 3 !== 0,
  }));
  viewAsDemo.reviews = names.slice(0, 3).map((names, i) => ({ id: `r${i}`, names, rating: 5 - (i % 2), status: "published", createdAt: new Date(Date.now() - (i + 3) * 86400000 * 9).toISOString() }));
}
