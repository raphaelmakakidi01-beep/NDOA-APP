import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { canAccess } from "@/lib/admin/access";

/**
 * Avec Supabase : rafraîchit la session (cookies) et protège /onboarding, /espace et /admin.
 * /admin/* : rôle lu EN BASE (profiles.role) à chaque requête ; tout non-staff est redirigé.
 * En mode démo (pas de clés), la protection est faite côté navigateur.
 */
export async function proxy(request: NextRequest) {
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
  const path = request.nextUrl.pathname;
  const toLogin = () => {
    const to = request.nextUrl.clone();
    to.pathname = "/connexion";
    to.search = "";
    to.searchParams.set("suite", path);
    return NextResponse.redirect(to);
  };

  if (/^\/(onboarding|espace)(\/|$)/.test(path) && !data.user) return toLogin();

  if (/^\/(admin|api\/admin)(\/|$)/.test(path)) {
    if (!data.user) return path.startsWith("/api/") ? NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 }) : toLogin();
    const { data: profile } = await supabase.from("profiles").select("role, suspended_at").eq("id", data.user.id).maybeSingle();
    const role = profile && !profile.suspended_at ? (profile.role as string) : null;
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
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|avif)$).*)"],
};
