"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { ChevronRight, Lightbulb } from "lucide-react";
import { Logo, ThemeToggle } from "@/components/brand";
import { OnboardingProvider, useOnboarding } from "@/lib/onboarding/store";
import { completeness } from "@/lib/onboarding/rules";
import { STEPS, type StepKey } from "@/lib/onboarding/types";
import { cn } from "@/lib/utils";

export function OnboardingShell({ children }: { children: React.ReactNode }) {
  return (
    <OnboardingProvider fallback={<ShellSkeleton />} page={children}>
      <Frame>{children}</Frame>
    </OnboardingProvider>
  );
}

function useCurrentStep(): StepKey {
  const path = usePathname();
  const k = path.split("/")[2];
  return (STEPS.find((s) => s.key === k)?.key ?? "activite") as StepKey;
}

function Frame({ children }: { children: React.ReactNode }) {
  const current = useCurrentStep();
  const { draft } = useOnboarding();
  const { score } = completeness(draft);
  const idx = STEPS.findIndex((s) => s.key === current);
  const published = !!draft.publishedAt;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1040px] items-center gap-4 px-4 sm:px-6">
          <Logo size="sm" />
          {!published && (
            <p className="hidden text-sm text-muted sm:block">
              <span className="font-semibold text-text tabular-nums">{idx + 1}</span>/{STEPS.length} · {STEPS[idx].label}
            </p>
          )}
          <div className="ml-auto flex items-center gap-2">
            <ScorePill score={score} />
            <ThemeToggle />
          </div>
        </div>
        {!published && <StepProgress current={current} />}
      </header>

      <main id="contenu" className="mx-auto max-w-[1040px] px-4 pb-32 pt-8 sm:px-6 sm:pt-10">
        {!published && <p className="mb-2 text-sm text-muted sm:hidden"><span className="font-semibold text-text">{idx + 1}</span>/{STEPS.length} · {STEPS[idx].label}</p>}
        {/* fondu uniquement : un transform ici casserait la barre d’actions fixée en bas sur mobile */}
        <motion.div key={current} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
          {children}
        </motion.div>
      </main>
    </div>
  );
}

/** Fine barre de progression en 6 segments ; les étapes accessibles restent cliquables */
function StepProgress({ current }: { current: StepKey }) {
  const { draft } = useOnboarding();
  const idx = STEPS.findIndex((s) => s.key === current);
  return (
    <nav aria-label="Étapes de création" className="mx-auto max-w-[1040px] px-4 pb-2 sm:px-6">
      <ol className="flex gap-1">
        {STEPS.map((s, i) => {
          const done = !!draft.done[s.key];
          const reachable = done || i <= idx || STEPS.slice(0, i).every((x) => draft.done[x.key]);
          const isCurrent = s.key === current;
          const bar = (
            <span className="relative block h-1 overflow-hidden rounded-full bg-line">
              <motion.span className="absolute inset-y-0 left-0 rounded-full bg-gold" initial={false}
                animate={{ width: done || i < idx ? "100%" : isCurrent ? "50%" : "0%" }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} />
            </span>
          );
          const label = `Étape ${i + 1} : ${s.label}${done ? " (terminée)" : ""}`;
          return (
            <li key={s.key} className="flex-1">
              {reachable && !isCurrent ? (
                <Link href={`/onboarding/${s.key}`} className="block py-1.5" aria-label={label} title={s.label}>{bar}</Link>
              ) : (
                <span aria-current={isCurrent ? "step" : undefined} aria-label={label} title={s.label} className="block py-1.5">{bar}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function Ring({ value, size = 56 }: { value: number; size?: number }) {
  const r = (size - 6) / 2, c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth="5" />
      <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--gold)" strokeWidth="5" strokeLinecap="round"
        strokeDasharray={c} initial={false} animate={{ strokeDashoffset: c * (1 - value / 100) }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
    </svg>
  );
}

function ScorePill({ score }: { score: number }) {
  return (
    <span className="flex items-center gap-2 rounded-full border border-line py-1 pl-1 pr-3 text-[13px] font-semibold" title="Complétude de votre profil" aria-label={`Profil complet à ${score} %`}>
      <Ring value={score} size={26} />
      <span className="tabular-nums">{score} %</span>
    </span>
  );
}

export function ScoreCard({ className }: { className?: string }) {
  const { draft } = useOnboarding();
  const { score, tips } = completeness(draft);
  const todo = tips.filter((t) => !t.done).sort((a, b) => b.gain - a.gain).slice(0, 3);
  return (
    <section className={cn("rounded-3xl border border-line bg-surface p-5", className)} aria-labelledby="score-title">
      <div className="flex items-center gap-4">
        <div className="relative">
          <Ring value={score} size={56} />
          <span className="font-display absolute inset-0 grid place-items-center text-base tabular-nums">{score}</span>
        </div>
        <div>
          <h2 id="score-title" className="font-display text-lg leading-tight">Profil complet à <span className="text-gold-ink">{score} %</span></h2>
          <p className="mt-0.5 text-[13px] text-muted">Plus il est complet, mieux il est classé.</p>
        </div>
      </div>
      {todo.length > 0 && (
        <>
          <p className="mb-1 mt-4 flex items-center gap-2 text-xs font-semibold text-muted"><Lightbulb className="size-3.5 text-gold" aria-hidden />Pour progresser</p>
          <ul className="grid gap-1">
            {todo.map((t) => (
              <li key={t.label}>
                <Link href={`/onboarding/${t.step}`} className="group flex items-center gap-3 rounded-xl px-2 py-2 text-[13px] transition-colors hover:bg-surface-2">
                  <span className="flex-1">{t.label}</span>
                  <span className="font-bold tabular-nums text-gold-ink">+{t.gain} %</span>
                  <ChevronRight className="size-4 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function ShellSkeleton() {
  return (
    <div className="mx-auto max-w-[1040px] px-4 pt-6 sm:px-6" aria-busy="true" aria-label="Chargement de votre brouillon">
      <div className="skeleton mb-8 h-10 w-40 rounded-full" />
      <div className="skeleton mb-4 h-12 w-2/3 rounded-xl" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton aspect-[4/3] rounded-2xl" />)}
      </div>
    </div>
  );
}
