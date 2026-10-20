"use client";

import * as React from "react";
import { Check as CheckIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { listStoryOptions, searchVendors } from "@/lib/admin/content";
import type { StoryOption, VendorRef } from "@/lib/admin/content-types";
import { cn } from "@/lib/utils";
import { SearchBox } from "./ui";

/* Sélecteurs partagés de l'espace admin (vitrine publiée, story, période de diffusion) */

export function VendorAvatar({ v, size = 36 }: { v: VendorRef; size?: number }) {
  return v.avatarUrl
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={v.avatarUrl} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} loading="lazy" />
    : <span className="grid shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-bold text-muted" style={{ width: size, height: size }}>{v.name.slice(0, 1)}</span>;
}

/** Choix d'une vitrine publiée (recherche par nom ou ville) */
export function VendorPickerDialog({ open, onOpenChange, title, exclude = [], onPick }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; exclude?: string[]; onPick: (v: VendorRef) => Promise<void> | void;
}) {
  if (!open) return null;
  return <VendorPickerOpen onOpenChange={onOpenChange} title={title} exclude={exclude} onPick={onPick} />;
}
function VendorPickerOpen({ onOpenChange, title, exclude, onPick }: { onOpenChange: (o: boolean) => void; title: string; exclude: string[]; onPick: (v: VendorRef) => Promise<void> | void }) {
  const [q, setQ] = React.useState("");
  const [res, setRes] = React.useState<{ q: string; list: VendorRef[] } | null>(null);
  const [busy, setBusy] = React.useState("");
  React.useEffect(() => {
    let alive = true;
    const t = setTimeout(() => { searchVendors(q).then((list) => alive && setRes({ q, list })).catch(() => alive && setRes({ q, list: [] })); }, 200);
    return () => { alive = false; clearTimeout(t); };
  }, [q]);
  const loading = !res || res.q !== q;
  return (
    <Dialog open onOpenChange={onOpenChange} title={title} description="Seules les vitrines en ligne peuvent être mises en avant." className="admin-ui">
      <SearchBox value={q} onChange={setQ} placeholder="Nom ou ville" className="mb-3" />
      {loading && !res ? <div className="grid gap-2">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-12 rounded-lg" />)}</div> : (
        <ul className={cn("grid gap-1", loading && "opacity-60")} aria-busy={loading}>
          {res!.list.map((v) => {
            const taken = exclude.includes(v.id);
            return (
              <li key={v.id}>
                <button type="button" disabled={taken || !!busy} onClick={async () => { setBusy(v.id); try { await onPick(v); onOpenChange(false); } finally { setBusy(""); } }}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50">
                  <VendorAvatar v={v} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{v.name}</span>
                    <span className="block truncate text-[12px] text-muted">{[v.category, v.city].filter(Boolean).join(" · ")}</span>
                  </span>
                  {busy === v.id ? <Loader2 className="size-4 animate-spin text-muted" aria-hidden /> : taken && <span className="inline-flex items-center gap-1 text-[12px] text-muted"><CheckIcon className="size-3.5" aria-hidden />déjà ajoutée</span>}
                </button>
              </li>
            );
          })}
          {!res!.list.length && <li className="px-2 py-6 text-center text-sm text-muted">Aucune vitrine en ligne ne correspond.</li>}
        </ul>
      )}
    </Dialog>
  );
}

/** Choix d'une story (vitrines en ligne) */
export function StoryPickerDialog({ open, onOpenChange, exclude, onPick }: { open: boolean; onOpenChange: (o: boolean) => void; exclude: string[]; onPick: (s: StoryOption) => Promise<void> | void }) {
  const [list, setList] = React.useState<StoryOption[] | null>(null);
  React.useEffect(() => { if (open) listStoryOptions().then(setList).catch(() => setList([])); }, [open]);
  if (!open) return null;
  return (
    <Dialog open onOpenChange={onOpenChange} title="Mettre une story en avant" wide className="admin-ui">
      {!list ? <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton aspect-[9/14] rounded-xl" />)}</div> : !list.length ? (
        <p className="py-6 text-center text-sm text-muted">Aucune story publiée par les vitrines en ligne.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {list.map((s) => {
            const taken = exclude.includes(s.id);
            return (
              <li key={s.id}>
                <button type="button" disabled={taken} onClick={async () => { await onPick(s); onOpenChange(false); }}
                  className="group grid w-full gap-1.5 text-left disabled:opacity-45">
                  <span className="relative block aspect-[9/14] overflow-hidden rounded-xl bg-surface-2 ring-gold/70 group-hover:ring-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {s.coverUrl && <img src={s.coverUrl} alt="" className="size-full object-cover" loading="lazy" />}
                    {taken && <span className="absolute inset-x-1 bottom-1 rounded bg-black/70 px-1.5 py-0.5 text-center text-[11px] font-semibold text-white">Déjà en avant</span>}
                  </span>
                  <span className="truncate text-[13px] font-semibold">{s.title}</span>
                  <span className="-mt-1 truncate text-[12px] text-muted">{s.vendor.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Dialog>
  );
}

/* Dates ↔ champ « datetime-local » (heure locale de l'appareil) */
export const toLocalInput = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
export const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : undefined);

export const dateInputClass = "h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-text focus-visible:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40";

/** Période de diffusion (début et fin facultatifs) */
export function PeriodDialog({ open, onOpenChange, title, startsAt, endsAt, onSave }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; startsAt?: string; endsAt?: string; onSave: (s?: string, e?: string) => Promise<void>;
}) {
  if (!open) return null;
  return <PeriodOpen onOpenChange={onOpenChange} title={title} startsAt={startsAt} endsAt={endsAt} onSave={onSave} />;
}
function PeriodOpen({ onOpenChange, title, startsAt, endsAt, onSave }: { onOpenChange: (o: boolean) => void; title: string; startsAt?: string; endsAt?: string; onSave: (s?: string, e?: string) => Promise<void> }) {
  const [s, setS] = React.useState(toLocalInput(startsAt));
  const [e, setE] = React.useState(toLocalInput(endsAt));
  const [busy, setBusy] = React.useState(false);
  const invalid = !!(s && e && e <= s);
  return (
    <Dialog open onOpenChange={onOpenChange} title={title} description="Laissez vide pour une diffusion immédiate ou sans fin." className="admin-ui"
      footer={<>
        <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Annuler</Button>
        <Button size="sm" loading={busy} disabled={invalid} onClick={async () => { setBusy(true); try { await onSave(fromLocalInput(s), fromLocalInput(e)); onOpenChange(false); } finally { setBusy(false); } }}>Enregistrer</Button>
      </>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-semibold">Début<input type="datetime-local" value={s} onChange={(x) => setS(x.target.value)} className={dateInputClass} /></label>
        <label className="grid gap-1.5 text-sm font-semibold">Fin<input type="datetime-local" value={e} min={s || undefined} onChange={(x) => setE(x.target.value)} className={dateInputClass} aria-invalid={invalid || undefined} /></label>
      </div>
      {invalid && <p role="alert" className="mt-2 text-[13px] font-medium text-danger">La fin doit être après le début.</p>}
    </Dialog>
  );
}
