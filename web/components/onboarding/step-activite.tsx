"use client";

import { motion } from "motion/react";
import { Check, Star } from "lucide-react";
import { useOnboarding } from "@/lib/onboarding/store";
import { useCatalog } from "@/lib/onboarding/use-catalog";
import { cn } from "@/lib/utils";
import { StepFooter, StepHeader, ToggleChip } from "./step-ui";

export function StepActivite() {
  const { draft, update, errors } = useOnboarding();
  const { categories, categoryName } = useCatalog();
  const sel = draft.categories;
  const primary = draft.primaryCategory && sel.includes(draft.primaryCategory) ? draft.primaryCategory : sel[0];

  const toggle = (slug: string) =>
    update((d) => {
      const has = d.categories.includes(slug);
      const categories = has ? d.categories.filter((c) => c !== slug) : [...d.categories, slug];
      return { categories, primaryCategory: categories.includes(d.primaryCategory ?? "") ? d.primaryCategory : categories[0] };
    });

  return (
    <>
      <StepHeader title={<>Que <em className="text-gold-ink">faites-vous</em> ?</>}
        lead="Une ou plusieurs activités : les mariés vous trouveront dans chacune." />

      <div role="group" aria-label="Activités" aria-describedby={errors.categories ? "cat-err" : undefined}
        data-error={!!errors.categories || undefined} tabIndex={errors.categories ? -1 : undefined}
        className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {categories.map((c, i) => {
          const on = sel.includes(c.slug);
          return (
            <motion.button key={c.slug} type="button" aria-pressed={on} onClick={() => toggle(c.slug)}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className={cn("group relative isolate flex aspect-[4/3] flex-col justify-end overflow-hidden rounded-2xl p-3 text-left ring-1 transition-shadow sm:aspect-[16/10]",
                on ? "ring-2 ring-gold" : "ring-line hover:ring-gold/60")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.imageUrl} alt="" loading="lazy" className={cn("absolute inset-0 -z-20 size-full object-cover transition-transform duration-700 group-hover:scale-105", on ? "brightness-90" : "brightness-[.62] saturate-[.8]")} />
              <span className="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
              <span className={cn("absolute right-2.5 top-2.5 grid size-6 place-items-center rounded-full border transition-all",
                on ? "border-gold bg-gold text-on-gold" : "border-white/50 bg-black/30 text-transparent")}>
                <Check className="size-3.5" aria-hidden />
              </span>
              <span className="font-display text-base leading-tight text-white sm:text-lg">{c.name}</span>
              <span className="mt-0.5 hidden text-xs text-white/75 sm:block">{c.hint ?? ""}</span>
            </motion.button>
          );
        })}
      </div>
      {errors.categories && <p id="cat-err" role="alert" className="mt-3 text-sm font-medium text-danger">{errors.categories}</p>}

      {sel.length > 1 && (
        <div className="mt-6 rounded-2xl border border-line bg-surface p-4">
          <p className="flex items-center gap-2 text-sm font-semibold"><Star className="size-4 text-gold" aria-hidden />Activité principale</p>
          <p className="mb-4 mt-1 text-[13px] text-muted">Elle s’affiche sous votre nom et détermine les champs proposés (matériel, capacité…).</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Activité principale">
            {sel.map((s) => (
              <ToggleChip key={s} on={s === primary} onClick={() => update({ primaryCategory: s })}>{categoryName(s)}</ToggleChip>
            ))}
          </div>
        </div>
      )}
      <StepFooter step="activite" />
    </>
  );
}
