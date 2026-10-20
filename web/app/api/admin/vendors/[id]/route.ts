import { NextResponse, type NextRequest } from "next/server";
import { getStaffSession } from "@/lib/supabase/server";
import { getServiceSupabase } from "@/lib/supabase/service";

/**
 * Suppression définitive d'une vitrine.
 * 1. le rôle est vérifié (proxy + ici + dans la fonction SQL admin_delete_vendor) ;
 * 2. la suppression passe par la session de l'admin → elle est journalisée à son nom ;
 * 3. les fichiers sont ensuite retirés du stockage avec la clé service_role (serveur uniquement).
 */
export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/admin/vendors/[id]">) {
  const { id } = await ctx.params;
  const session = await getStaffSession();
  if (!session) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as { confirmSlug?: string; reason?: string };
  const { error } = await session.sb.rpc("admin_delete_vendor", { p_vendor: id, p_confirm_slug: body.confirmSlug ?? "", p_reason: body.reason ?? "" });
  if (error) {
    const code = /CONFIRMATION_MISMATCH|REASON_REQUIRED|NOT_FOUND|ADMIN_ONLY/.exec(error.message)?.[0] ?? "FAILED";
    return NextResponse.json({ error: code }, { status: code === "ADMIN_ONLY" ? 403 : 400 });
  }

  // Nettoyage du stockage (photos, vidéos, devis PDF) — sans clé serveur, signalé pour un nettoyage manuel
  const service = getServiceSupabase();
  let removed = 0;
  if (service) {
    for (const bucket of ["vendor-media", "vendor-private"]) {
      const paths: string[] = [];
      const walk = async (prefix: string) => {
        const { data } = await service.storage.from(bucket).list(prefix, { limit: 1000 });
        for (const item of data ?? []) {
          const full = `${prefix}/${item.name}`;
          if (item.id) paths.push(full); else await walk(full);   // pas d'id = sous-dossier
        }
      };
      await walk(id);
      for (let i = 0; i < paths.length; i += 100) {
        const { data } = await service.storage.from(bucket).remove(paths.slice(i, i + 100));
        removed += data?.length ?? 0;
      }
    }
  }
  return NextResponse.json({ ok: true, filesRemoved: removed, storageCleaned: !!service });
}
