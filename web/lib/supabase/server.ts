import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/config";

/**
 * Client Supabase côté serveur avec la session de l'utilisateur (cookies) :
 * les règles RLS et les contrôles de rôle en base s'appliquent normalement.
 */
export async function getServerSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try { list.forEach(({ name, value, options }) => store.set(name, value, options)); } catch { /* lecture seule */ }
      },
    },
  });
}

/** Utilisateur connecté et son rôle plateforme, lus en base (jamais depuis le navigateur) */
export async function getStaffSession() {
  const sb = await getServerSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  if (!data.user) return null;
  const { data: profile } = await sb.from("profiles").select("role, suspended_at").eq("id", data.user.id).maybeSingle();
  const role = profile && !profile.suspended_at ? (profile.role as string) : "user";
  return { sb, user: data.user, role };
}
