// Appelé par l'agrégateur. Corps signé (HMAC) : { ref, status: "paid" | "failed", account? }
// Idempotent : un même événement reçu deux fois n'active l'abonnement qu'une fois.
import { admin, json, provider } from "../_shared/payments.ts";

Deno.serve(async (req) => {
  const raw = await req.text();
  if (!(await provider.verify(raw, req.headers.get("x-signature")))) return json({ error: "BAD_SIGNATURE" }, 401);
  const { ref, status, account } = JSON.parse(raw) as { ref: string; status: "paid" | "failed"; account?: string };
  const db = admin();

  const { data: intent } = await db.from("payment_intents").select("*").eq("ref", ref).single();
  if (!intent) return json({ error: "UNKNOWN_REF" }, 404);
  if (intent.status !== "pending") return json({ ok: true, duplicate: true });

  await db.from("payment_intents").update({ status, provider_payload: JSON.parse(raw), updated_at: new Date().toISOString() }).eq("ref", ref);
  if (status !== "paid") {
    await db.from("notifications").insert({ user_id: (await owner(intent.vendor_id)), type: "billing", title: "Paiement refusé", body: "Votre abonnement n'a pas été modifié.", link: "/espace/abonnement" });
    return json({ ok: true });
  }

  // Prolonge depuis la fin de la période en cours si elle n'est pas échue
  const { data: sub } = await db.from("subscriptions").select("current_period_end").eq("vendor_id", intent.vendor_id).maybeSingle();
  const start = sub?.current_period_end && new Date(sub.current_period_end) > new Date() ? new Date(sub.current_period_end) : new Date();
  const end = new Date(start); end.setMonth(end.getMonth() + intent.months);

  await db.from("subscriptions").upsert({
    vendor_id: intent.vendor_id, plan_id: intent.plan_id, status: "active", billing_currency: intent.currency,
    current_period_end: end.toISOString(), cancel_at_period_end: false, provider: "mobile-money", provider_ref: ref,
    provider_method: intent.method, provider_account: account ?? null, updated_at: new Date().toISOString(),
  });
  const year = new Date().getFullYear();
  const { count } = await db.from("invoices").select("id", { count: "exact", head: true }).like("number", `FAC-${year}-%`);
  await db.from("invoices").insert({
    vendor_id: intent.vendor_id, number: `FAC-${year}-${String((count ?? 0) + 1).padStart(6, "0")}`, plan_id: intent.plan_id, months: intent.months,
    amount: intent.amount, currency: intent.currency, method: intent.method, status: "paid", provider_ref: ref,
    period_start: start.toISOString().slice(0, 10), period_end: end.toISOString().slice(0, 10), paid_at: new Date().toISOString(),
  });
  // Le PDF de facture est généré par la fonction `invoice-pdf` (déclenchée par un webhook de base sur invoices)
  return json({ ok: true });
});

async function owner(vendorId: string) {
  const { data } = await admin().from("vendors").select("owner_id").eq("id", vendorId).single();
  return data?.owner_id;
}
