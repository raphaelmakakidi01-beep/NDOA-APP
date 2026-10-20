/** Sans clés Supabase, l’application tourne en mode démo (données locales au navigateur). */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
/** NEXT_PUBLIC_FORCE_DEMO=1 (développement uniquement) : force le mode démo même avec des clés, pour tester l'interface */
const FORCE_DEMO = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_FORCE_DEMO === "1";
export const DEMO = FORCE_DEMO || !SUPABASE_URL || !SUPABASE_ANON_KEY;

/**
 * Confirmation de l’e-mail à l’inscription : « lien » (e-mail par défaut de Supabase, lien cliquable)
 * ou « code » (code à 6 chiffres, nécessite un SMTP personnalisé pour modifier le modèle d’e-mail).
 */
export const EMAIL_CONFIRMATION: "lien" | "code" = process.env.NEXT_PUBLIC_EMAIL_CONFIRMATION === "code" ? "code" : "lien";

/** Code OTP accepté en mode démo */
export const DEMO_OTP = "123456";

/** Adresse du site public (pour l’aperçu « Voir ma page ») */
export const PUBLIC_SITE_URL = (process.env.NEXT_PUBLIC_PUBLIC_SITE_URL ?? (process.env.NODE_ENV === "production" ? "https://ndoa.cd" : "http://localhost:5173")).replace(/\/$/, "");
/** Adresse de cette application (espace prestataire), pour les aperçus de partage */
export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? (process.env.NODE_ENV === "production" ? "https://pro.ndoa.cd" : "http://localhost:3000")).replace(/\/$/, "");
/** Adresse publique d’un profil (URL propre générée par scripts/build-seo.mjs) */
export const profileUrl = (slug: string) => `${PUBLIC_SITE_URL}/prestataire/${slug}/`;
