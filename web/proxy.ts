import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { canAccess, STAFF_ROLES } from "@/lib/admin/access";
import { COMING_SOON, PREVIEW_COOKIE, PREVIEW_DAYS, isOpenDuringSoon, isValidPreviewToken, makePreviewToken } from "@/lib/coming-soon";

/**
 * 1. Mode « Bientôt disponible » (lib/coming-soon.ts) : sans laissez-passer, les pages publiques
 *    affichent /bientot. L'équipe NDOA reçoit le laissez-passer en ouvrant /admin, /espace ou /onboarding.
 * 2. Avec Supabase : rafraîchit la session (cookies) et protège /onboarding, /espace et /admin.
 *    /admin/* : rôle lu EN BASE (profiles.role) à chaque requête ; tout non-staff est redirigé.
 *    En mode démo (pas de clés), la protection est faite côté navigateur.
 */
const SESSION_PATHS = /^\/(onboarding|espace|admin|api)(\/|$)/;

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const hasPass = COMING_SOON ? await isValidPreviewToken(request.cookies.get(PREVIEW_COOKIE)?.value) : true;

  // Pages publiques : aucun aller-retour vers Supabase, seulement le mode « Bientôt »
  if (!SESSION_PATHS.test(path)) {
    if (COMING_SOON && !hasPass && !isOpenDuringSoon(path)) {
      const to = request.nextUrl.clone();
      to.pathname = "/bientot";
      to.search = "";
      const res = NextResponse.rewrite(to);
      res.headers.set("Cache-Control", "private, no-store");
      return res;
    }
    return NextResponse.next();
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const forceDemo = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_FORCE_DEMO === "1";
  if (!url || !key || forceDemo) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const toLogin = () => {
    const to = request.nextUrl.clone();
    to.pathname = "/connexion";
    to.search = "";
    to.searchParams.set("suite", path);
    return NextResponse.redirect(to);
  };

  if (/^\/(onboarding|espace)(\/|$)/.test(path) && !data.user) return toLogin();

  let role: string | null = null;
  const readRole = async () => {
    if (!data.user) return null;
    const { data: profile } = await supabase.from("profiles").select("role, suspended_at").eq("id", data.user.id).maybeSingle();
    return profile && !profile.suspended_at ? (profile.role as string) : null;
  };

  if (/^\/(admin|api\/admin)(\/|$)/.test(path)) {
    if (!data.user) return path.startsWith("/api/") ? NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }) : toLogin();
    role = await readRole();
    const pagePath = path.startsWith("/api/admin") ? "/admin" : path;
    if (!canAccess(role, pagePath)) {
      if (path.startsWith("/api/")) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
      const to = request.nextUrl.clone();
      to.search = "";
      // un modérateur sur une section réservée aux admins revient au tableau de bord ; les autres sortent
      to.pathname = role === "moderateur" ? "/admin" : "/espace";
      if (role === "moderateur") to.searchParams.set("refuse", "1");
      return NextResponse.redirect(to);
    }
  }

  // Laissez-passer « Bientôt » pour l'équipe NDOA (rôle vérifié en base), en ouvrant ses espaces
  if (COMING_SOON && !hasPass && data.user && /^\/(admin|espace|onboarding)(\/|$)/.test(path)) {
    role ??= await readRole();
    if (role && STAFF_ROLES.includes(role)) {
      const token = await makePreviewToken(data.user.id);
      if (token) response.cookies.set(PREVIEW_COOKIE, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: PREVIEW_DAYS * 86400 });
    }
  }
  return response;
}

// Toutes les pages (mode « Bientôt ») ; la session Supabase n'est lue que sur /onboarding, /espace, /admin et /api.
// Les fichiers statiques (images, polices, robots, sitemap) passent sans le proxy.
export const config = {
  matcher: ["/((?!_next/static|_next/image|brand/|favicon\\.ico|icon\\.png|apple-icon\\.png|robots\\.txt|sitemap\\.xml|.*\\.(?:png|jpe?g|webp|avif|gif|svg|ico|txt|xml|webmanifest|mp4|woff2?)$).*)"],
};
