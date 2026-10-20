"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/lib/onboarding/store";
import { STEPS, type StepKey } from "@/lib/onboarding/types";

export function StepHeader({ title, lead }: { title: React.ReactNode; lead?: React.ReactNode }) {
  return (
    <div className="mb-7 max-w-xl">
      <h1 className="font-display text-[1.9rem] leading-[1.08] sm:text-[2.4rem]">{title}</h1>
      {lead && <p className="mt-2 text-[15px] leading-relaxed text-muted">{lead}</p>}
    </div>
  );
}

/** Barre d’actions : collée en bas sur mobile, en ligne sur desktop */
export function StepFooter({ step, nextLabel = "Continuer", onNext, disabled }: { step: StepKey; nextLabel?: string; onNext?: () => void; disabled?: boolean }) {
  const { submitStep, saving } = useOnboarding();
  const idx = STEPS.findIndex((s) => s.key === step);
  const prev = STEPS[idx - 1];
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/90 px-4 py-3 backdrop-blur-xl sm:static sm:mt-10 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none"
      style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
      <div className="mx-auto flex items-center justify-between gap-3 sm:border-t sm:border-line sm:pt-6">
        {prev ? (
          <Button asChild variant="ghost" size="lg" className="px-4">
            <Link href={`/onboarding/${prev.key}`}><ArrowLeft aria-hidden />Retour</Link>
          </Button>
        ) : <span />}
        <Button size="lg" className="min-w-40 flex-1 sm:flex-none" loading={saving} disabled={disabled}
          onClick={() => (onNext ? onNext() : void submitStep(step))}>
          {nextLabel}{!saving && <ArrowRight aria-hidden />}
        </Button>
      </div>
    </div>
  );
}

/** Puces sélectionnables (aria-pressed) */
export function ToggleChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={"inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold transition-colors " +
        (on ? "border-gold bg-gold text-on-gold" : "border-line-strong text-text hover:border-gold/70")}>
      {children}
    </button>
  );
}
