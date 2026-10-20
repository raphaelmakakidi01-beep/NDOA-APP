import { Suspense } from "react";
import type { Metadata } from "next";
import { VendorDetail } from "@/components/admin/vendor-detail";

export const metadata: Metadata = { title: "Fiche prestataire" };

export default function Page() {
  return (
    <Suspense fallback={<div className="skeleton h-96 rounded-2xl" />}>
      <VendorDetail />
    </Suspense>
  );
}
