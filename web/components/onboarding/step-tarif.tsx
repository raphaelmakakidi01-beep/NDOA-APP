"use client";

import { useState } from "react";
import { Check, Minus, Plus, X } from "lucide-react";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { useOnboarding } from "@/lib/onboarding/store";
import { INCLUDE_SUGGESTIONS } from "@/lib/onboarding/catalog";
import { formatPrice } from "@/lib/utils";
import { StepFooter, StepHeader, ToggleChip } from "./step-ui";

function ListEditor({ id, label, items, onChange, suggestions = [], tone, error }: {
  id: string; label: string; items: string[]; onChange: (fn: (prev: string[]) => string[]) => void; suggestions?: string[]; tone: "yes" | "no"; error?: string;
}) {
  const [value, setValue] = useState("");
  const add = (v: string) => { const t = v.trim(); if (t) onChange((prev) => (prev.includes(t) ? prev : [...prev, t])); setValue(""); };
  const rest = suggestions.filter((s) => !items.includes(s));
  return (
    <Field id={id} label={label} error={error} hint="Appuyez sur Entrée pour ajouter une ligne.">
      {({ id: fid, describedBy, invalid }) => (
        <div className="grid gap-3">
          <div className="flex gap-2">
            <Input id={fid} value={value} onChange={(e) => setValue(e.target.value)} maxLength={80}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(value); } }}
              placeholder={tone === "yes" ? "Ex. : 300 photos retouchées" : "Ex. : Album imprimé"} aria-describedby={describedBy} aria-invalid={invalid || undefined} />
            <button type="button" onClick={() => add(value)} className="grid size-12 shrink-0 place-items-center rounded-xl border border-line-strong hover:border-gold" aria-label={`Ajouter à « ${label} »`}>
              <Plus className="size-4" aria-hidden />
            </button>
          </div>
          {items.length > 0 && (
            <ul className="grid gap-1.5">
              {items.map((it) => (
                <li key={it} className="flex items-center gap-3 rounded-xl bg-surface-2 py-1.5 pl-3 pr-1.5 text-sm">
                  {tone === "yes" ? <Check className="size-4 text-gold" aria-hidden /> : <Minus className="size-4 text-muted" aria-hidden />}
                  <span className="flex-1">{it}</span>
                  <button type="button" onClick={() => onChange((prev) => prev.filter((x) => x !== it))} className="grid size-8 place-items-center rounded-full hover:bg-line" aria-label={`Retirer « ${it} »`}>
                    <X className="size-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {rest.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {rest.map((s) => (
                <button key={s} type="button" onClick={() => add(s)} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-dashed border-line-strong px-3 text-[13px] text-muted hover:border-gold hover:text-text">
                  <Plus className="size-3.5" aria-hidden />{s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </Field>
  );
}

export function StepTarif() {
  const { draft, update, errors } = useOnboarding();
  const p = draft.pkg;
  const set = (patch: Partial<typeof p>) => update((d) => ({ pkg: { ...d.pkg, ...patch } }));
  const cat = draft.primaryCategory ?? draft.categories[0] ?? "default";
  const suggestions = INCLUDE_SUGGESTIONS[cat] ?? INCLUDE_SUGGESTIONS.default;
  const amount = Number(p.amount) || 0;

  return (
    <div className="mx-auto max-w-4xl">
      <StepHeader title={<>Votre premier <em className="text-gold-ink">forfait</em></>}
        lead="Un prix de départ clair rassure les mariés. D’autres forfaits pourront suivre." />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="grid content-start gap-5">
          <Field id="f-pkg-name" label="Nom du forfait" error={errors.name}>
            {({ id, describedBy, invalid }) => (
              <div className="grid gap-2">
                <Input id={id} value={p.name} maxLength={40} onChange={(e) => set({ name: e.target.value })} aria-describedby={describedBy} aria-invalid={invalid || undefined} />
                <div className="flex flex-wrap gap-1.5">
                  {["Essentiel", "Premium", "Prestige", "Journée complète"].map((n) => <ToggleChip key={n} on={p.name === n} onClick={() => set({ name: n })}>{n}</ToggleChip>)}
                </div>
              </div>
            )}
          </Field>

          <div className="grid gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold">Prix</span>
              <Segmented label="Type de prix" layoutId="price-mode" value={p.priceMode} onChange={(v) => set({ priceMode: v })} className="[&_button]:px-3 [&_button]:py-1 [&_button]:text-[13px]"
                options={[{ value: "from", label: "À partir de" }, { value: "fixed", label: "Prix fixe" }]} />
            </div>
          <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-2">
            <Field id="f-amount" label={<span className="sr-only">Montant</span>} error={errors.amount}>
              {({ id, describedBy, invalid }) => (
                <Input id={id} inputMode="numeric" value={p.amount} onChange={(e) => set({ amount: e.target.value.replace(/\D/g, "").slice(0, 9) })}
                  placeholder={p.currency === "USD" ? "850" : "2 400 000"} aria-describedby={describedBy} aria-invalid={invalid || undefined} />
              )}
            </Field>
            <Field id="f-currency" label={<span className="sr-only">Devise</span>}>
              {({ id }) => (
                <Select id={id} value={p.currency} onChange={(e) => set({ currency: e.target.value as "USD" | "CDF" })}>
                  <option value="USD">USD</option>
                  <option value="CDF">CDF</option>
                </Select>
              )}
            </Field>
          </div>
          </div>

          <Field id="f-duration" label="Durée" optional>
            {({ id, describedBy }) => <Input id={id} value={p.duration} maxLength={40} placeholder="6 h, journée complète, soirée…" onChange={(e) => set({ duration: e.target.value })} aria-describedby={describedBy} />}
          </Field>

          <Field id="f-desc" label="Description" optional error={errors.description} counter={{ value: p.description.length, max: 400 }}>
            {({ id, describedBy, invalid }) => (
              <Textarea id={id} rows={3} value={p.description} onChange={(e) => set({ description: e.target.value })}
                placeholder="À qui s’adresse ce forfait, ce qui le rend unique…" aria-describedby={describedBy} aria-invalid={invalid || undefined} />
            )}
          </Field>

          <ListEditor id="f-includes" label="Ce qui est inclus" items={p.includes} onChange={(fn) => update((d) => ({ pkg: { ...d.pkg, includes: fn(d.pkg.includes) } }))} suggestions={suggestions} tone="yes" error={errors.includes} />
          <ListEditor id="f-excludes" label="Ce qui n’est pas inclus" items={p.excludes} onChange={(fn) => update((d) => ({ pkg: { ...d.pkg, excludes: fn(d.pkg.excludes) } }))} tone="no" />
        </div>

        {/* Aperçu en direct, identique à la carte de la page publique */}
        <div>
          <div className="sticky top-24">
          <p className="mb-2 text-xs font-semibold text-muted">Aperçu sur votre vitrine</p>
          <article className="rounded-3xl border border-gold/50 bg-surface p-5" aria-label="Aperçu du forfait">
            <p className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.2em] text-gold-ink"><span className="h-px w-5 bg-current" />Le plus populaire</p>
            <h3 className="font-display text-2xl italic">{p.name || "Votre forfait"}</h3>
            <p className="mt-1 min-h-10 text-sm text-muted">{p.description || "Une courte description apparaîtra ici."}</p>
            <div className="my-4 border-y border-line py-3">
              <span className="block text-xs text-muted">{p.priceMode === "from" ? "à partir de" : "prix fixe"}</span>
              <span className="font-display text-3xl tabular-nums">{amount ? formatPrice(amount, p.currency) : "—"}</span>
              {p.duration && <span className="ml-2 text-sm text-muted">· {p.duration}</span>}
            </div>
            <ul className="grid gap-2 text-sm">
              {p.includes.map((i) => <li key={i} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />{i}</li>)}
              {p.excludes.map((i) => <li key={i} className="flex gap-2 text-muted"><Minus className="mt-0.5 size-4 shrink-0" aria-hidden />{i}</li>)}
              {p.includes.length + p.excludes.length === 0 && <li className="text-muted">Ajoutez ce qui est inclus.</li>}
            </ul>
          </article>
          </div>
        </div>
      </div>
      <StepFooter step="tarif" />
    </div>
  );
}
