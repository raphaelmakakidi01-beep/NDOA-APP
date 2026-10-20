import type { MetadataRoute } from "next";
import { APP_URL } from "@/lib/config";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/inscription", "/connexion"].map((p) => ({ url: `${APP_URL}${p}`, changeFrequency: "monthly", priority: p === "/" ? 1 : 0.6 }));
}
