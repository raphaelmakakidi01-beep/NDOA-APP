import type { Metadata } from "next";
import { Suspense } from "react";
import { WhenReady } from "@/lib/espace/store";
import { Thread, ThreadSkeleton } from "@/components/espace/demandes/thread";

export const metadata: Metadata = { title: "Conversation" };

async function Content({ params }: { params: PageProps<"/espace/demandes/[id]">["params"] }) {
  const { id } = await params;
  return (
    <WhenReady skeleton={<ThreadSkeleton />}>
      <Thread id={id} />
    </WhenReady>
  );
}

export default function Page({ params }: PageProps<"/espace/demandes/[id]">) {
  return (
    <Suspense fallback={<ThreadSkeleton />}>
      <Content params={params} />
    </Suspense>
  );
}
