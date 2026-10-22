import type { Metadata } from "next";
import { SiteContent } from "@/components/admin/site-content";

export const metadata: Metadata = { title: "Pages et contenus" };

export default function Page() {
  return <SiteContent />;
}
