/** Sans clés Supabase, l’application tourne en mode démo (données locales au navigateur). */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const DEMO = !SUPABASE_URL || !SUPABASE_ANON_KEY;

/** Code OTP accepté en mode démo */
export const DEMO_OTP = "123456";

/** Adresse du site public (pour l’aperçu « Voir ma page ») */
export const PUBLIC_SITE_URL = (process.env.NEXT_PUBLIC_PUBLIC_SITE_URL ?? (process.env.NODE_ENV === "production" ? "https://ndoa.cd" : "http://localhost:5173")).replace(/\/$/, "");
/** Adresse de cette application (espace prestataire), pour les aperçus de partage */
export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? (process.env.NODE_ENV === "production" ? "https://pro.ndoa.cd" : "http://localhost:3000")).replace(/\/$/, "");
/** Adresse publique d’un profil (URL propre générée par scripts/build-seo.mjs) */
export const profileUrl = (slug: string) => `${PUBLIC_SITE_URL}/prestataire/${slug}/`;
