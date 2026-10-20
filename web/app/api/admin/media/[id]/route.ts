import { NextResponse, type NextRequest } from "next/server";
import { getStaffSession } from "@/lib/supabase/server";
import { getServiceSupabase } from "@/lib/supabase/service";

/**
 * Suppression d'une photo ou vidéo par la modération.
 * La décision passe par admin_moderate (session du modérateur → journal d'audit à son nom),
 * puis le fichier est retiré du stockage avec la clé serveur.
 */
export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/admin/media/[id]">) {
  const { id } = await ctx.params;
  const session = await getStaffSession();
  if (!session) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (session.role !== "admin" && session.role !== "moderateur") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as { reason?: string; note?: string };
  // chemins lus avant suppression (le staff peut lire tous les médias)
  const { data: m } = await session.sb.from("media").select("storage_path, poster_path").eq("id", id).maybeSingle();
  const { error } = await session.sb.rpc("admin_moderate", { p_target_type: "media", p_target_id: id, p_action: "delete", p_reason: body.reason ?? null, p_note: body.note ?? null });
  if (error) {
    const code = /REASON_REQUIRED|NOT_FOUND|ADMIN_ONLY/.exec(error.message)?.[0] ?? "FAILED";
    return NextResponse.json({ error: code }, { status: code === "ADMIN_ONLY" ? 403 : 400 });
  }
  const service = getServiceSupabase();
  const paths = [m?.storage_path, m?.poster_path].filter(Boolean) as string[];
  if (service && paths.length) await service.storage.from("vendor-media").remove(paths);
  return NextResponse.json({ ok: true, storageCleaned: !!service });
}
