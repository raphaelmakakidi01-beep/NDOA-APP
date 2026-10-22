import { NextResponse, type NextRequest } from "next/server";
import { getStaffSession } from "@/lib/supabase/server";
import { getServiceSupabase } from "@/lib/supabase/service";

/**
 * Inviter un membre de l'équipe (admin ou modérateur).
 * - Compte existant : rôle attribué en base (admin_set_role_by_email, journalisé).
 * - Nouvelle adresse : invitation e-mail Supabase (clé serveur), puis rôle attribué.
 */
export async function POST(request: NextRequest) {
  const session = await getStaffSession();
  if (!session) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as { email?: string; role?: string };
  const email = String(body.email ?? "").trim().toLowerCase();
  const role = body.role === "admin" ? "admin" : "moderateur";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "EMAIL_INVALID" }, { status: 400 });

  const existing = await session.sb.rpc("admin_set_role_by_email", { p_email: email, p_role: role });
  if (!existing.error) return NextResponse.json({ ok: true, invited: false });
  if (!/NOT_FOUND/.test(existing.error.message)) return NextResponse.json({ error: "FAILED" }, { status: 400 });

  const service = getServiceSupabase();
  if (!service) return NextResponse.json({ error: "SERVICE_KEY_MISSING" }, { status: 501 });
  const inv = await service.auth.admin.inviteUserByEmail(email, { redirectTo: `${request.nextUrl.origin}/auth/callback?suite=/admin` });
  if (inv.error || !inv.data.user) return NextResponse.json({ error: "INVITE_FAILED" }, { status: 400 });
  // le profil est créé par le trigger d'inscription ; le rôle est posé avec la session de l'admin (journal)
  const set = await session.sb.rpc("admin_set_role", { p_user: inv.data.user.id, p_role: role });
  if (set.error) return NextResponse.json({ error: "ROLE_FAILED" }, { status: 400 });
  return NextResponse.json({ ok: true, invited: true });
}
