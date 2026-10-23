import type { Card } from "@/lib/public/types";

export const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);
export const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(".", ",").replace(",0", "")} k` : String(n));
export const rate = (v: Pick<Card, "rating" | "reviews">) => (v.reviews ? v.rating.toFixed(1).replace(".", ",") : "Nouveau");
export const priceLabel = (v: Pick<Card, "price">) => (v.price == null ? "Sur devis" : `${fmt(v.price)} USD`);
export const vendorUrl = (slug: string) => `/prestataires/${slug}`;
export const directoryUrl = (params: Record<string, string | undefined>) => {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
  return `/prestataires${q ? `?${q}` : ""}`;
};
