import type { Metadata } from "next";
import { Suspense } from "react";
import { WhenReady } from "@/lib/espace/store";
import { Tarifs, TarifsSkeleton } from "@/components/espace/tarifs";

export const metadata: Metadata = { title: "Tarifs" };

export default function Page() {
  return (
    <Suspense fallback={<TarifsSkeleton />}>
      <WhenReady skeleton={<TarifsSkeleton />}>
        <Tarifs />
      </WhenReady>
    </Suspense>
  );
}
