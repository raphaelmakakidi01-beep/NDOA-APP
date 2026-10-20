import type { MetadataRoute } from "next";
import { APP_URL } from "@/lib/config";

/** Seules la présentation et l’inscription sont indexables ; l’espace et l’onboarding sont privés */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/", "/inscription", "/connexion"], disallow: ["/espace", "/onboarding", "/verification", "/avis/", "/auth/"] }],
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
