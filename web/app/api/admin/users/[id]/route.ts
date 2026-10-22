import { NextResponse, type NextRequest } from "next/server";
import { getStaffSession } from "@/lib/supabase/server";
import { getServiceSupabase } from "@/lib/supabase/service";

const fail = (message: string) => {
  const code = /HAS_VENDOR|STAFF_ACCOUNT|SELF_FORBIDDEN|REASON_REQUIRED|NOT_FOUND|ADMIN_ONLY/.exec(message)?.[0] ?? "FAILED";
  return NextResponse.json({ error: code }, { status: code === "ADMIN_ONLY" ? 403 : 400 });
};

async function adminSession() {
  const session = await getStaffSession();
  if (!session) return { error: NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }) };
  if (session.role !== "admin") return { error: NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }) };
  return { session };
}

/**
 * Suspension d'un compte : droits retirés en base (journalisé au nom de l'admin),
 * puis connexion bloquée dans Supabase Auth (clé serveur).
 */
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/admin/users/[id]">) {
  const { id } = await ctx.params;
  const { session, error } = await adminSession();
  if (error) return error;
  const body = (await request.json().catch(() => ({}))) as { suspend?: boolean; reason?: string };
  const r = await session.sb.rpc("admin_suspend_user", { p_user: id, p_suspend: !!body.suspend, p_reason: body.reason ?? null });
  if (r.error) return fail(r.error.message);
  const service = getServiceSupabase();
  if (service) await service.auth.admin.updateUserById(id, { ban_duration: body.suspend ? "876000h" : "none" });
  return NextResponse.json({ ok: true, loginBlocked: !!service });
}

/**
 * Droit à l'effacement : anonymisation des demandes + effacement du profil (base, journalisé),
 * puis suppression du compte Auth (clé serveur). Refusé si le compte possède une vitrine ou fait partie de l'équipe.
 */
export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/admin/users/[id]">) {
  const { id } = await ctx.params;
  const { session, error } = await adminSession();
  if (error) return error;
  const service = getServiceSupabase();
  if (!service) return NextResponse.json({ error: "SERVICE_KEY_MISSING" }, { status: 501 });
  const body = (await request.json().catch(() => ({}))) as { reason?: string };
  const r = await session.sb.rpc("admin_prepare_user_deletion", { p_user: id, p_reason: body.reason ?? "" });
  if (r.error) return fail(r.error.message);
  const del = await service.auth.admin.deleteUser(id);
  if (del.error) return NextResponse.json({ error: "AUTH_DELETE_FAILED" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
