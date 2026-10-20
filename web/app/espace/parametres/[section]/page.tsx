import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { WhenReady } from "@/lib/espace/store";
import { Parametres, ParametresSkeleton } from "@/components/espace/parametres";
import { SECTIONS, type SectionId } from "@/components/espace/parametres-sections";

export const metadata: Metadata = { title: "Paramètres" };

export function generateStaticParams() {
  return SECTIONS.map((s) => ({ section: s.id }));
}

async function Content({ params }: { params: PageProps<"/espace/parametres/[section]">["params"] }) {
  const { section } = await params;
  if (!SECTIONS.some((s) => s.id === section)) notFound();
  return (
    <WhenReady skeleton={<ParametresSkeleton />}>
      <Parametres section={section as SectionId} />
    </WhenReady>
  );
}

export default function Page({ params }: PageProps<"/espace/parametres/[section]">) {
  return <Suspense fallback={<ParametresSkeleton />}><Content params={params} /></Suspense>;
}
