import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { STEPS, isStepKey } from "@/lib/onboarding/types";
import { StepView } from "@/components/onboarding/step-view";

export function generateStaticParams() {
  return STEPS.map((s) => ({ etape: s.key }));
}

/** Titre d’onglet propre à chaque étape (« Photos · Création de votre vitrine ») */
export async function generateMetadata({ params }: PageProps<"/onboarding/[etape]">): Promise<Metadata> {
  const { etape } = await params;
  const step = STEPS.find((s) => s.key === etape);
  return step ? { title: { absolute: `${step.label} · Création de votre vitrine — NDOA Pro` } } : {};
}

/** Le paramètre d’URL est lu dans une frontière Suspense (navigation instantanée) */
async function Step({ params }: { params: PageProps<"/onboarding/[etape]">["params"] }) {
  const { etape } = await params;
  if (!isStepKey(etape)) notFound();
  return <StepView step={etape} />;
}

export default function Page({ params }: PageProps<"/onboarding/[etape]">) {
  return (
    <Suspense fallback={null}>
      <Step params={params} />
    </Suspense>
  );
}
