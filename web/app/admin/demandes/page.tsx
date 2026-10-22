import type { Metadata } from "next";
import { Inquiries } from "@/components/admin/inquiries";

export const metadata: Metadata = { title: "Demandes de devis" };

export default function Page() {
  return <Inquiries />;
}
