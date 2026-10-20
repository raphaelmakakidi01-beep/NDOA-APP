// POST { plan, months, currency, method, phone?, returnUrl }  →  { ref, redirectUrl? }
// Seul le propriétaire de la vitrine peut payer (vérifié via RLS avec son jeton).
import { admin, asUser, cors, json, priceOf, provider } from "../_shared/payments.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return cors();
  const { plan, months, currency, method, phone, returnUrl } = await req.json();
  if (!["pro", "prestige"].includes(plan) || ![1, 12].includes(months) || !["USD", "CDF"].includes(currency)) return json({ error: "BAD_INPUT" }, 400);
  if (method !== "card" && !/^\+243\d{9}$/.test(phone ?? "")) return json({ error: "BAD_PHONE" }, 400);

  const user = asUser(req);
  const { data: auth } = await user.auth.getUser();
  if (!auth.user) return json({ error: "UNAUTHENTICATED" }, 401);
  const { data: vendor } = await user.from("vendors").select("id").eq("owner_id", auth.user.id).single();
  if (!vendor) return json({ error: "FORBIDDEN" }, 403);

  const amount = await priceOf(plan, currency, months);
  const ref = `ecl_${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`;
  await admin().from("payment_intents").insert({ ref, vendor_id: vendor.id, plan_id: plan, months, amount, currency, method });

  try {
    const r = await provider.charge({ ref, amount, currency, method, phone, returnUrl, callbackUrl: `${Deno.env.get("SUPABASE_URL")}/functions/v1/payments-webhook` });
    return json({ ref, redirectUrl: r.redirectUrl });
  } catch {
    await admin().from("payment_intents").update({ status: "failed" }).eq("ref", ref);
    return json({ error: "PROVIDER_ERROR" }, 502);
  }
});
