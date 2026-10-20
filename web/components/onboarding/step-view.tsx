"use client";

import { useEffect } from "react";
import { useOnboarding, useOnboardingReady } from "@/lib/onboarding/store";
import { STEPS, type StepKey } from "@/lib/onboarding/types";
import { StepActivite } from "./step-activite";
import { StepEntreprise } from "./step-entreprise";
import { StepPhotos } from "./step-photos";
import { StepTarif } from "./step-tarif";
import { StepContacts } from "./step-contacts";
import { StepApercu } from "./step-apercu";

const VIEWS: Record<StepKey, () => React.ReactNode> = {
  activite: StepActivite, entreprise: StepEntreprise, photos: StepPhotos, tarif: StepTarif, contacts: StepContacts, apercu: StepApercu,
};

export function StepView({ step }: { step: StepKey }) {
  return useOnboardingReady() ? <ReadyStep step={step} /> : null;
}

function ReadyStep({ step }: { step: StepKey }) {
  const { setErrors } = useOnboarding();
  // On repart sans erreurs affichées à chaque changement d’étape ; titre d’onglet à jour
  useEffect(() => {
    setErrors({});
    const s = STEPS.find((x) => x.key === step)!;
    document.title = `${s.title} — Création de votre vitrine — NDOA Pro`;
    window.scrollTo({ top: 0 });
  }, [step, setErrors]);
  const View = VIEWS[step];
  return <View />;
}
