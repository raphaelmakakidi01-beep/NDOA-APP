import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

// Un build de production n'a jamais de mode démo : sans les clés Supabase, il échoue avec un message clair
// (sinon le site en ligne afficherait « Mode démo » et accepterait le code 123456).
function assertProductionEnv(phase: string) {
  if (phase !== PHASE_PRODUCTION_BUILD) return;
  // Supabase (données, comptes) et Cloudflare Turnstile (anti-spam des demandes de devis)
  const missing = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY"]
    .filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Build de production impossible : variable(s) d'environnement manquante(s) ${missing.join(", ")}. `
      + "Sur Vercel : Project Settings > Environment Variables, puis redéployer.");
  }
}

const supabaseHost = (() => { try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname; } catch { return "*.supabase.co"; } })();

const nextConfig: NextConfig = {
  images: {
    // photos des vitrines (stockage public Supabase) et visuels de démonstration, servies redimensionnées par Next
    remotePatterns: [
      { protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  async headers() {
    const dev = process.env.NODE_ENV !== "production";
    // Sans nonce, Next a besoin de 'unsafe-inline' pour ses scripts d'hydratation ; tout le reste est verrouillé
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com${dev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://images.unsplash.com https://*.supabase.co",
      "media-src 'self' blob: https://*.supabase.co",
      "font-src 'self' data:",
      `connect-src 'self' https://*.supabase.co wss://*.supabase.co${dev ? " ws:" : ""}`,
      // anti-spam Cloudflare Turnstile (formulaire de demande de devis)
      "frame-src 'self' https://challenges.cloudflare.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; ");
    return [{
      source: "/:path*",
      headers: [
        { key: "Content-Security-Policy", value: csp },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      ],
    }];
  },
  async redirects() {
    return [
      { source: "/espace/parametres", destination: "/espace/parametres/compte", permanent: false },
      // anciennes adresses du site statique
      { source: "/prestataire/:slug", destination: "/prestataires/:slug", permanent: true },
      { source: "/prestataire.html", destination: "/prestataires", permanent: true },
      { source: "/index.html", destination: "/", permanent: true },
      { source: "/:page(cgu|confidentialite|mentions-legales|contact).html", destination: "/:page", permanent: true },
      { source: "/a-propos.html", destination: "/contact", permanent: true },
    ];
  },
  turbopack: {
    // le dépôt contient aussi le site statique : on fixe la racine du projet Next
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default function config(phase: string): NextConfig {
  assertProductionEnv(phase);
  return nextConfig;
}
