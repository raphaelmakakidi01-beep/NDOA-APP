import type { Metadata } from "next";
import { Suspense } from "react";
import { WhenReady } from "@/lib/espace/store";
import { Calendrier, CalendrierSkeleton } from "@/components/espace/calendrier";

export const metadata: Metadata = { title: "Calendrier" };

export default function Page() {
  return (
    <Suspense fallback={<CalendrierSkeleton />}>
      <WhenReady skeleton={<CalendrierSkeleton />}>
        <Calendrier />
      </WhenReady>
    </Suspense>
  );
}
