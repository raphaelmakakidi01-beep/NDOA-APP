"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Ban, CalendarRange, ChevronLeft, ChevronRight, ExternalLink, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { Card, CardHeader, Skeleton, StatusTag, dateFr } from "@/components/ui/bits";
import { useEspace } from "@/lib/espace/store";
import { useBusiness } from "@/lib/espace/business";
import type { DayEntry, DayStatus, Inquiry } from "@/lib/espace/types";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];
const WEEKDAYS_LONG = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const monthKey = (d: Date) => iso(d).slice(0, 7);

const LOOK: Record<DayStatus | "free", { label: string; cell: string; dot: string; tone: "success" | "gold" | "muted" | "rose" }> = {
  booked: { label: "Réservé", cell: "bg-bordeaux text-ivory border-bordeaux", dot: "bg-bordeaux", tone: "rose" },
  option: { label: "En option", cell: "bg-gold/18 border-gold text-text", dot: "bg-gold", tone: "gold" },
  blocked: { label: "Bloqué", cell: "bg-surface-2 border-line-strong text-muted bg-[repeating-linear-gradient(135deg,transparent_0_6px,var(--color-line)_6px_7px)]", dot: "bg-muted", tone: "muted" },
  free: { label: "Libre", cell: "border-line hover:border-gold", dot: "bg-transparent border border-line-strong", tone: "success" },
};
const PUBLIC: Record<DayStatus | "free", string> = { booked: "Indisponible", blocked: "Indisponible", option: "Très demandée", free: "Disponible" };

function buildMonth(key: string) {
  const [y, m] = key.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const offset = (first.getDay() + 6) % 7;
  const days = new Date(y, m, 0).getDate();
  const cells: (string | null)[] = Array.from({ length: offset }, () => null);
  for (let d = 1; d <= days; d++) cells.push(iso(new Date(y, m - 1, d)));
  while (cells.length % 7) cells.push(null);
  return { cells, label: first.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }) };
}

/* ---------------------------------------------------------
   Édition d’un jour
   --------------------------------------------------------- */
function DayDialog({ day, onClose }: { day: string; onClose: () => void }) {
  const { data } = useEspace();
  const biz = useBusiness();
  const entry = data.availability[day];
  const linked = entry?.inquiryId ? data.inquiries.find((q) => q.id === entry.inquiryId) : undefined;
  const requests = data.inquiries.filter((q) => q.weddingDate === day && q.status !== "lost");
  const [status, setStatus] = useState<DayStatus | "free">(entry?.status ?? "free");
  const [note, setNote] = useState(entry?.note ?? "");
  const locked = entry?.status === "booked" && !!linked;
  const title = dateFr(day, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const save = () => {
    const next: DayEntry | null = status === "free" ? null : { status, note: note.trim() || undefined, inquiryId: status === entry?.status ? entry?.inquiryId : undefined };
    biz.setDay(day, next);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={<span className="first-letter:uppercase">{title}</span>}
      footer={locked ? <Button variant="outline" onClick={onClose}>Fermer</Button> : <><Button variant="ghost" onClick={onClose}>Annuler</Button><Button onClick={save}>Enregistrer</Button></>}>
      <div className="grid gap-5">
        {locked ? (
          <p className="rounded-2xl bg-surface-2 px-4 py-3 text-sm">
            Réservée pour <Link href={`/espace/demandes/${linked.id}`} className="font-semibold text-gold-ink underline-offset-4 hover:underline">{linked.couple}</Link>. Pour libérer la date, changez le statut de la demande.
          </p>
        ) : (
          <>
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-sm font-semibold">Disponibilité</legend>
              {(["free", "option", "blocked", "booked"] as const).map((s) => (
                <label key={s} className="flex h-12 cursor-pointer items-center gap-3 rounded-xl border border-line px-4 text-[15px] has-[:checked]:border-gold has-[:checked]:bg-gold/8 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold/40">
                  <input type="radio" name="day-status" checked={status === s} onChange={() => setStatus(s)} className="size-4 accent-[var(--color-gold)]" />
                  <span className={cn("size-3 rounded-full", LOOK[s].dot)} aria-hidden />
                  {LOOK[s].label}
                  <span className="ml-auto text-[13px] text-muted">Couples : {PUBLIC[s]}</span>
                </label>
              ))}
            </fieldset>
            {status !== "free" && (
              <Field label="Note privée" optional hint="Visible par vous seul. Ex. mariage hors NDOA, congés.">
                {(a) => <Input id={a.id} aria-describedby={a.describedBy} value={note} maxLength={60} onChange={(e) => setNote(e.target.value)} />}
              </Field>
            )}
            {linked && entry?.status === "option" && <p className="text-sm text-muted">Option posée par le devis envoyé à <Link href={`/espace/demandes/${linked.id}`} className="font-semibold text-gold-ink underline-offset-4 hover:underline">{linked.couple}</Link>.</p>}
          </>
        )}
        {requests.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-semibold">Demandes pour cette date</p>
            <ul className="grid gap-2">
              {requests.map((q) => <RequestRow key={q.id} q={q} />)}
            </ul>
          </div>
        )}
      </div>
    </Dialog>
  );
}

function RequestRow({ q }: { q: Inquiry }) {
  return (
    <li>
      <Link href={`/espace/demandes/${q.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3 text-sm hover:border-gold">
        <span className="font-semibold">{q.couple}</span><span className="text-muted">{q.city}</span>
      </Link>
    </li>
  );
}

function RangeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const biz = useBusiness();
  const [from, setFrom] = useState(() => iso(new Date()));
  const [to, setTo] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 6); return iso(d); });
  const [note, setNote] = useState("Congés");
  const err = to < from ? "La fin doit être après le début." : undefined;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()} title="Bloquer une période" description="Congés, déplacement, autre engagement : ces dates s’affichent indisponibles pour les couples."
      footer={<><Button variant="ghost" onClick={onClose}>Annuler</Button><Button disabled={!!err} onClick={() => { biz.blockRange(from, to, note.trim() || "Indisponible"); onClose(); }}><Ban aria-hidden />Bloquer</Button></>}>
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Du">{(a) => <Input id={a.id} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />}</Field>
          <Field label="Au" error={err}>{(a) => <Input id={a.id} type="date" aria-invalid={a.invalid} aria-describedby={a.describedBy} min={from} value={to} onChange={(e) => setTo(e.target.value)} />}</Field>
        </div>
        <Field label="Note privée" optional>{(a) => <Input id={a.id} value={note} maxLength={60} onChange={(e) => setNote(e.target.value)} />}</Field>
        <p className="text-[13px] text-muted">Les dates déjà réservées ne sont pas modifiées.</p>
      </div>
    </Dialog>
  );
}

/* ---------------------------------------------------------
   Page
   --------------------------------------------------------- */
export function Calendrier() {
  const { data } = useEspace();
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const [today] = useState(() => iso(new Date()));
  const initial = /^\d{4}-\d{2}$/.test(params.get("mois") ?? "") ? params.get("mois")! : today.slice(0, 7);
  const [month, setMonth] = useState(initial);
  const [dir, setDir] = useState(1);
  const [view, setView] = useState<"moi" | "public">("moi");
  const [edit, setEdit] = useState<string | null>(null);
  const [range, setRange] = useState(false);
  const grid = useRef<HTMLDivElement>(null);
  const { cells, label } = useMemo(() => buildMonth(month), [month]);
  const byId = useMemo(() => new Map(data.inquiries.map((q) => [q.id, q])), [data.inquiries]);

  const go = (delta: number | "today") => {
    const [y, m] = month.split("-").map(Number);
    const next = delta === "today" ? today.slice(0, 7) : monthKey(new Date(y, m - 1 + delta, 1));
    setDir(delta === "today" ? (next > month ? 1 : -1) : delta);
    setMonth(next);
    router.replace(`${path}?mois=${next}`, { scroll: false });
  };

  const inMonth = Object.entries(data.availability).filter(([d]) => d.startsWith(month)).sort(([a], [b]) => a.localeCompare(b));
  const counts = { booked: 0, option: 0, blocked: 0 };
  inMonth.forEach(([, e]) => counts[e.status]++);
  const upcoming = Object.entries(data.availability).filter(([d, e]) => d >= today && e.status !== "blocked").sort(([a], [b]) => a.localeCompare(b)).slice(0, 6);

  // Navigation clavier dans la grille : flèches, Début/Fin
  const onKey = (e: React.KeyboardEvent) => {
    const t = e.target as HTMLElement;
    const d = t.dataset.day;
    if (!d) return;
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 }[e.key];
    if (!step) return;
    e.preventDefault();
    const n = new Date(`${d}T12:00`); n.setDate(n.getDate() + step);
    const target = iso(n);
    if (!target.startsWith(month)) { go(step > 0 ? 1 : -1); setTimeout(() => (grid.current?.querySelector(`[data-day="${target}"]`) as HTMLElement | null)?.focus(), 60); return; }
    (grid.current?.querySelector(`[data-day="${target}"]`) as HTMLElement | null)?.focus();
  };

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="font-display text-[2.1rem] leading-tight sm:text-5xl"><em className="text-gold-ink">Calendrier</em></h1>
          <p className="mt-1 text-muted">Vos disponibilités, synchronisées en temps réel avec votre page publique.</p>
        </div>
        <Button variant="outline" onClick={() => setRange(true)}><CalendarRange aria-hidden />Bloquer une période</Button>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="p-3 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center gap-3 px-1">
            <h2 className="font-display text-2xl first-letter:uppercase" aria-live="polite">{label}</h2>
            <div className="ml-auto flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => go("today")} disabled={month === today.slice(0, 7)}>Aujourd’hui</Button>
              <button type="button" onClick={() => go(-1)} className="grid size-10 place-items-center rounded-full border border-line hover:border-gold" aria-label="Mois précédent"><ChevronLeft className="size-4" aria-hidden /></button>
              <button type="button" onClick={() => go(1)} className="grid size-10 place-items-center rounded-full border border-line hover:border-gold" aria-label="Mois suivant"><ChevronRight className="size-4" aria-hidden /></button>
            </div>
            <Segmented layoutId="cal-view" label="Point de vue" className="w-full sm:w-auto" value={view} onChange={setView}
              options={[{ value: "moi", label: "Ma vue" }, { value: "public", label: <span className="inline-flex items-center gap-1.5"><Globe className="size-3.5" aria-hidden />Vue des couples</span> }]} />
          </div>

          <div className="grid grid-cols-7 gap-1 px-1 pb-2 sm:gap-2" aria-hidden>
            {WEEKDAYS.map((w) => <span key={w} className="text-center text-xs font-semibold uppercase tracking-wide text-muted">{w}</span>)}
          </div>
          <AnimatePresence mode="popLayout" initial={false} custom={dir}>
            <motion.div key={month} ref={grid} onKeyDown={onKey} role="group" aria-label={`Jours de ${label}`}
              custom={dir} initial={{ opacity: 0, x: dir * 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * -24 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="grid grid-cols-7 gap-1 sm:gap-2">
              {cells.map((d, i) => {
                if (!d) return <span key={`e${i}`} aria-hidden />;
                const e = data.availability[d] as DayEntry | undefined;
                const s = e?.status ?? "free";
                const q = e?.inquiryId ? byId.get(e.inquiryId) : undefined;
                const past = d < today;
                const caption = view === "public" ? PUBLIC[s] : q ? q.couple.split(/\s*(?:&|et)\s*/)[0] : e?.note;
                const name = `${WEEKDAYS_LONG[i % 7]} ${dateFr(d, { day: "numeric", month: "long" })}, ${view === "public" ? PUBLIC[s] : LOOK[s].label}${q ? `, ${q.couple}` : e?.note ? `, ${e.note}` : ""}${d === today ? ", aujourd’hui" : ""}`;
                return (
                  <button key={d} type="button" data-day={d} onClick={() => setEdit(d)} aria-label={name} disabled={view === "public"}
                    className={cn("relative flex aspect-square min-w-0 flex-col items-start rounded-xl border p-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 disabled:cursor-default sm:aspect-[1.15] sm:rounded-2xl sm:p-2.5",
                      view === "public" ? (s === "booked" || s === "blocked" ? "border-line bg-surface-2 text-muted line-through decoration-muted/40" : s === "option" ? "border-gold/60" : "border-line") : LOOK[s].cell,
                      past && "opacity-45")}>
                    <span className={cn("text-sm font-semibold tabular-nums sm:text-base", d === today && "grid size-7 place-items-center rounded-full bg-gold text-on-gold")}>{Number(d.slice(8))}</span>
                    {caption && <span className="mt-auto hidden w-full truncate text-[11px] leading-tight sm:block">{caption}</span>}
                    {s !== "free" && view === "moi" && <span className={cn("absolute bottom-1.5 right-1.5 size-1.5 rounded-full sm:hidden", s === "booked" ? "bg-ivory" : LOOK[s].dot)} aria-hidden />}
                  </button>
                );
              })}
            </motion.div>
          </AnimatePresence>

          <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 px-1 text-[13px] text-muted" aria-label="Légende">
            {(view === "moi" ? (["booked", "option", "blocked", "free"] as const) : (["booked", "option", "free"] as const)).map((s) => (
              <li key={s} className="inline-flex items-center gap-2"><span className={cn("size-3.5 rounded-md border", view === "moi" ? LOOK[s].cell : s === "booked" ? "border-line bg-surface-2" : s === "option" ? "border-gold/60" : "border-line")} aria-hidden />{view === "moi" ? LOOK[s].label : PUBLIC[s]}</li>
            ))}
          </ul>
          {view === "public" && <p className="mt-3 px-1 text-[13px] text-muted">C’est ce que voient les couples sur votre page. Vos notes et les noms restent privés.</p>}
        </Card>

        <div className="grid content-start gap-6">
          <Card>
            <CardHeader title="Ce mois-ci" />
            <dl className="grid grid-cols-3 gap-3 text-center">
              {(["booked", "option", "blocked"] as const).map((s) => (
                <div key={s} className="rounded-2xl bg-surface-2 px-2 py-3"><dd className="font-display text-3xl tabular-nums">{counts[s]}</dd><dt className="text-xs text-muted">{LOOK[s].label}</dt></div>
              ))}
            </dl>
          </Card>
          <Card>
            <CardHeader title="Prochains mariages" sub="Dates réservées et options en cours." />
            {upcoming.length === 0 ? <p className="text-sm text-muted">Aucune date à venir. Les mariages confirmés apparaissent ici automatiquement.</p> : (
              <ul className="grid gap-2">
                {upcoming.map(([d, e]) => {
                  const q = e.inquiryId ? byId.get(e.inquiryId) : undefined;
                  const body = (
                    <>
                      <span className="w-12 shrink-0 text-center"><span className="block font-display text-2xl leading-none">{Number(d.slice(8))}</span><span className="text-[11px] uppercase text-muted">{dateFr(d, { month: "short" })}</span></span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{q?.couple ?? e.note ?? "Sans nom"}</span><StatusTag tone={LOOK[e.status].tone} className="mt-1">{LOOK[e.status].label}</StatusTag></span>
                      {q && <ExternalLink className="size-4 text-muted" aria-hidden />}
                    </>
                  );
                  return <li key={d}>{q ? <Link href={`/espace/demandes/${q.id}`} className="flex items-center gap-3 rounded-2xl border border-line p-3 hover:border-gold">{body}</Link> : <button type="button" onClick={() => { setMonth(d.slice(0, 7)); setEdit(d); }} className="flex w-full items-center gap-3 rounded-2xl border border-line p-3 text-left hover:border-gold">{body}</button>}</li>;
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {edit && <DayDialog key={edit} day={edit} onClose={() => setEdit(null)} />}
      <RangeDialog key={String(range)} open={range} onClose={() => setRange(false)} />
    </div>
  );
}

export function CalendrierSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6" aria-busy="true" aria-label="Chargement du calendrier">
      <div className="flex justify-between gap-6"><Skeleton className="h-14 w-60" /><Skeleton className="h-11 w-52 rounded-full" /></div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Skeleton className="h-[560px] rounded-3xl" />
        <div className="grid content-start gap-6"><Skeleton className="h-40 rounded-3xl" /><Skeleton className="h-72 rounded-3xl" /></div>
      </div>
    </div>
  );
}
