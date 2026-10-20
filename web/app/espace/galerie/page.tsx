import type { Metadata } from "next";
import { Suspense } from "react";
import { WhenReady } from "@/lib/espace/store";
import { Galerie, GalerieSkeleton } from "@/components/espace/galerie/galerie";

export const metadata: Metadata = { title: "Galerie" };

export default function Page() {
  return (
    <Suspense fallback={<GalerieSkeleton />}>
      <WhenReady skeleton={<GalerieSkeleton />}>
        <Galerie />
      </WhenReady>
    </Suspense>
  );
}
