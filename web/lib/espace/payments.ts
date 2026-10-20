"use client";

import { getSupabase } from "@/lib/supabase/client";
import type { Currency, PaymentMethod, PlanId } from "./types";

/* =========================================================
   Interface de paiement générique
   ---------------------------------------------------------
   L’agrégateur (FlexPay, MaxiCash, CinetPay…) n’est pas encore
   choisi : l’interface ne dépend d’aucun fournisseur.
   - Mobile Money : push USSD sur le téléphone, puis on interroge
     le statut jusqu’à confirmation (le webhook signé du fournisseur
     active l’abonnement côté serveur).
   - Carte : redirection vers la page hébergée du fournisseur
     (aucune donnée de carte ne transite par NDOA).
   ========================================================= */

export type CheckoutInput = { plan: PlanId; months: 1 | 12; currency: Currency; method: PaymentMethod; phone?: string };
export type CheckoutStart =
  | { ok: true; ref: string; next: "confirm_on_phone" }
  | { ok: true; ref: string; next: "redirect"; url: string }
  | { ok: false; error: string };
export type CheckoutStatus = "pending" | "paid" | "failed" | "expired";

export interface PaymentProvider {
  start(input: CheckoutInput): Promise<CheckoutStart>;
  status(ref: string): Promise<CheckoutStatus>;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Démo : le « téléphone » confirme après ~5 s ; un numéro finissant par 00 simule un refus */
const demoProvider: PaymentProvider = {
  async start(input) {
    await wait(900);
    const ref = `demo_${Date.now().toString(36)}`;
    sessionStorage.setItem(ref, JSON.stringify({ at: Date.now(), fail: input.phone?.replace(/\D/g, "").endsWith("00") }));
    if (input.method === "card") return { ok: true, ref, next: "redirect", url: "#demo-card" };
    return { ok: true, ref, next: "confirm_on_phone" };
  },
  async status(ref) {
    const raw = sessionStorage.getItem(ref);
    if (!raw) return "expired";
    const { at, fail } = JSON.parse(raw) as { at: number; fail?: boolean };
    if (Date.now() - at < 5000) return "pending";
    return fail ? "failed" : "paid";
  },
};

/** Supabase : Edge Functions `payments-initiate` et `payments-status` */
const serverProvider: PaymentProvider = {
  async start(input) {
    const sb = getSupabase()!;
    const { data, error } = await sb.functions.invoke("payments-initiate", { body: { ...input, returnUrl: `${location.origin}/espace/abonnement?retour=1` } });
    if (error || !data?.ref) return { ok: false, error: "Le paiement n’a pas pu démarrer. Vérifiez le numéro et réessayez." };
    return data.redirectUrl ? { ok: true, ref: data.ref, next: "redirect", url: data.redirectUrl } : { ok: true, ref: data.ref, next: "confirm_on_phone" };
  },
  async status(ref) {
    const sb = getSupabase()!;
    const { data } = await sb.functions.invoke("payments-status", { body: { ref } });
    return (data?.status as CheckoutStatus) ?? "pending";
  },
};

export const payments = (): PaymentProvider => (getSupabase() ? serverProvider : demoProvider);

/** Numéro RDC valide pour l’opérateur choisi (9 chiffres après +243) */
export function mobileMoneyError(method: PaymentMethod, local: string, prefixes?: string[]) {
  const d = local.replace(/\D/g, "").replace(/^0/, "");
  if (d.length !== 9) return "Saisissez les 9 chiffres de votre numéro (sans le 0 initial).";
  if (prefixes && !prefixes.includes(d.slice(0, 2))) return `Ce numéro ne semble pas être un numéro ${method === "mpesa" ? "Vodacom M-Pesa" : method === "orange_money" ? "Orange" : "Airtel"} (commence par ${prefixes.join(", ")}).`;
  return null;
}
