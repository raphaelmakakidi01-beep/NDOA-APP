import { NextResponse, type NextRequest } from "next/server";
import { DEMO } from "@/lib/config";
import { clientIp, rateLimited, verifyTurnstile } from "@/lib/public/guard";
import { getServerSupabase } from "@/lib/supabase/server";
import { getServiceSupabase } from "@/lib/supabase/service";

/*
 * Demande de devis SANS compte. Anti-spam : Cloudflare Turnstile + limite par IP ici,
 * puis submit_inquiry (base) qui valide les champs et applique ses propres limites.
 * Si le visiteur est connecté (compte couple), la demande est rattachée à son compte (historique).
 */
const MESSAGES: Record<string, string> = {
  RATE_LIMITED: "Vous avez déjà envoyé plusieurs demandes à ce prestataire aujourd’hui. Il vous répondra très vite.",
  DATE_INVALID: "La date du mariage doit être dans le futur (3 ans maximum).",
  CONTACT_REQUIRED: "Laissez un numéro de téléphone ou WhatsApp.",
  EMAIL_INVALID: "L’adresse e-mail semble incorrecte.",
  PHONE_INVALID: "Le numéro de téléphone semble incorrect.",
  NAMES_INVALID: "Indiquez votre nom (2 caractères minimum).",
  VENDOR_NOT_FOUND: "Ce prestataire n’accepte plus de demandes pour le moment.",
};
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (rateLimited(`devis:${ip}`, 8, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Trop de demandes envoyées depuis cette connexion. Réessayez dans une heure." }, { status: 429 });
  }
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
  if (!(await verifyTurnstile(b.turnstile, ip))) {
    return NextResponse.json({ error: "La vérification anti-spam a échoué. Rechargez la page et réessayez." }, { status: 400 });
  }
  const phone = str(b.phone, 30);
  if (!phone) return NextResponse.json({ error: MESSAGES.CONTACT_REQUIRED }, { status: 400 });
  const lieu = str(b.venue, 80);
  const message = [lieu && `Lieu : ${lieu}`, str(b.message, 2800)].filter(Boolean).join("\n");
  if (DEMO) { await new Promise((r) => setTimeout(r, 600)); return NextResponse.json({ ok: true, demo: true }); }

  const sb = await getServerSupabase();
  if (!sb) return NextResponse.json({ error: "Service indisponible." }, { status: 503 });
  const date = str(b.date, 10);
  const args = {
    p_vendor_slug: str(b.slug, 80), p_couple_names: str(b.names, 80), p_email: str(b.email, 120) || null, p_phone: phone,
    p_contact_pref: ["whatsapp", "call", "email"].includes(String(b.pref)) ? b.pref : "whatsapp",
    p_wedding_date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null, p_city: str(b.city, 60) || null,
    p_guests: Number(b.guests) > 0 ? Math.min(5000, Math.round(Number(b.guests))) : null,
    p_package_id: typeof b.packageId === "string" && /^[0-9a-f-]{36}$/.test(b.packageId) ? b.packageId : null,
    p_option_ids: Array.isArray(b.optionIds) ? b.optionIds.filter((x) => typeof x === "string" && /^[0-9a-f-]{36}$/.test(x)).slice(0, 20) : null,
    p_message: message || null, p_source: str(b.source, 30) || "profil",
  };
  // Avec la clé serveur : chemin réservé au site (submit_inquiry_server), fermé au public.
  // Le compte couple éventuel est lu ici, depuis la session vérifiée.
  const service = getServiceSupabase();
  const { data, error } = service
    ? await service.rpc("submit_inquiry_server", { p_couple_user: (await sb.auth.getUser()).data.user?.id ?? null, ...args })
    : await sb.rpc("submit_inquiry", args);
  if (error) {
    const key = Object.keys(MESSAGES).find((k) => error.message.includes(k));
    return NextResponse.json({ error: key ? MESSAGES[key] : "L’envoi a échoué. Vérifiez votre connexion et réessayez." }, { status: key === "RATE_LIMITED" ? 429 : 400 });
  }
  return NextResponse.json({ ok: true, id: data });
}

/**
 * Contrôle de configuration (aucune donnée créée) : le chemin serveur des devis fonctionne-t-il ?
 * Appelle submit_inquiry_server sur une vitrine inexistante : VENDOR_NOT_FOUND prouve que la clé
 * serveur est valide et que la fonction répond. Ne renvoie qu'un booléen.
 */
export async function GET() {
  const service = getServiceSupabase();
  if (!service) return NextResponse.json({ serveur: false }, { headers: { "Cache-Control": "no-store" } });
  const { error } = await service.rpc("submit_inquiry_server", {
    p_couple_user: null, p_vendor_slug: "zz-controle-inexistant", p_couple_names: "Controle", p_email: null, p_phone: "+243810000000",
    p_contact_pref: "whatsapp", p_wedding_date: null, p_city: null, p_guests: null, p_package_id: null, p_option_ids: null, p_message: null, p_source: "controle",
  });
  return NextResponse.json({ serveur: !!error?.message.includes("VENDOR_NOT_FOUND") }, { headers: { "Cache-Control": "no-store" } });
}
