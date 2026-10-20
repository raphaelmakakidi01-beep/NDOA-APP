// POST { vendorId, cancel } — arrêt (ou reprise) du renouvellement à la fin de la période. Propriétaire uniquement.
import { admin, asUser, cors, json } from "../_shared/payments.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return cors();
  const { vendorId, cancel } = await req.json();
  const { data: allowed } = await asUser(req).rpc("has_vendor_role", { v: vendorId, min_role: "owner" });
  if (!allowed) return json({ error: "FORBIDDEN" }, 403);
  await admin().from("subscriptions").update({ cancel_at_period_end: !!cancel, updated_at: new Date().toISOString() }).eq("vendor_id", vendorId);
  return json({ ok: true });
});
