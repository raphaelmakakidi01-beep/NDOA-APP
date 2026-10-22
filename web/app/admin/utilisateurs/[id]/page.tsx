import { Suspense } from "react";
import type { Metadata } from "next";
import { UserDetailView } from "@/components/admin/users";

export const metadata: Metadata = { title: "Fiche utilisateur" };

export default function Page() {
  return (
    <Suspense fallback={<div className="skeleton h-96 rounded-2xl" />}>
      <UserDetailView />
    </Suspense>
  );
}
