// POST { ref } → { status } ; l'intention expire après 10 minutes sans confirmation
import { admin, asUser, cors, json } from "../_shared/payments.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return cors();
  const { ref } = await req.json();
  // Lecture avec le jeton de l'utilisateur : la RLS limite aux intentions de sa vitrine
  const { data } = await asUser(req).from("payment_intents").select("status, created_at").eq("ref", ref).maybeSingle();
  if (!data) return json({ status: "expired" });
  if (data.status === "pending" && Date.now() - new Date(data.created_at).getTime() > 10 * 60_000) {
    await admin().from("payment_intents").update({ status: "expired" }).eq("ref", ref).eq("status", "pending");
    return json({ status: "expired" });
  }
  return json({ status: data.status });
});
