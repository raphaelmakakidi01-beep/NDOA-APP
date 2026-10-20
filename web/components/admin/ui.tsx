"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { StatusTag } from "@/components/ui/bits";
import { STATUS_META, type VendorStatus } from "@/lib/admin/types";
import { cn } from "@/lib/utils";

/* Éléments d'interface de l'espace admin : denses, lisibles, au clavier */

export function PageHeader({ title, sub, actions, back }: { title: string; sub?: React.ReactNode; actions?: React.ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {back && <Link href={back.href} className="mb-1 inline-flex items-center gap-1 text-[13px] font-semibold text-muted hover:text-text"><ChevronLeft className="size-3.5" aria-hidden />{back.label}</Link>}
        <h1 className="font-display text-[1.7rem] leading-tight sm:text-3xl">{title}</h1>
        {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, action, children, className, id }: { title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section aria-labelledby={id} className={cn("min-w-0 rounded-2xl border border-line bg-surface", className)}>
      {title && (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-line px-4 py-3">
          <h2 id={id} className="text-sm font-bold">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Kpi({ label, value, hint, href, accent }: { label: string; value: React.ReactNode; hint?: React.ReactNode; href?: string; accent?: boolean }) {
  const body = (
    <>
      <p className="text-[12px] font-semibold uppercase tracking-[.08em] text-muted">{label}</p>
      <p className={cn("mt-1 whitespace-nowrap font-display leading-none tabular", String(value).length > 7 ? "text-[1.55rem]" : "text-[2rem]", accent && "text-gold-ink")}>{value}</p>
      {hint && <p className="mt-1.5 text-[12.5px] text-muted">{hint}</p>}
    </>
  );
  const cls = "block rounded-2xl border border-line bg-surface p-4 transition-colors";
  return href ? <Link href={href} className={cn(cls, "hover:border-gold/60")}>{body}</Link> : <div className={cls}>{body}</div>;
}

export function VendorStatusTag({ status }: { status: VendorStatus }) {
  const m = STATUS_META[status];
  return <StatusTag tone={m.tone}>{m.label}</StatusTag>;
}

export const selectClass = "h-9 rounded-lg border border-line-strong bg-surface px-2.5 text-[13px] text-text focus-visible:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40";

export function FilterSelect({ label, value, onChange, options, className }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; className?: string }) {
  const id = React.useId();
  return (
    <div className={cn("grid gap-1", className)}>
      <label htmlFor={id} className="text-[11px] font-bold uppercase tracking-[.1em] text-muted">{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder, className }: { value: string; onChange: (v: string) => void; placeholder: string; className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder}
        className="h-9 w-full rounded-lg border border-line-strong bg-surface pl-9 pr-3 text-[13.5px] text-text placeholder:text-muted/80 focus-visible:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40" />
    </div>
  );
}

export function Check({ checked, onChange, label, indeterminate }: { checked: boolean; onChange: (v: boolean) => void; label: string; indeterminate?: boolean }) {
  const ref = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => { if (ref.current) ref.current.indeterminate = !!indeterminate; }, [indeterminate]);
  return (
    <input ref={ref} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label}
      className="size-4 cursor-pointer rounded border-line-strong accent-[var(--gold)]" />
  );
}

/** En-tête de colonne triable (aria-sort) */
export function SortTh<K extends string>({ label, k, sort, dir, onSort, className }: { label: string; k: K; sort: string; dir: "asc" | "desc"; onSort: (k: K) => void; className?: string }) {
  const on = sort === k;
  const Icon = !on ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th scope="col" aria-sort={on ? (dir === "asc" ? "ascending" : "descending") : "none"} className={cn("px-3 py-2 text-left font-semibold", className)}>
      <button type="button" onClick={() => onSort(k)} className={cn("inline-flex items-center gap-1 hover:text-text", on && "text-text")}>
        {label}<Icon className="size-3.5" aria-hidden />
      </button>
    </th>
  );
}

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total ? (page - 1) * pageSize + 1 : 0;
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line px-3 py-2.5 text-[13px] text-muted">
      <p className="tabular">{from}–{Math.min(total, page * pageSize)} sur {total}</p>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1} className="grid size-8 place-items-center rounded-lg border border-line hover:border-gold disabled:opacity-40" aria-label="Page précédente"><ChevronLeft className="size-4" aria-hidden /></button>
        <span className="px-2 tabular">Page {page} / {pages}</span>
        <button type="button" onClick={() => onPage(page + 1)} disabled={page >= pages} className="grid size-8 place-items-center rounded-lg border border-line hover:border-gold disabled:opacity-40" aria-label="Page suivante"><ChevronRight className="size-4" aria-hidden /></button>
      </div>
    </div>
  );
}

/**
 * Motif obligatoire : choix parmi des motifs prédéfinis (cases) + précisions libres.
 * Le texte final est celui envoyé au prestataire.
 */
type ReasonProps = {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: React.ReactNode; presets: string[];
  confirmLabel: string; tone?: "danger" | "gold"; onConfirm: (reason: string) => Promise<void> | void;
};
/* Démonté à la fermeture : chaque ouverture repart d'un formulaire vide */
export function ReasonDialog(props: ReasonProps) {
  return props.open ? <ReasonDialogOpen {...props} /> : null;
}
function ReasonDialogOpen({ open, onOpenChange, title, description, presets, confirmLabel, tone = "danger", onConfirm }: ReasonProps) {
  const [picked, setPicked] = React.useState<string[]>([]);
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const reason = [...picked, note.trim()].filter(Boolean).join(" · ");
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} description={description} className="admin-ui"
      footer={<>
        <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Annuler</Button>
        <Button variant={tone === "danger" ? "danger" : "gold"} size="sm" loading={busy} disabled={!reason}
          onClick={async () => { setBusy(true); try { await onConfirm(reason); } finally { setBusy(false); } }}>{confirmLabel}</Button>
      </>}>
      <fieldset className="grid gap-1.5">
        <legend className="mb-2 text-sm font-semibold">Motifs</legend>
        {presets.map((p) => (
          <label key={p} className={cn("flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-sm", picked.includes(p) ? "border-gold bg-gold/8" : "border-line hover:border-line-strong")}>
            <input type="checkbox" className="mt-0.5 size-4 accent-[var(--gold)]" checked={picked.includes(p)}
              onChange={(e) => setPicked((x) => (e.target.checked ? [...x, p] : x.filter((y) => y !== p)))} />
            {p}
          </label>
        ))}
      </fieldset>
      <label className="mt-4 grid gap-1.5 text-sm font-semibold">
        Précisions <span className="font-normal text-muted">(facultatif, envoyées telles quelles)</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} rows={3}
          className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm font-normal focus-visible:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
          placeholder="Ex. : remplacez la photo de couverture par une image nette." />
      </label>
      {reason && <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-[13px] text-muted"><b className="text-text">Message :</b> {reason}</p>}
    </Dialog>
  );
}

/** Confirmation, avec saisie obligatoire d'un texte pour les actions irréversibles */
type ConfirmProps = {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; children?: React.ReactNode; confirmLabel: string;
  typeToConfirm?: string; onConfirm: (typed: string) => Promise<void> | void;
};
export function ConfirmDialog(props: ConfirmProps) {
  return props.open ? <ConfirmDialogOpen {...props} /> : null;
}
function ConfirmDialogOpen({ open, onOpenChange, title, children, confirmLabel, typeToConfirm, onConfirm }: ConfirmProps) {
  const [typed, setTyped] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const okToGo = !typeToConfirm || typed === typeToConfirm;
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} className="admin-ui"
      footer={<>
        <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Annuler</Button>
        <Button variant="danger" size="sm" loading={busy} disabled={!okToGo} onClick={async () => { setBusy(true); try { await onConfirm(typed); } finally { setBusy(false); } }}>{confirmLabel}</Button>
      </>}>
      <div className="grid gap-3 text-sm">
        {children}
        {typeToConfirm && (
          <label className="grid gap-1.5 font-semibold">
            <span>Pour confirmer, tapez <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[13px]">{typeToConfirm}</code></span>
            <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false}
              className="h-10 rounded-lg border border-line-strong bg-surface px-3 font-mono text-sm font-normal focus-visible:border-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40" />
          </label>
        )}
      </div>
    </Dialog>
  );
}

/** Export CSV (séparateur « ; » et BOM pour Excel en français) */
export function downloadCsv<T>(filename: string, rows: T[], columns: { label: string; value: (r: T) => string | number | undefined }[]) {
  const esc = (v: unknown) => {
    const s = v === undefined || v === null ? "" : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.map((c) => esc(c.label)).join(";"), ...rows.map((r) => columns.map((c) => esc(c.value(r))).join(";"))];
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const fmtDate = (iso?: string, withTime = false) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR", withTime ? { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short", year: "numeric" }) : "—";
export const fmtInt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

/** Délai lisible depuis une date (« 3 j », « 5 h ») */
export function waited(iso?: string) {
  if (!iso) return "—";
  const h = (Date.now() - new Date(iso).getTime()) / 3600000;
  return h < 1 ? "< 1 h" : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} j`;
}
