import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";
import { getDirectory } from "@/lib/public/data";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: [string, MetadataRoute.Sitemap[number]["changeFrequency"], number][] = [
    ["/", "daily", 1], ["/prestataires", "daily", 0.9], ["/inspiration", "weekly", 0.7], ["/pro", "monthly", 0.6],
    ["/contact", "monthly", 0.4], ["/inscription", "monthly", 0.4], ["/cgu", "yearly", 0.2], ["/confidentialite", "yearly", 0.2], ["/mentions-legales", "yearly", 0.2],
  ];
  const vendors = await getDirectory();
  return [
    ...pages.map(([p, changeFrequency, priority]) => ({ url: `${SITE_URL}${p}`, changeFrequency, priority })),
    ...vendors.map((v) => ({ url: `${SITE_URL}/prestataires/${v.slug}`, changeFrequency: "weekly" as const, priority: 0.8 })),
  ];
}
