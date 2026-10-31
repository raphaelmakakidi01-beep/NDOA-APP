import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SUBSCRIPTIONS_ENABLED } from "@/lib/config";
import { WhenReady } from "@/lib/espace/store";
import { Abonnement, AbonnementSkeleton } from "@/components/espace/abonnement";

export const metadata: Metadata = { title: "Abonnement" };

export default function Page() {
  if (!SUBSCRIPTIONS_ENABLED) redirect("/espace");
  return (
    <Suspense fallback={<AbonnementSkeleton />}>
      <WhenReady skeleton={<AbonnementSkeleton />}>
        <Abonnement />
      </WhenReady>
    </Suspense>
  );
}
