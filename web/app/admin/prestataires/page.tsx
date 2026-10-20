import { Suspense } from "react";
import type { Metadata } from "next";
import { VendorsTable } from "@/components/admin/vendors";

export const metadata: Metadata = { title: "Prestataires" };

export default function Page() {
  return (
    <Suspense fallback={<div className="skeleton h-96 rounded-2xl" />}>
      <VendorsTable />
    </Suspense>
  );
}
