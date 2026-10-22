"use client";

/*
 * Étape 4 : utilisateurs, demandes de devis, abonnements et paiements, communication,
 * pages et contenus, équipe, réglages et journal d'audit.
 * Lectures et écritures avec la session de l'admin (RLS + fonctions admin_*) ; les opérations
 * qui exigent la clé serveur (Auth) passent par /api/admin/*.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEMO } from "@/lib/config";
import { getSupabase } from "@/lib/supabase/client";
import { uid } from "@/lib/utils";
import { adminError } from "./api";
import { demo, demoLog } from "./demo";
import type { PlanId } from "./types";

type Row = Record<string, unknown>;
const wait = (ms = 300) => new Promise((r) => setTimeout(r, ms));
const one = (x: unknown): Row | undefined => ((Array.isArray(x) ? x[0] : x) as Row | null | undefined) ?? undefined;
function sb(): SupabaseClient {
  const c = getSupabase();
  if (!c) throw new Error("Supabase indisponible");
  return c;
}
const check = (r: { error: { message: string } | null }) => { if (r.error) throw new Error(adminError(r.error.message)); };
const ago = (h: number) => new Date(Date.now() - h * 3600000).toISOString();
const S = (x: unknown) => (x === null || x === undefined ? undefined : String(x));

/** Erreurs des routes serveur /api/admin/* */
const API_ERRORS: Record<string, string> = {
  HAS_VENDOR: "Ce compte possède une vitrine : supprimez d’abord la vitrine depuis la fiche prestataire.",
  STAFF_ACCOUNT: "Retirez d’abord son rôle dans l’équipe (Paramètres).",
  SELF_FORBIDDEN: "Impossible sur votre propre compte.",
  REASON_REQUIRED: "Indiquez un motif.",
  SERVICE_KEY_MISSING: "Action impossible : la clé serveur Supabase (SUPABASE_SERVICE_ROLE_KEY) n’est pas configurée.",
  EMAIL_INVALID: "Adresse e-mail invalide.",
  INVITE_FAILED: "L’invitation n’a pas pu être envoyée (adresse refusée ou envoi d’e-mails non configuré).",
  AUTH_DELETE_FAILED: "Le compte n’a pas pu être supprimé dans Supabase Auth.",
  FORBIDDEN: "Action réservée aux administrateurs.",
  UNAUTHENTICATED: "Session expirée : reconnectez-vous.",
};
async function api(path: string, method: string, body?: unknown) {
  const r = await fetch(path, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const json = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok) throw new Error(API_ERRORS[String(json.error)] ?? adminError(String(json.error ?? "FAILED")));
  return json;
}

/** Rafraîchit le cache des pages publiques concernées (sinon : quelques minutes) */
export async function revalidatePublic(tags: string[]) {
  if (DEMO) return;
  await fetch("/api/admin/revalidate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tags }) }).catch(() => {});
}

/* ================================================================== */
/* Utilisateurs                                                        */
/* ================================================================== */
export type UserRole = "user" | "prestataire" | "moderateur" | "admin";
export type AdminUser = {
  id: string; name?: string; email?: string; phone?: string; role: UserRole; createdAt: string; lastSignInAt?: string;
  suspendedAt?: string; deletedAt?: string; vendors: number; inquiries: number;
};
export type UserDetail = AdminUser & {
  suspendedReason?: string; providers: string[]; favorites: number; follows: number;
  vendorList: { id: string; name: string; slug: string; status: string }[];
  inquiryList: { id: string; vendor: string; vendorId: string; status: string; weddingDate?: string; createdAt: string }[];
};
export type UserFilters = { q: string; role: "" | UserRole; status: "" | "active" | "suspended" | "deleted"; page: number; pageSize: number };

const demoUsers: UserDetail[] = [
  ...["Grâce & Patrick", "Divine Mukendi", "Jonathan B.", "Mireille Kasongo", "Prisca & Olivier", "Sarah Lunda", "Ben Ilunga", "Ruth Mbuyi"].map((n, i): UserDetail => ({
    id: `u-c${i}`, name: n, email: `${n.split(" ")[0].toLowerCase().replace(/[^a-z]/g, "")}${i}@exemple.cd`, phone: `+24381${String(4400000 + i * 3571).slice(0, 7)}`,
    role: "user", createdAt: ago(24 * (3 + i * 9)), lastSignInAt: ago(10 + i * 30), suspendedAt: i === 6 ? ago(40) : undefined, suspendedReason: i === 6 ? "Messages insultants envoyés à plusieurs prestataires" : undefined,
    deletedAt: undefined, vendors: 0, inquiries: (i * 3) % 5, providers: [i % 3 === 0 ? "google" : "email"], favorites: (i * 2) % 7, follows: i % 4, vendorList: [],
    inquiryList: Array.from({ length: (i * 3) % 5 }, (_, k) => ({ id: `iq-${i}-${k}`, vendor: demo.vendors[(i + k) % 10].name, vendorId: demo.vendors[(i + k) % 10].id, status: ["new", "discussing", "quote_sent", "confirmed"][k % 4], weddingDate: new Date(Date.now() + (60 + k * 20) * 86400000).toISOString().slice(0, 10), createdAt: ago(24 * (k + 1) * 3) })),
  })),
  ...demo.vendors.slice(0, 6).map((v, i): UserDetail => ({
    id: `u-v${i}`, name: v.owner?.name, email: v.email, phone: v.owner?.phone, role: "prestataire", createdAt: v.createdAt, lastSignInAt: ago(5 + i * 7),
    vendors: 1, inquiries: 0, providers: ["email"], favorites: 0, follows: 0, vendorList: [{ id: v.id, name: v.name, slug: v.slug, status: v.status }], inquiryList: [],
  })),
  { id: "u-m1", name: "Christelle (modération)", email: "christelle@ndoa.cd", role: "moderateur", createdAt: ago(900), lastSignInAt: ago(3), vendors: 0, inquiries: 0, providers: ["email"], favorites: 0, follows: 0, vendorList: [], inquiryList: [] },
  { id: "demo-admin", name: "Admin démo", email: "admin@ndoa.cd", role: "admin", createdAt: ago(2000), lastSignInAt: ago(0.2), vendors: 0, inquiries: 0, providers: ["email"], favorites: 0, follows: 0, vendorList: [], inquiryList: [] },
];

export async function listUsers(f: UserFilters): Promise<{ rows: AdminUser[]; total: number }> {
  if (DEMO) {
    await wait();
    const q = f.q.trim().toLowerCase();
    const rows = demoUsers.filter((u) => (!q || `${u.name} ${u.email} ${u.phone}`.toLowerCase().includes(q)) && (!f.role || u.role === f.role)
      && (!f.status || (f.status === "active" ? !u.suspendedAt && !u.deletedAt : f.status === "suspended" ? !!u.suspendedAt : !!u.deletedAt)));
    return { rows: rows.slice((f.page - 1) * f.pageSize, f.page * f.pageSize), total: rows.length };
  }
  const r = await sb().rpc("admin_list_users", { p_q: f.q || null, p_role: f.role || null, p_status: f.status || null, p_limit: f.pageSize, p_offset: (f.page - 1) * f.pageSize });
  check(r);
  const rows = (r.data ?? []) as Row[];
  return {
    total: Number(rows[0]?.total ?? 0),
    rows: rows.map((x) => ({ id: String(x.id), name: S(x.full_name), email: S(x.email), phone: S(x.phone), role: x.role as UserRole, createdAt: String(x.created_at),
      lastSignInAt: S(x.last_sign_in_at), suspendedAt: S(x.suspended_at), deletedAt: S(x.deleted_at), vendors: Number(x.vendors), inquiries: Number(x.inquiries) })),
  };
}

export async function getUser(id: string): Promise<UserDetail | null> {
  if (DEMO) { await wait(); const u = demoUsers.find((x) => x.id === id); return u ? structuredClone(u) : null; }
  const r = await sb().rpc("admin_user_detail", { p_user: id });
  if (r.error) { if (/NOT_FOUND/.test(r.error.message)) return null; throw new Error(adminError(r.error.message)); }
  const x = r.data as Row;
  return {
    id: String(x.id), name: S(x.full_name), email: S(x.email), phone: S(x.phone), role: x.role as UserRole, createdAt: String(x.created_at),
    lastSignInAt: S(x.last_sign_in_at), suspendedAt: S(x.suspended_at), suspendedReason: S(x.suspended_reason), deletedAt: S(x.deleted_at),
    providers: (x.providers as string[]) ?? [], favorites: Number(x.favorites ?? 0), follows: Number(x.follows ?? 0),
    vendorList: ((x.vendors as Row[]) ?? []).map((v) => ({ id: String(v.id), name: String(v.name), slug: String(v.slug), status: String(v.status) })),
    inquiryList: ((x.inquiries as Row[]) ?? []).map((i) => ({ id: String(i.id), vendor: String(i.vendor), vendorId: String(i.vendor_id), status: String(i.status), weddingDate: S(i.wedding_date), createdAt: String(i.created_at) })),
    vendors: ((x.vendors as Row[]) ?? []).length, inquiries: ((x.inquiries as Row[]) ?? []).length,
  };
}

/** Suspension : droits retirés en base + connexion bloquée (route serveur) */
export async function suspendUser(id: string, suspend: boolean, reason: string): Promise<{ loginBlocked: boolean }> {
  if (DEMO) {
    await wait();
    const u = demoUsers.find((x) => x.id === id)!;
    u.suspendedAt = suspend ? new Date().toISOString() : undefined;
    u.suspendedReason = suspend ? reason : undefined;
    demoLog(suspend ? "user.suspend" : "user.unsuspend", undefined, reason);
    return { loginBlocked: true };
  }
  const r = await api(`/api/admin/users/${encodeURIComponent(id)}`, "PATCH", { suspend, reason });
  return { loginBlocked: !!r.loginBlocked };
}

/** Suppression conforme (anonymisation des demandes, effacement du profil et du compte) */
export async function deleteUser(id: string, reason: string) {
  if (DEMO) {
    await wait();
    const u = demoUsers.find((x) => x.id === id)!;
    if (u.vendors) throw new Error(API_ERRORS.HAS_VENDOR);
    if (u.role === "admin" || u.role === "moderateur") throw new Error(API_ERRORS.STAFF_ACCOUNT);
    demoUsers.splice(demoUsers.indexOf(u), 1);
    demoLog("user.delete", undefined, reason);
    return;
  }
  await api(`/api/admin/users/${encodeURIComponent(id)}`, "DELETE", { reason });
}

/* ================================================================== */
/* Demandes de devis                                                   */
/* ================================================================== */
export type InquiryOverview = { total: number; answered: number; response_rate: number | null; avg_response_hours: number | null; unanswered_48h: number; confirmed: number; by_status: Record<string, number> };
export type VendorInquiryStat = { vendorId: string; vendorName: string; vendorSlug: string; total: number; answered: number; responseRate: number | null; avgResponseHours: number | null; unanswered48h: number };
export type UnansweredInquiry = { id: string; vendor: { id: string; name: string }; couple: string; weddingDate?: string; city?: string; createdAt: string };

export async function getInquiries(days: number): Promise<{ overview: InquiryOverview; byVendor: VendorInquiryStat[]; unanswered: UnansweredInquiry[] }> {
  if (DEMO) {
    await wait();
    const byVendor = demo.vendors.filter((v) => v.status === "published").map((v, i): VendorInquiryStat => {
      const total = 4 + ((i * 7) % 23), answered = Math.max(0, total - ((i * 3) % 6));
      return { vendorId: v.id, vendorName: v.name, vendorSlug: v.slug, total, answered, responseRate: answered / total, avgResponseHours: 1 + ((i * 5) % 30), unanswered48h: i % 4 === 1 ? (i % 3) + 1 : 0 };
    }).sort((a, b) => b.unanswered48h - a.unanswered48h || b.total - a.total);
    const total = byVendor.reduce((s, v) => s + v.total, 0), answered = byVendor.reduce((s, v) => s + v.answered, 0);
    return {
      overview: { total, answered, response_rate: answered / total, avg_response_hours: 9.4, unanswered_48h: byVendor.reduce((s, v) => s + v.unanswered48h, 0), confirmed: Math.round(total * 0.18), by_status: { new: 14, discussing: 31, quote_sent: 22, confirmed: Math.round(total * 0.18), lost: 9 } },
      byVendor,
      unanswered: byVendor.filter((v) => v.unanswered48h).flatMap((v, i) => Array.from({ length: v.unanswered48h }, (_, k) => ({ id: `un-${i}-${k}`, vendor: { id: v.vendorId, name: v.vendorName }, couple: ["Grâce & Patrick", "Divine & Jonathan", "Sarah & Ben"][k % 3], weddingDate: new Date(Date.now() + (45 + k * 30) * 86400000).toISOString().slice(0, 10), city: "Kinshasa", createdAt: ago(50 + k * 20 + i * 5) }))),
    };
  }
  const c = sb();
  const since = new Date(Date.now() - 48 * 3600000).toISOString();
  const [o, v, u] = await Promise.all([
    c.rpc("admin_inquiry_overview", { p_days: days }),
    c.rpc("admin_inquiry_stats", { p_days: days }),
    c.from("inquiries").select("id, couple_names, wedding_date, city, created_at, vendor:vendors(id, name)").is("first_response_at", null).lt("created_at", since).order("created_at").limit(200),
  ]);
  check(o); check(v); check(u);
  return {
    overview: o.data as InquiryOverview,
    byVendor: ((v.data ?? []) as Row[]).map((x) => ({ vendorId: String(x.vendor_id), vendorName: String(x.vendor_name), vendorSlug: String(x.vendor_slug), total: Number(x.total), answered: Number(x.answered),
      responseRate: x.response_rate === null ? null : Number(x.response_rate), avgResponseHours: x.avg_response_hours === null ? null : Number(x.avg_response_hours), unanswered48h: Number(x.unanswered_48h) })),
    unanswered: ((u.data ?? []) as Row[]).map((x) => ({ id: String(x.id), vendor: { id: String(one(x.vendor)?.id), name: String(one(x.vendor)?.name ?? "—") }, couple: String(x.couple_names), weddingDate: S(x.wedding_date), city: S(x.city), createdAt: String(x.created_at) })),
  };
}

export async function nudgeVendor(inquiryId: string) {
  if (DEMO) { await wait(); demoLog("inquiry.nudge", undefined); return; }
  const r = await sb().rpc("admin_nudge_vendor", { p_inquiry: inquiryId });
  if (r.error) throw new Error(/ALREADY_NUDGED/.test(r.error.message) ? "Déjà relancé dans les dernières 24 h." : /ALREADY_ANSWERED/.test(r.error.message) ? "Le prestataire a répondu entre-temps." : adminError(r.error.message));
}

/* ================================================================== */
/* Offres, abonnements, paiements                                      */
/* ================================================================== */
export type PlanLimits = { max_photos: number; max_videos: number; storage_mb: number; max_video_mb: number; max_packages: number | null; team_seats: number; stats: "basic" | "advanced"; verified_badge: boolean; recommendation_eligible: boolean; stories: boolean };
export type AdminPlan = { id: PlanId; name: string; priceUsd: number; priceCdf: number; limits: PlanLimits; features: string[]; isActive: boolean; subscribers: number };
export type Subscriber = { vendor: { id: string; name: string; slug: string }; plan: PlanId; status: string; periodEnd?: string; cancelAtPeriodEnd: boolean; method?: string; account?: string };
export type AdminInvoice = { id: string; number: string; vendor: { id: string; name: string }; plan: PlanId; amount: number; currency: "USD" | "CDF"; method: string; status: "pending" | "paid" | "failed" | "refunded"; createdAt: string; paidAt?: string; refundAmount?: number; refundReason?: string; pdfPath?: string; months: number };

const demoPlans: AdminPlan[] = [
  { id: "free", name: "Gratuit", priceUsd: 0, priceCdf: 0, limits: { max_photos: 30, max_videos: 0, storage_mb: 500, max_video_mb: 0, max_packages: 1, team_seats: 1, stats: "basic", verified_badge: false, recommendation_eligible: false, stories: false }, features: ["Vitrine publique", "30 photos", "Demandes de devis illimitées"], isActive: true, subscribers: 9 },
  { id: "pro", name: "Pro", priceUsd: 1900, priceCdf: 55000, limits: { max_photos: 300, max_videos: 10, storage_mb: 5120, max_video_mb: 200, max_packages: 10, team_seats: 3, stats: "advanced", verified_badge: true, recommendation_eligible: false, stories: true }, features: ["300 photos et 10 vidéos", "Badge Vérifié", "Stories", "Statistiques avancées"], isActive: true, subscribers: 7 },
  { id: "prestige", name: "Prestige", priceUsd: 4900, priceCdf: 140000, limits: { max_photos: 1500, max_videos: 50, storage_mb: 25600, max_video_mb: 500, max_packages: null, team_seats: 10, stats: "advanced", verified_badge: true, recommendation_eligible: true, stories: true }, features: ["Médias quasi illimités", "Éligible à « Nos recommandations »", "Équipe de 10 personnes"], isActive: true, subscribers: 2 },
];
const demoInvoices: AdminInvoice[] = demo.vendors.filter((v) => v.plan !== "free").flatMap((v, i) => Array.from({ length: 3 }, (_, k): AdminInvoice => ({
  id: `inv-${i}-${k}`, number: `FAC-2026-${String(120 + i * 3 + k).padStart(6, "0")}`, vendor: { id: v.id, name: v.name }, plan: v.plan, months: 1,
  amount: v.plan === "pro" ? 1900 : 4900, currency: "USD", method: ["mpesa", "orange_money", "airtel_money", "card"][(i + k) % 4],
  status: k === 0 && i === 2 ? "failed" : k === 1 && i === 1 ? "refunded" : "paid", createdAt: ago(24 * 30 * k + i * 11), paidAt: ago(24 * 30 * k + i * 11 - 1),
  refundAmount: k === 1 && i === 1 ? 1900 : undefined, refundReason: k === 1 && i === 1 ? "Double prélèvement" : undefined,
}))).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

export async function getBilling(): Promise<{ plans: AdminPlan[]; subscribers: Subscriber[]; invoices: AdminInvoice[] }> {
  if (DEMO) {
    await wait();
    return structuredClone({
      plans: demoPlans,
      subscribers: demo.vendors.map((v, i) => ({ vendor: { id: v.id, name: v.name, slug: v.slug }, plan: v.plan, status: v.plan === "free" ? "active" : i === 5 ? "past_due" : "active", periodEnd: v.plan === "free" ? undefined : new Date(Date.now() + (5 + i * 3) * 86400000).toISOString(), cancelAtPeriodEnd: i === 3, method: v.plan === "free" ? undefined : ["mpesa", "orange_money", "card"][i % 3], account: v.plan === "free" ? undefined : "•••• 45 67" })),
      invoices: demoInvoices,
    });
  }
  const c = sb();
  const [p, s, inv] = await Promise.all([
    c.from("plans").select("*").order("sort"),
    c.from("subscriptions").select("plan_id, status, current_period_end, cancel_at_period_end, provider_method, provider_account, vendor:vendors(id, name, slug)").order("updated_at", { ascending: false }).limit(1000),
    c.from("invoices").select("*, vendor:vendors(id, name)").order("created_at", { ascending: false }).limit(500),
  ]);
  check(p); check(s); check(inv);
  const subs = (s.data ?? []) as Row[];
  return {
    plans: ((p.data ?? []) as Row[]).map((x) => ({ id: x.id as PlanId, name: String(x.name), priceUsd: Number(x.price_usd), priceCdf: Number(x.price_cdf), limits: x.limits as PlanLimits,
      features: (x.features as string[]) ?? [], isActive: x.is_active !== false, subscribers: subs.filter((y) => y.plan_id === x.id && y.status !== "canceled").length })),
    subscribers: subs.map((x) => ({ vendor: { id: String(one(x.vendor)?.id), name: String(one(x.vendor)?.name ?? "—"), slug: String(one(x.vendor)?.slug ?? "") }, plan: x.plan_id as PlanId, status: String(x.status),
      periodEnd: S(x.current_period_end), cancelAtPeriodEnd: !!x.cancel_at_period_end, method: S(x.provider_method), account: S(x.provider_account) })),
    invoices: ((inv.data ?? []) as Row[]).map((x) => ({ id: String(x.id), number: String(x.number), vendor: { id: String(one(x.vendor)?.id), name: String(one(x.vendor)?.name ?? "—") }, plan: x.plan_id as PlanId,
      amount: Number(x.amount), currency: x.currency as "USD", method: String(x.method), status: x.status as AdminInvoice["status"], createdAt: String(x.created_at), paidAt: S(x.paid_at),
      refundAmount: x.refund_amount === null ? undefined : Number(x.refund_amount), refundReason: S(x.refund_reason), pdfPath: S(x.pdf_path), months: Number(x.months ?? 1) })),
  };
}

export async function savePlan(p: AdminPlan) {
  if (DEMO) { await wait(); const i = demoPlans.findIndex((x) => x.id === p.id); demoPlans[i] = { ...p }; demoLog("plans.update", undefined); return; }
  check(await sb().from("plans").update({ name: p.name, price_usd: p.priceUsd, price_cdf: p.priceCdf, limits: p.limits, features: p.features, is_active: p.isActive, updated_at: new Date().toISOString() }).eq("id", p.id));
  void revalidatePublic(["accueil"]);
}

export async function setSubscription(vendorId: string, plan: PlanId, periodEnd: string | undefined, reason: string) {
  if (DEMO) { await wait(); const v = demo.vendors.find((x) => x.id === vendorId); if (v) v.plan = plan; demoLog("subscription.set", vendorId, reason); return; }
  check(await sb().rpc("admin_set_subscription", { p_vendor: vendorId, p_plan: plan, p_period_end: periodEnd ?? null, p_reason: reason }));
}

export async function refundInvoice(id: string, amount: number, reason: string) {
  if (DEMO) {
    await wait();
    const inv = demoInvoices.find((x) => x.id === id)!;
    if (inv.status !== "paid") throw new Error(adminError("INVALID_STATE"));
    Object.assign(inv, { status: "refunded", refundAmount: amount, refundReason: reason });
    demoLog("invoice.refund", inv.vendor.id, reason);
    return;
  }
  const r = await sb().rpc("admin_refund_invoice", { p_invoice: id, p_amount: amount, p_reason: reason });
  if (r.error) throw new Error(/AMOUNT_INVALID/.test(r.error.message) ? "Montant invalide (supérieur au montant payé ?)." : adminError(r.error.message));
}

/** Facture PDF (stockage privé) : lien temporaire de 5 minutes */
export async function invoiceUrl(pdfPath: string) {
  if (DEMO) return null;
  const r = await sb().storage.from("vendor-private").createSignedUrl(pdfPath, 300);
  return r.data?.signedUrl ?? null;
}

/* ================================================================== */
/* Communication                                                       */
/* ================================================================== */
export type Audience = { statuses?: string[]; plans?: string[]; cities?: string[]; categories?: string[] };
export type Announcement = { id: string; title: string; body: string; channels: ("in_app" | "email")[]; audience: Audience; status: "draft" | "sent"; recipientsCount?: number; createdAt: string; sentAt?: string };
export type OutboxStats = { pending: number; sent: number; failed: number };

const demoAnnouncements: Announcement[] = [
  { id: "a1", title: "Nouveau : les stories arrivent sur NDOA", body: "Partagez vos coulisses en stories depuis votre galerie. Les plus belles seront mises en avant sur l’accueil.", channels: ["in_app", "email"], audience: { plans: ["pro", "prestige"] }, status: "sent", recipientsCount: 9, createdAt: ago(200), sentAt: ago(199) },
  { id: "a2", title: "Saison des mariages : complétez vos disponibilités", body: "Les couples filtrent désormais par date. Mettez votre calendrier à jour pour apparaître dans les recherches.", channels: ["in_app"], audience: {}, status: "draft", createdAt: ago(5) },
];

export async function listAnnouncements(): Promise<{ list: Announcement[]; outbox: OutboxStats }> {
  if (DEMO) { await wait(); return { list: structuredClone(demoAnnouncements), outbox: { pending: 12, sent: 340, failed: 2 } }; }
  const c = sb();
  const [a, p, s, f] = await Promise.all([
    c.from("announcements").select("*").order("created_at", { ascending: false }).limit(100),
    c.from("email_outbox").select("id", { count: "exact", head: true }).eq("status", "pending"),
    c.from("email_outbox").select("id", { count: "exact", head: true }).eq("status", "sent"),
    c.from("email_outbox").select("id", { count: "exact", head: true }).eq("status", "failed"),
  ]);
  check(a);
  return {
    list: ((a.data ?? []) as Row[]).map((x) => ({ id: String(x.id), title: String(x.title), body: String(x.body), channels: (x.channels as Announcement["channels"]) ?? ["in_app"], audience: (x.audience as Audience) ?? {},
      status: x.status as "draft", recipientsCount: x.recipients_count === null ? undefined : Number(x.recipients_count), createdAt: String(x.created_at), sentAt: S(x.sent_at) })),
    outbox: { pending: p.count ?? 0, sent: s.count ?? 0, failed: f.count ?? 0 },
  };
}

export async function audienceCount(a: Audience): Promise<number> {
  if (DEMO) {
    await wait(150);
    return demo.vendors.filter((v) => (!a.statuses?.length || a.statuses.includes(v.status)) && (!a.plans?.length || a.plans.includes(v.plan))
      && (!a.cities?.length || a.cities.includes(v.city)) && (!a.categories?.length || a.categories.includes(v.category?.slug ?? ""))).length;
  }
  const r = await sb().rpc("admin_announcement_audience", { p_audience: cleanAudience(a) });
  check(r);
  return Number(r.data);
}
const cleanAudience = (a: Audience) => Object.fromEntries(Object.entries(a).filter(([, v]) => Array.isArray(v) && v.length)) as Audience;

export async function saveAnnouncement(a: Omit<Announcement, "id" | "status" | "createdAt"> & { id?: string }): Promise<string> {
  if (DEMO) {
    await wait();
    const id = a.id ?? uid();
    const existing = demoAnnouncements.find((x) => x.id === id);
    if (existing) Object.assign(existing, a); else demoAnnouncements.unshift({ ...a, id, status: "draft", createdAt: new Date().toISOString() });
    return id;
  }
  const c = sb();
  const row = { title: a.title, body: a.body, channels: a.channels, audience: cleanAudience(a.audience) };
  if (a.id) { check(await c.from("announcements").update(row).eq("id", a.id).eq("status", "draft")); return a.id; }
  const r = await c.from("announcements").insert(row).select("id").single();
  check(r);
  return String((r.data as Row).id);
}

export async function sendAnnouncement(id: string): Promise<number> {
  if (DEMO) {
    await wait(600);
    const a = demoAnnouncements.find((x) => x.id === id)!;
    const n = await audienceCount(a.audience);
    Object.assign(a, { status: "sent", sentAt: new Date().toISOString(), recipientsCount: n });
    demoLog("announcement.send", undefined, `${n} destinataires`);
    return n;
  }
  const r = await sb().rpc("admin_send_announcement", { p_id: id });
  if (r.error) throw new Error(/ALREADY_SENT/.test(r.error.message) ? "Cette annonce a déjà été envoyée." : adminError(r.error.message));
  return Number(r.data);
}

export async function deleteAnnouncement(id: string) {
  if (DEMO) { await wait(); demoAnnouncements.splice(demoAnnouncements.findIndex((x) => x.id === id), 1); return; }
  check(await sb().from("announcements").delete().eq("id", id).eq("status", "draft"));
}

/* ================================================================== */
/* Pages, FAQ, textes                                                  */
/* ================================================================== */
export type SitePage = { slug: string; title: string; body: string; isPublished: boolean; updatedAt?: string };
export type Faq = { id: string; audience: "couples" | "prestataires"; question: string; answer: string; sort: number; isPublished: boolean };
export type Setting = { key: string; value: unknown; isPublic: boolean; updatedAt?: string };

const demoPages: SitePage[] = [
  { slug: "cgu", title: "Conditions d’utilisation", body: "", isPublished: false },
  { slug: "confidentialite", title: "Politique de confidentialité", body: "", isPublished: false },
  { slug: "mentions-legales", title: "Mentions légales", body: "", isPublished: false },
];
const demoFaqs: Faq[] = [
  { id: "f1", audience: "couples", question: "La demande de devis est-elle gratuite ?", answer: "Oui. Envoyer une demande est gratuit et sans engagement, sans créer de compte.", sort: 1, isPublished: true },
  { id: "f2", audience: "couples", question: "Comment sont vérifiés les prestataires ?", answer: "Chaque vitrine est relue par l’équipe NDOA avant sa mise en ligne. Le badge Vérifié signale les prestataires dont l’identité a été contrôlée.", sort: 2, isPublished: true },
  { id: "f3", audience: "prestataires", question: "Combien coûte une vitrine ?", answer: "L’offre Gratuit permet de publier une vitrine complète. Les offres Pro et Prestige ajoutent vidéos, stories et statistiques avancées.", sort: 3, isPublished: true },
];
const demoSettings: Setting[] = [
  { key: "accueil.hero", value: { titre: "", sous_titre: "" }, isPublic: true },
  { key: "general.contact", value: { email: "bonjour@ndoa.cd", whatsapp: "" }, isPublic: true },
  { key: "moderation.validation_obligatoire", value: true, isPublic: false },
];

export async function getContent(): Promise<{ pages: SitePage[]; faqs: Faq[]; settings: Setting[] }> {
  if (DEMO) { await wait(); return structuredClone({ pages: demoPages, faqs: demoFaqs, settings: demoSettings }); }
  const c = sb();
  const [p, f, s] = await Promise.all([c.from("site_pages").select("*").order("slug"), c.from("faqs").select("*").order("sort"), c.from("site_settings").select("*").order("key")]);
  check(p); check(f); check(s);
  return {
    pages: ((p.data ?? []) as Row[]).map((x) => ({ slug: String(x.slug), title: String(x.title), body: String(x.body ?? ""), isPublished: !!x.is_published, updatedAt: S(x.updated_at) })),
    faqs: ((f.data ?? []) as Row[]).map((x) => ({ id: String(x.id), audience: x.audience as Faq["audience"], question: String(x.question), answer: String(x.answer), sort: Number(x.sort), isPublished: !!x.is_published })),
    settings: ((s.data ?? []) as Row[]).map((x) => ({ key: String(x.key), value: x.value, isPublic: !!x.is_public, updatedAt: S(x.updated_at) })),
  };
}

export async function savePage(p: SitePage) {
  if (DEMO) { await wait(); Object.assign(demoPages.find((x) => x.slug === p.slug)!, p); demoLog("site_pages.update", undefined); return; }
  const me = (await sb().auth.getUser()).data.user?.id;
  check(await sb().from("site_pages").update({ title: p.title, body: p.body, is_published: p.isPublished, updated_at: new Date().toISOString(), updated_by: me }).eq("slug", p.slug));
  void revalidatePublic([`page-${p.slug}`, "pages"]);
}

export async function saveFaq(f: Omit<Faq, "id" | "sort"> & { id?: string }) {
  if (DEMO) {
    await wait();
    if (f.id) Object.assign(demoFaqs.find((x) => x.id === f.id)!, f); else demoFaqs.push({ ...f, id: uid(), sort: demoFaqs.length + 1 });
    return;
  }
  const c = sb();
  const row = { audience: f.audience, question: f.question, answer: f.answer, is_published: f.isPublished, updated_at: new Date().toISOString() };
  if (f.id) check(await c.from("faqs").update(row).eq("id", f.id));
  else { const { count } = await c.from("faqs").select("id", { count: "exact", head: true }); check(await c.from("faqs").insert({ ...row, sort: (count ?? 0) + 1 })); }
  void revalidatePublic(["faq", "pages"]);
}
export async function deleteFaq(id: string) {
  if (DEMO) { await wait(); demoFaqs.splice(demoFaqs.findIndex((x) => x.id === id), 1); return; }
  check(await sb().from("faqs").delete().eq("id", id));
  void revalidatePublic(["faq", "pages"]);
}
export async function reorderFaqs(ids: string[]) {
  if (DEMO) { await wait(120); ids.forEach((id, i) => { const f = demoFaqs.find((x) => x.id === id); if (f) f.sort = i + 1; }); demoFaqs.sort((a, b) => a.sort - b.sort); return; }
  check(await sb().rpc("admin_reorder", { p_kind: "faqs", p_ids: ids }));
  void revalidatePublic(["faq", "pages"]);
}

export async function saveSetting(key: string, value: unknown) {
  if (DEMO) { await wait(); const s = demoSettings.find((x) => x.key === key); if (s) s.value = value; demoLog("site_settings.update", undefined); return; }
  const me = (await sb().auth.getUser()).data.user?.id;
  check(await sb().from("site_settings").update({ value, updated_at: new Date().toISOString(), updated_by: me }).eq("key", key));
  void revalidatePublic(["accueil", "pages"]);
}

/* ================================================================== */
/* Équipe et journal                                                   */
/* ================================================================== */
export async function inviteStaff(email: string, role: "admin" | "moderateur"): Promise<{ invited: boolean }> {
  if (DEMO) {
    await wait();
    const u = demoUsers.find((x) => x.email === email.toLowerCase());
    if (u) { u.role = role; return { invited: false }; }
    demoUsers.push({ id: uid(), email, role, createdAt: new Date().toISOString(), vendors: 0, inquiries: 0, providers: ["email"], favorites: 0, follows: 0, vendorList: [], inquiryList: [] });
    return { invited: true };
  }
  const r = await api("/api/admin/team", "POST", { email, role });
  return { invited: !!r.invited };
}

export async function setRole(userId: string, role: UserRole) {
  if (DEMO) { await wait(); const u = demoUsers.find((x) => x.id === userId); if (u) u.role = role; demoLog("user.role", undefined, role); return; }
  const r = await sb().rpc("admin_set_role", { p_user: userId, p_role: role });
  if (r.error) throw new Error(/ROLE_SELF_CHANGE/.test(r.error.message) ? "Vous ne pouvez pas modifier votre propre rôle." : adminError(r.error.message));
}

export type AuditRow = { id: string; action: string; actor: string; actorRole?: string; targetType: string; targetId?: string; vendorId?: string; reason?: string; details: unknown; createdAt: string };
export type AuditFilters = { action: string; actor: string; from: string; to: string; page: number; pageSize: number };

export async function listAudit(f: AuditFilters): Promise<{ rows: AuditRow[]; total: number; actions: string[]; actors: { id: string; name: string }[] }> {
  if (DEMO) {
    await wait();
    const base: AuditRow[] = [
      ...demo.audit.map((a) => ({ id: a.id, action: a.action, actor: a.actor, actorRole: a.actorRole, targetType: a.action.split(".")[0], targetId: a.vendorId, vendorId: a.vendorId, reason: a.reason, details: {}, createdAt: a.createdAt })),
      { id: "d1", action: "vendor.approve", actor: "Christelle (modération)", actorRole: "moderateur", targetType: "vendors", targetId: "demo-2", vendorId: "demo-2", details: { status: ["pending_review", "published"] }, createdAt: ago(20) },
      { id: "d2", action: "media.hide", actor: "Christelle (modération)", actorRole: "moderateur", targetType: "media", targetId: "m-16-0", vendorId: "demo-17", reason: "inapproprie", details: { is_hidden: [false, true] }, createdAt: ago(70) },
      { id: "d3", action: "vendor.suspend", actor: "Admin démo", actorRole: "admin", targetType: "vendors", targetId: "demo-17", vendorId: "demo-17", reason: "Plusieurs signalements de fausses annonces", details: { status: ["published", "suspended"] }, createdAt: ago(72) },
      { id: "d4", action: "plans.update", actor: "Admin démo", actorRole: "admin", targetType: "plans", targetId: "pro", details: { price_cdf: [50000, 55000] }, createdAt: ago(240) },
      { id: "d5", action: "export.csv", actor: "Admin démo", actorRole: "admin", targetType: "vendors", targetId: "18", details: {}, createdAt: ago(300) },
    ];
    const rows = base.filter((r) => (!f.action || r.action === f.action) && (!f.actor || r.actor === f.actor) && (!f.from || r.createdAt >= f.from) && (!f.to || r.createdAt <= `${f.to}T23:59:59`));
    return { rows: rows.slice((f.page - 1) * f.pageSize, f.page * f.pageSize), total: rows.length, actions: [...new Set(base.map((r) => r.action))].sort(), actors: [...new Set(base.map((r) => r.actor))].map((n) => ({ id: n, name: n })) };
  }
  const c = sb();
  let q = c.from("audit_logs").select("id, action, actor_id, actor_role, target_type, target_id, vendor_id, reason, details, created_at, actor:profiles!audit_logs_actor_id_fkey(full_name)", { count: "exact" });
  if (f.action) q = q.eq("action", f.action);
  if (f.actor) q = q.eq("actor_id", f.actor);
  if (f.from) q = q.gte("created_at", f.from);
  if (f.to) q = q.lte("created_at", `${f.to}T23:59:59`);
  const [r, staff] = await Promise.all([
    q.order("created_at", { ascending: false }).range((f.page - 1) * f.pageSize, f.page * f.pageSize - 1),
    c.from("profiles").select("id, full_name, role").in("role", ["admin", "moderateur"]),
  ]);
  check(r);
  const ACTIONS = ["vendor.approve", "vendor.reject", "vendor.verify", "vendor.unverify", "vendor.suspend", "vendor.unsuspend", "vendor.delete", "vendor.view_as", "media.hide", "media.approve", "media.delete", "review.hide", "review.approve", "review.delete", "user.role", "user.suspend", "user.unsuspend", "user.delete", "user.view", "invoice.refund", "subscription.set", "announcement.send", "inquiry.nudge", "export.csv", "plans.update", "categories.update", "site_pages.update", "site_settings.update"];
  return {
    total: r.count ?? 0,
    rows: ((r.data ?? []) as Row[]).map((x) => ({ id: String(x.id), action: String(x.action), actor: String(one(x.actor)?.full_name ?? "Équipe NDOA"), actorRole: S(x.actor_role), targetType: String(x.target_type), targetId: S(x.target_id), vendorId: S(x.vendor_id), reason: S(x.reason), details: x.details, createdAt: String(x.created_at) })),
    actions: ACTIONS,
    actors: ((staff.data ?? []) as Row[]).map((x) => ({ id: String(x.id), name: String(x.full_name ?? "Sans nom") })),
  };
}
