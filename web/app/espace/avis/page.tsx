import type { Metadata } from "next";
import { Suspense } from "react";
import { WhenReady } from "@/lib/espace/store";
import { Avis, AvisSkeleton } from "@/components/espace/avis";

export const metadata: Metadata = { title: "Avis" };

export default function Page() {
  return (
    <Suspense fallback={<AvisSkeleton />}>
      <WhenReady skeleton={<AvisSkeleton />}>
        <Avis />
      </WhenReady>
    </Suspense>
  );
}
