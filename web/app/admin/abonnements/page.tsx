import type { Metadata } from "next";
import { Billing } from "@/components/admin/billing";

export const metadata: Metadata = { title: "Abonnements et paiements" };

export default function Page() {
  return <Billing />;
}
