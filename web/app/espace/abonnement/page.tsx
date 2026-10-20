import type { Metadata } from "next";
import { Suspense } from "react";
import { WhenReady } from "@/lib/espace/store";
import { Abonnement, AbonnementSkeleton } from "@/components/espace/abonnement";

export const metadata: Metadata = { title: "Abonnement" };

export default function Page() {
  return (
    <Suspense fallback={<AbonnementSkeleton />}>
      <WhenReady skeleton={<AbonnementSkeleton />}>
        <Abonnement />
      </WhenReady>
    </Suspense>
  );
}
