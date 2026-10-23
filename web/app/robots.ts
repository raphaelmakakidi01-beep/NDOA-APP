import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";

/** Marketplace et présentation pro indexables ; espaces privés et API exclus */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/espace", "/onboarding", "/admin", "/api/", "/mon-compte", "/verification", "/avis/", "/auth/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
