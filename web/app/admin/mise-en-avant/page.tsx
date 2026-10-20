import type { Metadata } from "next";
import { Featured } from "@/components/admin/featured";

export const metadata: Metadata = { title: "Mise en avant" };

export default function Page() {
  return <Featured />;
}
