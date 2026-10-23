export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const PROD = process.env.NODE_ENV === "production";
/** Clés Supabase absentes : en production c’est une erreur de configuration (jamais un mode démo) */
export const SUPABASE_MISSING = !SUPABASE_URL || !SUPABASE_ANON_KEY;
/** NEXT_PUBLIC_FORCE_DEMO=1 (développement uniquement) : force le mode démo même avec des clés, pour tester l'interface */
const FORCE_DEMO = !PROD && process.env.NEXT_PUBLIC_FORCE_DEMO === "1";
/**
 * Mode démo (données locales au navigateur, code OTP affiché) : UNIQUEMENT en développement local
 * (`next dev`), sans clés Supabase ou avec NEXT_PUBLIC_FORCE_DEMO=1. Un build de production
 * (Vercel, `next build`) n’est jamais en démo : sans clés, il échoue (voir next.config.ts).
 */
export const DEMO = !PROD && (FORCE_DEMO || SUPABASE_MISSING);

/**
 * Confirmation de l’e-mail à l’inscription : « lien » (e-mail par défaut de Supabase, lien cliquable)
 * ou « code » (code à 6 chiffres, nécessite un SMTP personnalisé pour modifier le modèle d’e-mail).
 */
export const EMAIL_CONFIRMATION: "lien" | "code" = process.env.NEXT_PUBLIC_EMAIL_CONFIRMATION === "code" ? "code" : "lien";

/** Code OTP accepté en mode démo */
export const DEMO_OTP = "123456";

const clean = (u: string) => u.replace(/\/$/, "");
const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;
/**
 * Adresse publique de ce site (NEXT_PUBLIC_SITE_URL, ex. https://ndoa-app.vercel.app) : metadataBase,
 * aperçus de partage, sitemap, robots. À défaut sur Vercel : le domaine de production du projet.
 */
export const SITE_URL = clean(process.env.NEXT_PUBLIC_SITE_URL || (vercelUrl ? `https://${vercelUrl}` : "http://localhost:3000"));
/** Marketplace publique : la même application (accueil « / », profils « /prestataires/<slug> ») */
export const PUBLIC_SITE_URL = SITE_URL;
/** Domaine affiché devant les adresses de vitrine (ex. « ndoa-app.vercel.app/prestataires/… ») */
export const PUBLIC_HOST = PUBLIC_SITE_URL.replace(/^https?:\/\//, "");
/** Adresse publique d’un profil */
export const profileUrl = (slug: string) => `${SITE_URL}/prestataires/${slug}`;
