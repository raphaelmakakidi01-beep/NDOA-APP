import { NextResponse, type NextRequest } from "next/server";
import { DEMO } from "@/lib/config";
import { getContact } from "@/lib/public/data";
import { clientIp, rateLimited } from "@/lib/public/guard";
import { getServerSupabase } from "@/lib/supabase/server";

/** Numéro de téléphone / WhatsApp d'un prestataire, donné seulement au clic (et compté dans ses statistiques) */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/prestataires/[slug]/contact">) {
  const { slug } = await ctx.params;
  if (rateLimited(`contact:${clientIp(req)}`, 40, 60 * 60 * 1000)) return NextResponse.json({ error: "Trop de demandes." }, { status: 429 });
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  const contact = await getContact(slug);
  if (!contact) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  const kind = req.nextUrl.searchParams.get("type") === "whatsapp" ? "whatsapp_click" : "call_click";
  if (!DEMO) {
    const sb = await getServerSupabase();
    await sb?.rpc("track_event", { p_vendor_slug: slug, p_event: kind, p_source: "profil", p_media_id: null, p_visitor: req.nextUrl.searchParams.get("v") });
  }
  return NextResponse.json(contact, { headers: { "Cache-Control": "no-store" } });
}
