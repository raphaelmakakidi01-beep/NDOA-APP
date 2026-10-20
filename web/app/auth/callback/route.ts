import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { safeNext } from "@/lib/safe-redirect";

/**
 * Retour OAuth (Google) et lien de confirmation d’e-mail (`source=email`) :
 * échange le code contre une session puis redirige.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const fromEmail = searchParams.get("source") === "email";
  // Lien expiré ou déjà utilisé : Supabase renvoie error / error_code au lieu d’un code
  if (searchParams.get("error")) {
    const expired = /expired|otp/i.test(`${searchParams.get("error_code")} ${searchParams.get("error_description")}`);
    return NextResponse.redirect(new URL(`/connexion?erreur=${fromEmail || expired ? "lien" : "oauth"}`, origin));
  }
  const next = safeNext(searchParams.get("suite"));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (code && url && key) {
    const store = await cookies();
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) => store.set(name, value, options)),
      },
    });
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }
  // Lien ouvert dans un autre navigateur (ex. : appli mail du téléphone) : l’adresse est confirmée
  // côté Supabase, mais la session ne peut pas être ouverte ici → connexion classique.
  return NextResponse.redirect(new URL(fromEmail ? `/connexion?confirme=1&suite=${encodeURIComponent(next)}` : "/connexion?erreur=oauth", origin));
}
