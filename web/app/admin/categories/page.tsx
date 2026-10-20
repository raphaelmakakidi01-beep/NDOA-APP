import type { Metadata } from "next";
import { Catalog } from "@/components/admin/catalog";

export const metadata: Metadata = { title: "Catégories et villes" };

export default function Page() {
  return <Catalog />;
}
