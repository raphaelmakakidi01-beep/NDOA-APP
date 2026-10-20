"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useOnboarding, useOnboardingReady } from "@/lib/onboarding/store";
import { STEPS } from "@/lib/onboarding/types";

/** /onboarding → reprend à la première étape non terminée (ou au tableau de bord si publié) */
export function ResumeOnboarding() {
  return useOnboardingReady() ? <Resume /> : null;
}

function Resume() {
  const { draft } = useOnboarding();
  const router = useRouter();
  useEffect(() => {
    if (draft.publishedAt) { router.replace("/espace"); return; }
    const next = STEPS.find((s) => !draft.done[s.key]) ?? STEPS[STEPS.length - 1];
    router.replace(`/onboarding/${next.key}`);
  }, [draft, router]);
  return <p className="text-muted" aria-live="polite">Reprise de votre brouillon…</p>;
}
