import type { Metadata } from "next";
import { Suspense } from "react";
import { WhenReady } from "@/lib/espace/store";
import { Vitrine, VitrineSkeleton } from "@/components/espace/vitrine";

export const metadata: Metadata = { title: "Ma vitrine" };

export default function Page() {
  return (
    <Suspense fallback={<VitrineSkeleton />}>
      <WhenReady skeleton={<VitrineSkeleton />}>
        <Vitrine />
      </WhenReady>
    </Suspense>
  );
}
