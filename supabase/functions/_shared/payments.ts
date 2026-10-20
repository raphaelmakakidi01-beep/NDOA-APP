// Outils partagés des Edge Functions de paiement (Deno)
import { createClient } from "jsr:@supabase/supabase-js@2";

export const admin = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

/** Client avec le jeton de l'utilisateur : les droits RLS s'appliquent */
export const asUser = (req: Request) =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "access-control-allow-origin": "*" } });

export const cors = () =>
  new Response(null, { headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, content-type, apikey, x-client-info" } });

/** Prix en unités mineures (centimes USD / francs CDF), 12 mois au prix de 10 */
export async function priceOf(planId: string, currency: "USD" | "CDF", months: 1 | 12) {
  const { data } = await admin().from("plans").select("price_usd, price_cdf").eq("id", planId).single();
  if (!data) throw new Error("PLAN_UNKNOWN");
  const monthly = currency === "USD" ? Number(data.price_usd) : Number(data.price_cdf);
  return monthly * (months === 12 ? 10 : 1);
}

/**
 * Adaptateur de l'agrégateur Mobile Money / carte.
 * À implémenter pour le fournisseur retenu (FlexPay, MaxiCash, CinetPay…) :
 * seules ces deux fonctions et la vérification de signature changent.
 */
export const provider = {
  async charge(p: { ref: string; amount: number; currency: string; method: string; phone?: string; returnUrl: string; callbackUrl: string }) {
    const res = await fetch(Deno.env.get("PAYMENT_API_URL")!, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${Deno.env.get("PAYMENT_API_KEY")}` },
      body: JSON.stringify(p),
    });
    if (!res.ok) throw new Error(`PROVIDER_${res.status}`);
    return (await res.json()) as { redirectUrl?: string };
  },
  /** HMAC-SHA256 du corps brut, en hexadécimal, comparé en temps constant */
  async verify(raw: string, signature: string | null) {
    if (!signature) return false;
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(Deno.env.get("PAYMENT_WEBHOOK_SECRET")!), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)));
    const hex = [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
    if (hex.length !== signature.length) return false;
    let diff = 0;
    for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ signature.charCodeAt(i);
    return diff === 0;
  },
};
