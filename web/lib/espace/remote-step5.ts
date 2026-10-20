"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/client";
import { DEFAULT_PREFS } from "./demo";
import type { EspaceData, Invoice, Locale, Member, MemberRole, NotifChannel, NotifPrefs, NotifType, ReviewRequest, Subscription } from "./types";

/* =========================================================
   Supabase — avis, statistiques, abonnement, équipe, préférences
   Les paiements et l’abonnement ne sont JAMAIS écrits depuis le
   navigateur : ils passent par des Edge Functions (clé service).
   ========================================================= */

type Row = Record<string, unknown>;
const fromDb = (amount: unknown, currency: unknown) => Number(amount) / (currency === "USD" ? 100 : 1);

export async function loadStep5(sb: SupabaseClient, vendorId: string, userId: string, email: string | undefined): Promise<Pick<EspaceData, "reviewRequests" | "subscription" | "invoices" | "members" | "notifPrefs" | "settings" | "topPhotos" | "benchmark">> {
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const [rr, sub, inv, mem, prefs, prof, top, bench] = await Promise.all([
    sb.from("review_requests").select("*, inquiries(couple_names)").eq("vendor_id", vendorId).order("created_at", { ascending: false }).limit(50),
    sb.from("subscriptions").select("*").eq("vendor_id", vendorId).maybeSingle(),
    sb.from("invoices").select("*").eq("vendor_id", vendorId).order("created_at", { ascending: false }).limit(36),
    sb.from("vendor_members").select("*, profiles(full_name)").eq("vendor_id", vendorId).neq("status", "revoked"),
    sb.from("notification_prefs").select("*").eq("user_id", userId),
    sb.from("profiles").select("locale").eq("id", userId).maybeSingle(),
    sb.rpc("top_photos", { p_vendor: vendorId, p_since: since }),
    sb.rpc("category_benchmark", { p_vendor: vendorId }),
  ]);
  const rows = (r: { data: unknown }) => (r.data ?? []) as Row[];

  const notifPrefs: NotifPrefs = JSON.parse(JSON.stringify(DEFAULT_PREFS));
  rows(prefs).forEach((p) => { const t = p.type as NotifType; if (notifPrefs[t]) notifPrefs[t][p.channel as NotifChannel] = !!p.enabled; });

  const s = sub.data as Row | null;
  const subscription: Subscription = {
    plan: (s?.plan_id as Subscription["plan"]) ?? "free", status: (s?.status as Subscription["status"]) ?? "active", currency: (s?.billing_currency as Subscription["currency"]) ?? "USD",
    periodEnd: (s?.current_period_end as string | undefined)?.slice(0, 10), cancelAtPeriodEnd: !!s?.cancel_at_period_end,
    method: (s?.provider_method as Subscription["method"]) ?? undefined, account: (s?.provider_account as string) ?? undefined,
  };
  const b = (bench.data as Row[] | Row | null);
  const bRow = (Array.isArray(b) ? b[0] : b) ?? {};
  return {
    reviewRequests: rows(rr).map((r): ReviewRequest => ({
      token: String(r.token), inquiryId: (r.inquiry_id as string) ?? undefined, couple: (r.inquiries as { couple_names: string } | null)?.couple_names ?? String(r.sent_to ?? "Lien libre"),
      channel: (r.channel as ReviewRequest["channel"]) ?? "lien", sentTo: (r.sent_to as string) ?? undefined, expiresAt: String(r.expires_at), usedAt: (r.used_at as string) ?? undefined, createdAt: String(r.created_at),
    })),
    subscription,
    invoices: rows(inv).map((i): Invoice => ({
      id: String(i.id), number: String(i.number), plan: i.plan_id as Invoice["plan"], months: Number(i.months ?? 1), amount: fromDb(i.amount, i.currency), currency: i.currency as Invoice["currency"],
      method: i.method as Invoice["method"], status: i.status as Invoice["status"], periodStart: String(i.period_start), periodEnd: String(i.period_end), paidAt: (i.paid_at as string) ?? undefined, createdAt: String(i.created_at),
    })),
    members: rows(mem).map((m): Member => ({
      id: String(m.id), name: (m.profiles as { full_name: string } | null)?.full_name ?? undefined, email: String(m.invited_email ?? (m.user_id === userId ? email ?? "" : "")),
      role: m.role as MemberRole, status: m.status as Member["status"], invitedAt: String(m.created_at), you: m.user_id === userId,
    })),
    notifPrefs,
    settings: {
      locale: ((prof.data as Row | null)?.locale as Locale) ?? "fr", displayCurrency: "USD", twoFactor: false, paused: false,
      sessions: [{ id: "current", device: "Ce navigateur", place: "", lastActiveAt: new Date().toISOString(), current: true }],
    },
    topPhotos: rows(top).map((t) => ({ mediaId: String(t.media_id), views: Number(t.views), contacts: Number(t.contacts) })),
    benchmark: {
      views: Number(bRow.views ?? 0), ctr: Number(bRow.ctr ?? 0), responseHours: Number(bRow.response_hours ?? 0),
      conversion: Number(bRow.conversion ?? 0), rating: Number(bRow.rating ?? 0), vendors: Number(bRow.vendors ?? 0),
    },
  };
}

export const remote5 = {
  async replyReview(id: string, reply: string | null) {
    const sb = getSupabase(); if (!sb) return true;
    const { error } = await sb.from("reviews").update({ reply, replied_at: reply ? new Date().toISOString() : null }).eq("id", id);
    return !error;
  },
  /** Crée un lien unique (60 jours) ; renvoie le jeton généré par la base */
  async createReviewRequest(vendorId: string | undefined, r: Omit<ReviewRequest, "token" | "createdAt" | "expiresAt">) {
    const sb = getSupabase(); if (!sb || !vendorId) return null;
    const { data, error } = await sb.from("review_requests").insert({ vendor_id: vendorId, inquiry_id: r.inquiryId ?? null, sent_to: r.sentTo ?? r.couple, channel: r.channel }).select("token, expires_at, created_at").single();
    return error ? null : (data as { token: string; expires_at: string; created_at: string });
  },
  async savePref(userId: string, type: NotifType, channel: NotifChannel, enabled: boolean) {
    const sb = getSupabase(); if (!sb) return;
    await sb.from("notification_prefs").upsert({ user_id: userId, type, channel, enabled });
  },
  /** L’e-mail d’invitation part d’une Edge Function (lien signé, valable 7 jours) */
  async inviteMember(vendorId: string | undefined, email: string, role: MemberRole) {
    const sb = getSupabase(); if (!sb || !vendorId) return { ok: true as const };
    const { error } = await sb.functions.invoke("team-invite", { body: { vendorId, email, role } });
    return error ? { ok: false as const, error: "L’invitation n’a pas pu être envoyée." } : { ok: true as const };
  },
  async setRole(id: string, role: MemberRole) { const sb = getSupabase(); if (sb) await sb.from("vendor_members").update({ role }).eq("id", id); },
  async revoke(id: string) { const sb = getSupabase(); if (sb) await sb.from("vendor_members").update({ status: "revoked" }).eq("id", id); },
  async setLocale(userId: string, locale: Locale) { const sb = getSupabase(); if (sb) await sb.from("profiles").update({ locale }).eq("id", userId); },
  /** Mettre la vitrine en pause = la dépublier (elle reste intacte) */
  async setPaused(vendorId: string | undefined, paused: boolean) {
    const sb = getSupabase(); if (!sb || !vendorId) return;
    await sb.from("vendors").update({ status: paused ? "draft" : "published" }).eq("id", vendorId);
  },
  async cancelAtPeriodEnd(vendorId: string | undefined, cancel: boolean) {
    const sb = getSupabase(); if (!sb || !vendorId) return true;
    const { error } = await sb.functions.invoke("subscription-cancel", { body: { vendorId, cancel } });
    return !error;
  },
  async invoiceUrl(vendorId: string | undefined, id: string) {
    const sb = getSupabase(); if (!sb || !vendorId) return null;
    const { data } = await sb.storage.from("vendor-private").createSignedUrl(`${vendorId}/invoices/${id}.pdf`, 120);
    return data?.signedUrl ?? null;
  },
  async deleteAccount() {
    const sb = getSupabase(); if (!sb) return true;
    const { error } = await sb.functions.invoke("account-delete", { body: {} });
    return !error;
  },
};
