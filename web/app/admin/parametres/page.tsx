import type { Metadata } from "next";
import { Settings } from "@/components/admin/settings";

export const metadata: Metadata = { title: "Paramètres" };

export default function Page() {
  return <Settings />;
}
