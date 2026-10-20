import type { Metadata } from "next";
import { WhenReady } from "@/lib/espace/store";
import { Dashboard, DashboardSkeleton } from "@/components/espace/dashboard";

export const metadata: Metadata = { title: "Tableau de bord" };

export default function Page() {
  return (
    <WhenReady skeleton={<DashboardSkeleton />}>
      <Dashboard />
    </WhenReady>
  );
}
