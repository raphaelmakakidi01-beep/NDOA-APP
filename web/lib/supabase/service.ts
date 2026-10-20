import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/config";

/**
 * Client « service_role » : contourne la RLS. STRICTEMENT côté serveur
 * (`server-only` fait échouer la compilation s'il est importé dans un composant client).
 * La clé vient de SUPABASE_SERVICE_ROLE_KEY — jamais d'une variable NEXT_PUBLIC_*.
 * À n'utiliser qu'après avoir vérifié le rôle de l'appelant (getStaffSession).
 */
let client: SupabaseClient | null = null;

export function getServiceSupabase(): SupabaseClient | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !key) return null;
  client ??= createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}
