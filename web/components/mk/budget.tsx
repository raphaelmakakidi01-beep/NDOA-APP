"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { WhatsApp } from "./icons";

/* Répartitions indicatives en %, à ajuster par chaque couple (la dernière ligne absorbe les arrondis) */
const POSTES = [
  { label: "Salle de réception", href: "/prestataires?categorie=salle" },
  { label: "Traiteur et boissons", href: "/prestataires?categorie=traiteur" },
  { label: "Décoration et fleurs", href: "/prestataires?categorie=decorateur" },
  { label: "Photo et vidéo", href: "/prestataires?categorie=photographe" },
  { label: "Tenues et beauté", href: "/prestataires?categorie=maquilleur" },
  { label: "DJ et animation", href: "/prestataires?categorie=dj" },
  { label: "Cortège et transport", href: "/prestataires?categorie=voiture" },
  { label: "Imprévus", href: null },
];
const STYLES = [
  { id: "equilibre", label: "Équilibré", split: [25, 30, 12, 10, 8, 5, 3, 7] },
  { id: "reception", label: "Priorité à la réception", split: [28, 34, 12, 7, 6, 5, 2, 6] },
  { id: "souvenirs", label: "Priorité aux souvenirs", split: [22, 26, 11, 18, 8, 5, 3, 7] },
];
const usd = (n: number) => `${new Intl.NumberFormat("fr-FR").format(n)} $`;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(n) ? n : min));

export function BudgetCalculator({ whatsapp }: { whatsapp?: string }) {
  const id = useId();
  const [total, setTotal] = useState(5000);
  const [guests, setGuests] = useState(150);
  const [style, setStyle] = useState(STYLES[0]);

  const lines = useMemo(() => {
    const amounts = style.split.map((p) => Math.round((total * p) / 100 / 5) * 5);
    amounts[amounts.length - 1] += total - amounts.reduce((a, b) => a + b, 0);
    return POSTES.map((p, i) => ({ ...p, pct: style.split[i], amount: amounts[i] }));
  }, [total, style]);
  const perGuest = guests > 0 ? Math.round(total / guests) : 0;

  const digits = (whatsapp ?? "").replace(/\D/g, "");
  const summary = [
    "Bonjour NDOA, voici mon budget de mariage :",
    `Budget total : ${usd(total)} pour ${guests} invités (${usd(perGuest)} par invité)`,
    ...lines.map((l) => `- ${l.label} : ${usd(l.amount)}`),
    "Pouvez-vous me conseiller des prestataires ?",
  ].join("\n");

  return (
    <div className="bud">
      <form className="bud-form" onSubmit={(e) => e.preventDefault()}>
        <div className="bud-field">
          <label htmlFor={`${id}-t`}>Votre budget total (USD)</label>
          <input id={`${id}-t`} className="bud-num" type="number" inputMode="numeric" min={500} max={200000} step={100} value={total} onChange={(e) => setTotal(clamp(e.target.valueAsNumber, 0, 200000))} onBlur={() => setTotal(clamp(total, 500, 200000))} />
          <input type="range" aria-label="Ajuster le budget" min={500} max={50000} step={100} value={Math.min(total, 50000)} onChange={(e) => setTotal(e.target.valueAsNumber)} />
        </div>
        <div className="bud-field">
          <label htmlFor={`${id}-g`}>Nombre d’invités</label>
          <input id={`${id}-g`} className="bud-num" type="number" inputMode="numeric" min={10} max={3000} step={10} value={guests} onChange={(e) => setGuests(clamp(e.target.valueAsNumber, 0, 3000))} onBlur={() => setGuests(clamp(guests, 10, 3000))} />
          <input type="range" aria-label="Ajuster le nombre d’invités" min={10} max={1000} step={10} value={Math.min(guests, 1000)} onChange={(e) => setGuests(e.target.valueAsNumber)} />
        </div>
        <fieldset className="bud-field">
          <legend>Votre priorité</legend>
          <div className="bud-styles">
            {STYLES.map((s) => <button key={s.id} type="button" className="chip" aria-pressed={style.id === s.id} onClick={() => setStyle(s)}>{s.label}</button>)}
          </div>
        </fieldset>
      </form>

      <section className="bud-out" aria-labelledby={`${id}-r`}>
        <h2 id={`${id}-r`} className="sr-only">Votre répartition</h2>
        <div className="bud-sum" aria-live="polite">
          <div><small>Budget total</small><b>{usd(total)}</b></div>
          <div><small>Par invité</small><b>{usd(perGuest)}</b></div>
        </div>
        <ul className="bud-lines">
          {lines.map((l) => (
            <li key={l.label}>
              <div className="bud-line">
                {l.href ? <Link href={l.href}>{l.label}</Link> : <span>{l.label}</span>}
                <span className="bud-amt"><b>{usd(l.amount)}</b> <small>{l.pct} %</small></span>
              </div>
              <span className="bud-bar" aria-hidden="true"><i style={{ transform: `scaleX(${l.pct / 34})` }} /></span>
            </li>
          ))}
        </ul>
        <p className="bud-note">Répartition indicative, à adapter à vos priorités et aux devis reçus. La dot et les frais coutumiers, propres à chaque famille, ne sont pas inclus.</p>
        <div className="bud-actions">
          {digits && <a className="btn btn-gold" href={`https://wa.me/${digits}?text=${encodeURIComponent(summary)}`} target="_blank" rel="noopener noreferrer"><WhatsApp />Recevoir des conseils sur WhatsApp</a>}
          <Link className={`btn ${digits ? "btn-ghost" : "btn-gold"}`} href="/prestataires">Voir les prestataires</Link>
        </div>
      </section>
    </div>
  );
}
