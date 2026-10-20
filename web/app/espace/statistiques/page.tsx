import type { Metadata } from "next";
import { Suspense } from "react";
import { WhenReady } from "@/lib/espace/store";
import { Statistiques, StatistiquesSkeleton } from "@/components/espace/statistiques";

export const metadata: Metadata = { title: "Statistiques" };

export default function Page() {
  return (
    <Suspense fallback={<StatistiquesSkeleton />}>
      <WhenReady skeleton={<StatistiquesSkeleton />}>
        <Statistiques />
      </WhenReady>
    </Suspense>
  );
}
