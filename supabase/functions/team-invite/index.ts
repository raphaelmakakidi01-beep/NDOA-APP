// POST { vendorId, email, role } — réservé aux gérants et au propriétaire ; respecte le nombre de places de l'offre
import { admin, asUser, cors, json } from "../_shared/payments.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return cors();
  const { vendorId, email, role } = await req.json();
  if (!["manager", "editor", "viewer"].includes(role) || !/^\S+@\S+\.\S+$/.test(email ?? "")) return json({ error: "BAD_INPUT" }, 400);

  const user = asUser(req);
  const { data: allowed } = await user.rpc("has_vendor_role", { v: vendorId, min_role: "manager" });
  if (!allowed) return json({ error: "FORBIDDEN" }, 403);

  const db = admin();
  const [{ data: sub }, { count }] = await Promise.all([
    db.from("subscriptions").select("plans(limits)").eq("vendor_id", vendorId).maybeSingle(),
    db.from("vendor_members").select("id", { count: "exact", head: true }).eq("vendor_id", vendorId).neq("status", "revoked"),
  ]);
  const seats = Number((sub?.plans as { limits?: { team_seats?: number } } | null)?.limits?.team_seats ?? 1);
  if ((count ?? 0) >= seats) return json({ error: "QUOTA_SEATS" }, 409);

  const { error } = await db.from("vendor_members").insert({ vendor_id: vendorId, invited_email: email.toLowerCase(), role, status: "invited" });
  if (error) return json({ error: "ALREADY_MEMBER" }, 409);
  // Lien magique Supabase : l'invité crée son mot de passe, le trigger on_auth_user lie la ligne vendor_members
  await db.auth.admin.inviteUserByEmail(email, { redirectTo: `${Deno.env.get("SITE_URL")}/espace` });
  return json({ ok: true });
});
