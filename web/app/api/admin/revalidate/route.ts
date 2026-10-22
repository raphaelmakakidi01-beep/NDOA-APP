import { NextResponse, type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { getStaffSession } from "@/lib/supabase/server";

/** Étiquettes de cache du site public que l'admin peut rafraîchir après une modification */
const ALLOWED = /^(accueil|prestataires|inspiration|pages|faq|prestataire-[a-z0-9-]{1,80}|page-[a-z0-9-]{1,40})$/;

/** Rafraîchit immédiatement les pages publiques concernées (sinon : au plus quelques minutes) */
export async function POST(request: NextRequest) {
  const session = await getStaffSession();
  if (!session) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (session.role !== "admin" && session.role !== "moderateur") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as { tags?: unknown };
  const tags = (Array.isArray(body.tags) ? body.tags : []).filter((t): t is string => typeof t === "string" && ALLOWED.test(t)).slice(0, 20);
  for (const t of tags) revalidateTag(t, "max");
  return NextResponse.json({ ok: true, tags });
}
