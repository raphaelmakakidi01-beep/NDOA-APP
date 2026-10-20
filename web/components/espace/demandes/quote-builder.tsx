"use client";

import { useState } from "react";
import { Eye, Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { useEspace } from "@/lib/espace/store";
import { useBusiness } from "@/lib/espace/business";
import { quotePdf } from "@/lib/espace/quote-pdf";
import { activePromo, promoPrice, quoteTotal, type Currency, type Inquiry, type Quote, type QuoteLine } from "@/lib/espace/types";
import { cn, formatPrice, uid } from "@/lib/utils";

type LineForm = { key: string; label: string; qty: string; unit: string };
const num = (s: string) => Number(s.replace(/\s/g, "").replace(",", ".")) || 0;
const plusDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const DEFAULT_NOTES = "Acompte de 30 % à la signature, solde 7 jours avant le mariage. Paiement par M-Pesa, Orange Money, Airtel Money ou virement.";

/** Création d’un devis depuis un forfait + options, aperçu et envoi en PDF */
export function QuoteBuilder({ inquiry, initial, onClose }: { inquiry: Inquiry; initial?: Quote; onClose: () => void }) {
  const { data, vendor } = useEspace();
  const biz = useBusiness();
  const firstPkg = data.packages.find((p) => p.name === inquiry.packageName) ?? data.packages.find((p) => p.featured) ?? data.packages[0];
  const linesFor = (pkgId?: string): LineForm[] => {
    const p = data.packages.find((x) => x.id === pkgId);
    if (!p) return [{ key: uid(), label: "", qty: "1", unit: "" }];
    const promo = activePromo(data.promotions, p.id, inquiry.weddingDate);
    return [{ key: uid(), label: `Forfait ${p.name}${p.duration ? ` (${p.duration})` : ""}${promo ? ` - ${promo.label}` : ""}`, qty: "1", unit: String(promoPrice(p.amount, promo)) }];
  };

  const [pkgId, setPkgId] = useState(initial?.packageId ?? firstPkg?.id ?? "");
  const [currency, setCurrency] = useState<Currency>(initial?.currency ?? firstPkg?.currency ?? "USD");
  const [lines, setLines] = useState<LineForm[]>(initial ? initial.lines.map((l) => ({ key: uid(), label: l.label, qty: String(l.qty), unit: String(l.unit) })) : linesFor(firstPkg?.id));
  const [discount, setDiscount] = useState(initial ? String(initial.discount || "") : "");
  const [validUntil, setValidUntil] = useState(initial?.validUntil ?? plusDays(15));
  const [notes, setNotes] = useState(initial?.notes ?? DEFAULT_NOTES);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"preview" | "send" | null>(null);
  const [number] = useState(() => initial?.number ?? biz.nextQuoteNumber());

  const options = data.options.filter((o) => !o.packageId || o.packageId === pkgId);
  const hasOption = (name: string) => lines.some((l) => l.label === name);
  const toggleOption = (name: string, amount: number) =>
    setLines((ls) => (ls.some((l) => l.label === name) ? ls.filter((l) => l.label !== name) : [...ls, { key: uid(), label: name, qty: "1", unit: String(amount) }]));
  const setLine = (key: string, p: Partial<LineForm>) => { setError(""); setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...p } : l))); };

  const parsed: QuoteLine[] = lines.filter((l) => l.label.trim()).map((l) => ({ label: l.label.trim(), qty: Math.max(1, Math.round(num(l.qty))), unit: num(l.unit) }));
  const sub = parsed.reduce((s, l) => s + l.qty * l.unit, 0);
  const total = quoteTotal({ lines: parsed, discount: num(discount) });

  const build = (): Quote | null => {
    if (!parsed.length || sub <= 0) { setError("Ajoutez au moins une ligne avec un prix."); return null; }
    if (num(discount) > sub) { setError("La remise dépasse le sous-total."); return null; }
    return { id: initial?.id ?? uid(), inquiryId: inquiry.id, number, packageId: pkgId || undefined, lines: parsed, discount: num(discount), currency, validUntil, notes: notes.trim(), status: "draft", createdAt: initial?.createdAt ?? new Date().toISOString() };
  };

  const preview = async () => {
    const q = build(); if (!q) return;
    setBusy("preview");
    // Fenêtre ouverte avant l’attente pour éviter le bloqueur de pop-up
    const w = window.open("", "_blank");
    try {
      const blob = await quotePdf(q, vendor, inquiry);
      const url = URL.createObjectURL(blob);
      if (w) w.location.href = url; else window.location.assign(url);
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch { w?.close(); toast.error("L’aperçu n’a pas pu être généré."); }
    setBusy(null);
  };
  const save = async (send: boolean) => {
    const q = build(); if (!q) return;
    if (!send) { biz.saveQuote(q, { send: false }); onClose(); return; }
    setBusy("send");
    try {
      const pdf = await quotePdf({ ...q, sentAt: new Date().toISOString() }, vendor, inquiry);
      biz.saveQuote(q, { send: true, pdf });
      onClose();
    } catch { toast.error("Le devis n’a pas pu être envoyé. Réessayez."); }
    setBusy(null);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} wide title={`Devis ${number}`} description={`Pour ${inquiry.couple}, mariage le ${new Date(`${inquiry.weddingDate}T12:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}.`}
      footer={<>
        <Button variant="ghost" className="mr-auto" onClick={() => save(false)} disabled={!!busy}>Enregistrer le brouillon</Button>
        <Button variant="outline" onClick={preview} loading={busy === "preview"} disabled={!!busy}><Eye aria-hidden />Aperçu PDF</Button>
        <Button onClick={() => save(true)} loading={busy === "send"} disabled={!!busy}><Send aria-hidden />Envoyer le devis</Button>
      </>}>
      <div className="grid grid-cols-1 gap-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_8rem_11rem]">
          <Field label="À partir du forfait">
            {(a) => (
              <Select id={a.id} value={pkgId} onChange={(e) => { const p = data.packages.find((x) => x.id === e.target.value); setPkgId(e.target.value); if (p) setCurrency(p.currency); setLines((ls) => [...linesFor(e.target.value), ...ls.slice(1).filter((l) => data.options.some((o) => o.name === l.label && (!o.packageId || o.packageId === e.target.value)))]); }}>
                <option value="">Devis libre</option>
                {data.packages.map((p) => <option key={p.id} value={p.id}>{p.name} · {formatPrice(p.amount, p.currency)}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Devise">{(a) => <Select id={a.id} value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}><option>USD</option><option>CDF</option></Select>}</Field>
          <Field label="Valable jusqu’au">{(a) => <Input id={a.id} type="date" value={validUntil} min={plusDays(1)} onChange={(e) => setValidUntil(e.target.value)} />}</Field>
        </div>

        {options.length > 0 && (
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Options</legend>
            <div className="flex flex-wrap gap-2">
              {options.map((o) => (
                <button key={o.id} type="button" aria-pressed={hasOption(o.name)} onClick={() => toggleOption(o.name, o.amount)}
                  className={cn("inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors", hasOption(o.name) ? "border-gold bg-gold/12 text-text" : "border-line text-muted hover:border-gold hover:text-text")}>
                  {o.name}<span className="tabular-nums opacity-70">+{formatPrice(o.amount, o.currency)}</span>
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <fieldset className="grid gap-3">
          <legend className="mb-1 text-sm font-semibold">Lignes du devis</legend>
          <div className="hidden grid-cols-[1fr_4.5rem_8rem_7rem_2.5rem] gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted sm:grid" aria-hidden>
            <span>Désignation</span><span>Qté</span><span>Prix unitaire</span><span className="text-right">Total</span><span />
          </div>
          {lines.map((l, i) => (
            <div key={l.key} className="grid grid-cols-[1fr_4.5rem_2.5rem] gap-2 rounded-2xl border border-line p-3 sm:grid-cols-[1fr_4.5rem_8rem_7rem_2.5rem] sm:items-center sm:rounded-none sm:border-0 sm:p-0">
              <Input aria-label={`Désignation, ligne ${i + 1}`} value={l.label} onChange={(e) => setLine(l.key, { label: e.target.value })} placeholder="Ex. Forfait Premium" className="col-span-3 sm:col-span-1" />
              <Input aria-label={`Quantité, ligne ${i + 1}`} inputMode="numeric" value={l.qty} onChange={(e) => setLine(l.key, { qty: e.target.value.replace(/\D/g, "") })} className="px-3 text-center" />
              <Input aria-label={`Prix unitaire, ligne ${i + 1}`} inputMode="decimal" value={l.unit} onChange={(e) => setLine(l.key, { unit: e.target.value.replace(/[^\d\s,.]/g, "") })} placeholder="0" className="col-start-1 row-start-2 sm:col-start-auto sm:row-start-auto" />
              <span className="col-start-2 row-start-2 self-center text-right font-semibold tabular-nums sm:col-start-auto sm:row-start-auto">{formatPrice(Math.max(1, num(l.qty)) * num(l.unit), currency)}</span>
              <button type="button" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} disabled={lines.length === 1}
                className="col-start-3 row-start-1 grid size-10 place-items-center rounded-full text-muted hover:bg-danger/10 hover:text-danger disabled:opacity-30 sm:col-start-auto sm:row-start-auto" aria-label={`Supprimer la ligne ${i + 1}`}>
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>
          ))}
          <Button type="button" variant="subtle" size="sm" className="justify-self-start" onClick={() => setLines((ls) => [...ls, { key: uid(), label: "", qty: "1", unit: "" }])}><Plus aria-hidden />Ajouter une ligne</Button>
        </fieldset>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-[1fr_16rem]">
          <Field label="Conditions et notes" hint="Acompte, modes de paiement, frais de déplacement…">
            {(a) => <Textarea id={a.id} aria-describedby={a.describedBy} className="min-h-28" value={notes} maxLength={800} onChange={(e) => setNotes(e.target.value)} />}
          </Field>
          <div className="grid content-start gap-3 rounded-2xl bg-surface-2 p-4 text-sm">
            <p className="flex justify-between"><span className="text-muted">Sous-total</span><span className="tabular-nums">{formatPrice(sub, currency)}</span></p>
            <label className="flex items-center justify-between gap-3">
              <span className="text-muted">Remise</span>
              <input inputMode="decimal" value={discount} onChange={(e) => { setError(""); setDiscount(e.target.value.replace(/[^\d,.]/g, "")); }} placeholder="0"
                className="h-10 w-28 rounded-xl border border-line-strong bg-surface px-3 text-right tabular-nums focus-visible:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40" />
            </label>
            <p className="flex items-baseline justify-between border-t border-line pt-3"><span className="font-semibold">Total</span><span className="font-display text-2xl tabular-nums text-gold-ink" aria-live="polite">{formatPrice(total, currency)}</span></p>
          </div>
        </div>
        {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
      </div>
    </Dialog>
  );
}
