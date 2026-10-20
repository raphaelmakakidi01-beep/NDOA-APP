import type { Metadata } from "next";
import { Suspense } from "react";
import { ReviewForm } from "@/components/public/review-form";

export const metadata: Metadata = { title: "Laisser un avis", robots: { index: false } };

async function Content({ params }: { params: PageProps<"/avis/[token]">["params"] }) {
  const { token } = await params;
  return <ReviewForm token={token} />;
}

export default function Page({ params }: PageProps<"/avis/[token]">) {
  return <Suspense fallback={null}><Content params={params} /></Suspense>;
}
