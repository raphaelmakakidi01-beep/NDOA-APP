import { Suspense } from "react";
import { notFound } from "next/navigation";
import { STEPS, isStepKey } from "@/lib/onboarding/types";
import { StepView } from "@/components/onboarding/step-view";

export function generateStaticParams() {
  return STEPS.map((s) => ({ etape: s.key }));
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
