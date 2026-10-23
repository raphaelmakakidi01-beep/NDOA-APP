"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEMO, SUPABASE_ANON_KEY, SUPABASE_MISSING, SUPABASE_URL } from "@/lib/config";

let client: SupabaseClient | null = null;

/** Client Supabase côté navigateur (null en mode démo, qui n’existe qu’en développement local). */
export function getSupabase(): SupabaseClient | null {
  if (DEMO) return null;
  // jamais de bascule silencieuse vers la démo (code 123456 accepté) quand la configuration manque
  if (SUPABASE_MISSING) throw new Error("Configuration Supabase manquante : NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  client ??= createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}
