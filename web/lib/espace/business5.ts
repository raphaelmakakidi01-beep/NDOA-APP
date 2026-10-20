"use client";

import { useMemo } from "react";
import { toast } from "sonner";
import { getSupabase } from "@/lib/supabase/client";
import { uid } from "@/lib/utils";
import { useEspace } from "./store";
import { remote5 } from "./remote-step5";
import {
  OFFERS, PLANS, ROLES, offerPrice,
  type Currency, type Invoice, type Locale, type MemberRole, type NotifChannel, type NotifType, type PaymentMethod, type PlanId, type ReviewRequest, type Settings,
} from "./types";

/* =========================================================
   Règles métier de l’étape 5 (avis, équipe, préférences, abonnement)
   ========================================================= */

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addMonths = (from: Date, n: number) => { const d = new Date(from); d.setMonth(d.getMonth() + n); return d; };

/** Lien public de dépôt d’avis */
export const reviewLink = (token: string) => `${typeof location !== "undefined" ? location.origin : ""}/avis/${token}`;

export function useAccount() {
  const { data, vendor, user, patch } = useEspace();
  const vid = vendor.vendorId;

  return useMemo(() => {
    const seats = OFFERS[data.plan].seats;
    const activeMembers = data.members.filter((m) => m.status !== "revoked").length;

    return {
      seats, activeMembers,

      /* ---------- Avis ---------- */
      async reply(id: string, text: string | null) {
        const reply = text?.trim() || null;
        const ok = await remote5.replyReview(id, reply);
        if (!ok) { toast.error("La réponse n’a pas pu être publiée. Réessayez."); return false; }
        patch((d) => ({ ...d, reviews: d.reviews.map((r) => (r.id === id ? { ...r, reply: reply ?? undefined, repliedAt: reply ? new Date().toISOString() : undefined } : r)) }));
        toast.success(reply ? "Réponse publiée sur votre vitrine" : "Réponse retirée");
        return true;
      },
      async createRequest(input: Omit<ReviewRequest, "token" | "createdAt" | "expiresAt">) {
        const res = await remote5.createReviewRequest(vid, input);
        if (getSupabase() && !res) { toast.error("Le lien n’a pas pu être créé."); return null; }
        const rq: ReviewRequest = {
          ...input,
          token: res?.token ?? `demo-${uid().slice(0, 10)}`,
          createdAt: res?.created_at ?? new Date().toISOString(),
          expiresAt: res?.expires_at ?? new Date(Date.now() + 60 * 86400_000).toISOString(),
        };
        patch((d) => ({ ...d, reviewRequests: [rq, ...d.reviewRequests] }));
        return rq;
      },

      /* ---------- Notifications ---------- */
      setPref(type: NotifType, channel: NotifChannel, enabled: boolean) {
        patch((d) => ({ ...d, notifPrefs: { ...d.notifPrefs, [type]: { ...d.notifPrefs[type], [channel]: enabled } } }));
        void remote5.savePref(user.id, type, channel, enabled);
      },

      /* ---------- Équipe ---------- */
      async invite(email: string, role: MemberRole) {
        const e = email.trim().toLowerCase();
        if (data.members.some((m) => m.email === e && m.status !== "revoked")) return { ok: false as const, error: "Cette personne fait déjà partie de l’équipe." };
        if (activeMembers >= seats) return { ok: false as const, error: `Votre offre ${PLANS[data.plan].name} inclut ${seats} place${seats > 1 ? "s" : ""}. Passez à l’offre supérieure pour inviter plus de monde.` };
        const r = await remote5.inviteMember(vid, e, role);
        if (!r.ok) return r;
        patch((d) => ({ ...d, members: [...d.members, { id: uid(), email: e, role, status: "invited", invitedAt: new Date().toISOString() }] }));
        toast.success("Invitation envoyée", { description: `${e} reçoit un lien valable 7 jours pour rejoindre l’équipe en tant que ${ROLES[role].label.toLowerCase()}.` });
        return { ok: true as const };
      },
      setRole(id: string, role: MemberRole) {
        patch((d) => ({ ...d, members: d.members.map((m) => (m.id === id ? { ...m, role } : m)) }));
        void remote5.setRole(id, role);
        toast.success(`Rôle mis à jour : ${ROLES[role].label}`);
      },
      revoke(id: string) {
        const m = data.members.find((x) => x.id === id);
        patch((d) => ({ ...d, members: d.members.filter((x) => x.id !== id) }));
        void remote5.revoke(id);
        toast.success(m?.status === "invited" ? "Invitation annulée" : "Accès retiré", { description: m?.name ?? m?.email });
      },
      resend(id: string) {
        const m = data.members.find((x) => x.id === id);
        if (m) void remote5.inviteMember(vid, m.email, m.role);
        toast.success("Invitation renvoyée", { description: m?.email });
      },

      /* ---------- Réglages ---------- */
      saveSettings(p: Partial<Settings>) {
        patch((d) => ({ ...d, settings: { ...d.settings, ...p } }));
        if (p.locale) void remote5.setLocale(user.id, p.locale as Locale);
        if (p.paused !== undefined) void remote5.setPaused(vid, p.paused);
      },
      revokeSession(id: string) {
        patch((d) => ({ ...d, settings: { ...d.settings, sessions: d.settings.sessions.filter((s) => s.id !== id) } }));
      },

      /* ---------- Abonnement ---------- */
      /** Après confirmation du paiement : en démo on applique localement ; avec Supabase le webhook a déjà tout écrit */
      activate(plan: PlanId, months: 1 | 12, currency: Currency, method: PaymentMethod, account?: string) {
        const start = data.subscription.periodEnd && new Date(data.subscription.periodEnd) > new Date() && data.plan === plan ? new Date(`${data.subscription.periodEnd}T12:00`) : new Date();
        const end = addMonths(start, months);
        const year = new Date().getFullYear();
        const inv: Invoice = {
          id: uid(), number: `FAC-${year}-${String(400 + data.invoices.length).padStart(6, "0")}`, plan, months, amount: offerPrice(plan, currency, months), currency, method,
          status: "paid", periodStart: iso(start), periodEnd: iso(end), paidAt: new Date().toISOString(), createdAt: new Date().toISOString(),
        };
        patch((d) => ({
          ...d, plan,
          subscription: { plan, status: "active", currency, periodEnd: iso(end), cancelAtPeriodEnd: false, method, account },
          invoices: [inv, ...d.invoices],
        }));
        return inv;
      },
      async setCancel(cancel: boolean) {
        const ok = await remote5.cancelAtPeriodEnd(vid, cancel);
        if (!ok) { toast.error("La modification n’a pas pu être enregistrée."); return; }
        patch((d) => ({ ...d, subscription: { ...d.subscription, cancelAtPeriodEnd: cancel } }));
        toast.success(cancel ? "Renouvellement arrêté" : "Renouvellement réactivé", {
          description: cancel ? "Vous gardez vos avantages jusqu’à la fin de la période payée, puis votre vitrine passe à l’offre Gratuit." : "Votre abonnement continue normalement.",
        });
      },
    };
  }, [data, vid, user.id, patch]);
}
