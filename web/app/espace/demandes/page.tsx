import type { Metadata } from "next";
import { Suspense } from "react";
import { WhenReady } from "@/lib/espace/store";
import { Demandes, DemandesSkeleton } from "@/components/espace/demandes/inbox";

export const metadata: Metadata = { title: "Demandes" };

export default function Page() {
  return (
    <Suspense fallback={<DemandesSkeleton />}>
      <WhenReady skeleton={<DemandesSkeleton />}>
        <Demandes />
      </WhenReady>
    </Suspense>
  );
}
