import { Suspense } from "react";
import type { Metadata } from "next";
import { ViewAs } from "@/components/admin/view-as";

export const metadata: Metadata = { title: "Vue prestataire (lecture seule)" };

export default function Page() {
  return (
    <Suspense fallback={<div className="skeleton h-96 rounded-2xl" />}>
      <ViewAs />
    </Suspense>
  );
}
