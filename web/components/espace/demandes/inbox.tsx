"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type KeyboardCoordinateGetter } from "@dnd-kit/core";
import { CalendarDays, GripVertical, Inbox, LayoutList, Columns3, MapPin, Search, Users, X } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState, Skeleton, StatusTag, dateFr, timeAgo } from "@/components/ui/bits";
import { useEspace } from "@/lib/espace/store";
import { INQUIRY_STATUS, type Inquiry, type InquiryStatus } from "@/lib/espace/types";
import { cn, formatPrice } from "@/lib/utils";
import { STATUS_ORDER, StatusMenu, useStatusFlow } from "./status";

type View = "liste" | "kanban";

function lastMessage(msgs: { inquiryId: string; body: string; sender: string; createdAt: string }[], q: Inquiry) {
  const m = [...msgs].reverse().find((x) => x.inquiryId === q.id && x.sender !== "system");
  return m ? { body: (m.sender === "vendor" ? "Vous : " : "") + m.body, at: m.createdAt } : { body: q.message, at: q.createdAt };
}

function Meta({ q }: { q: Inquiry }) {
  return (
    <p className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-muted">
      <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" aria-hidden />{dateFr(q.weddingDate, { day: "numeric", month: "short", year: "numeric" })}</span>
      <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" aria-hidden />{q.city}</span>
      {q.guests && <span className="inline-flex items-center gap-1"><Users className="size-3.5" aria-hidden />{q.guests}</span>}
      {q.budget && <span className="tabular-nums">{formatPrice(q.budget, "USD")}</span>}
    </p>
  );
}

/* ---------------------------------------------------------
   Vue liste
   --------------------------------------------------------- */
function ListView({ items, onStatus }: { items: Inquiry[]; onStatus: (id: string, s: InquiryStatus) => void }) {
  const { data, typing } = useEspace();
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
      {items.map((q) => {
        const last = lastMessage(data.messages, q);
        return (
          <li key={q.id} className="relative flex gap-4 px-4 py-4 transition-colors focus-within:bg-surface-2/60 hover:bg-surface-2/60 sm:px-6">
            <span className={cn("mt-2 size-2.5 shrink-0 rounded-full", q.unread ? "bg-rose" : "bg-transparent")} aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Link href={`/espace/demandes/${q.id}`} className={cn("font-display text-lg leading-tight after:absolute after:inset-0 focus-visible:outline-none", q.unread && "font-bold")}>
                  {q.couple}{q.unread && <span className="sr-only"> (non lue)</span>}
                </Link>
                <span className="ml-auto text-xs text-muted">{timeAgo(last.at)}</span>
              </div>
              <Meta q={q} />
              <p className={cn("mt-1.5 line-clamp-1 text-sm", q.unread ? "text-text" : "text-muted")}>
                {typing[q.id] ? <em className="text-gold-ink">écrit…</em> : last.body}
              </p>
            </div>
            <div className="relative z-10 shrink-0 self-center"><StatusMenu id={q.id} status={q.status} onChange={onStatus} /></div>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------------------------------------------------------
   Vue Kanban (glisser-déposer + menu de statut sur chaque carte)
   --------------------------------------------------------- */
function KanbanCard({ q, onStatus, overlay }: { q: Inquiry; onStatus: (id: string, s: InquiryStatus) => void; overlay?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: q.id, disabled: overlay });
  return (
    <article ref={overlay ? undefined : setNodeRef}
      className={cn("relative rounded-2xl border border-line bg-surface p-3.5 shadow-sm", isDragging && "opacity-30", overlay && "rotate-2 shadow-2xl ring-1 ring-gold")}>
      <div className="flex items-start gap-2">
        <button type="button" {...listeners} {...attributes} aria-roledescription="carte déplaçable" aria-label={`Déplacer la demande de ${q.couple}`}
          className="-ml-1 mt-0.5 grid size-8 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text active:cursor-grabbing">
          <GripVertical className="size-4" aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          <Link href={`/espace/demandes/${q.id}`} className={cn("block font-semibold leading-snug hover:text-gold-ink", q.unread && "text-text")}>
            {q.unread && <span className="mr-1.5 inline-block size-2 rounded-full bg-rose align-middle" aria-hidden />}{q.couple}{q.unread && <span className="sr-only"> (non lue)</span>}
          </Link>
          <p className="mt-1 text-[13px] text-muted">{dateFr(q.weddingDate, { day: "numeric", month: "short", year: "numeric" })} · {q.city}</p>
          {q.budget && <p className="mt-0.5 text-[13px] tabular-nums text-muted">Budget {formatPrice(q.budget, "USD")}</p>}
        </div>
      </div>
      {!overlay && <div className="mt-2.5 pl-8"><StatusMenu id={q.id} status={q.status} onChange={onStatus} /></div>}
    </article>
  );
}

function Column({ status, items, onStatus, colRef }: { status: InquiryStatus; items: Inquiry[]; onStatus: (id: string, s: InquiryStatus) => void; colRef: (el: HTMLElement | null) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const s = INQUIRY_STATUS[status];
  return (
    <section ref={(el) => { setNodeRef(el); colRef(el); }} aria-label={`${s.label}, ${items.length} demande${items.length > 1 ? "s" : ""}`}
      className={cn("flex w-[78vw] max-w-[300px] shrink-0 snap-start flex-col rounded-3xl border bg-surface-2/50 p-3 transition-colors sm:w-[280px] lg:w-auto lg:max-w-none lg:shrink", isOver ? "border-gold bg-gold/8" : "border-line")}>
      <header className="mb-3 flex items-center justify-between px-1.5 pt-1">
        <StatusTag tone={s.tone}>{s.label}</StatusTag>
        <span className="text-sm font-semibold tabular-nums text-muted">{items.length}</span>
      </header>
      <div className="grid min-h-24 content-start gap-2.5">
        {items.map((q) => <KanbanCard key={q.id} q={q} onStatus={onStatus} />)}
        {!items.length && <p className="rounded-2xl border border-dashed border-line-strong px-3 py-6 text-center text-[13px] text-muted">Déposez une demande ici</p>}
      </div>
    </section>
  );
}

function KanbanView({ items, onStatus }: { items: Inquiry[]; onStatus: (id: string, s: InquiryStatus) => void }) {
  const cols = useRef(new Map<InquiryStatus, HTMLElement>());
  const [active, setActive] = useState<Inquiry | null>(null);
  // Au clavier : ← / → sautent d’une colonne à l’autre
  const coordinateGetter: KeyboardCoordinateGetter = (e, { currentCoordinates }) => {
    if (e.code !== "ArrowRight" && e.code !== "ArrowLeft") return undefined;
    e.preventDefault();
    const rects = STATUS_ORDER.map((s) => cols.current.get(s)?.getBoundingClientRect()).filter(Boolean) as DOMRect[];
    const i = rects.findIndex((r) => currentCoordinates.x >= r.left - 8 && currentCoordinates.x <= r.right + 8);
    const next = rects[Math.min(rects.length - 1, Math.max(0, (i < 0 ? 0 : i) + (e.code === "ArrowRight" ? 1 : -1)))];
    return next ? { x: next.left + 24, y: next.top + 60 } : undefined;
  };
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter }),
  );
  const end = (e: DragEndEvent) => {
    setActive(null);
    const to = e.over?.id as InquiryStatus | undefined;
    const q = items.find((x) => x.id === e.active.id);
    if (q && to && q.status !== to) onStatus(q.id, to);
  };
  const label = (id: string | number) => items.find((x) => x.id === id)?.couple ?? "";
  const col = (id?: string | number) => (id ? INQUIRY_STATUS[id as InquiryStatus]?.label : undefined);

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={(e) => setActive(items.find((x) => x.id === e.active.id) ?? null)} onDragEnd={end} onDragCancel={() => setActive(null)}
      accessibility={{
        screenReaderInstructions: { draggable: "Appuyez sur Espace pour saisir la carte, puis sur les flèches gauche et droite pour changer de colonne. Espace pour déposer, Échap pour annuler." },
        announcements: {
          onDragStart: ({ active: a }) => `Demande de ${label(a.id)} saisie.`,
          onDragOver: ({ active: a, over }) => (over ? `${label(a.id)} au-dessus de la colonne ${col(over.id)}.` : undefined),
          onDragEnd: ({ active: a, over }) => (over ? `${label(a.id)} déplacée vers ${col(over.id)}.` : `${label(a.id)} relâchée.`),
          onDragCancel: ({ active: a }) => `Déplacement de ${label(a.id)} annulé.`,
        },
      }}>
      <div className="-mx-4 flex snap-x snap-mandatory items-start gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-5 lg:overflow-visible lg:px-0">
        {STATUS_ORDER.map((s) => (
          <Column key={s} status={s} items={items.filter((q) => q.status === s)} onStatus={onStatus} colRef={(el) => { if (el) cols.current.set(s, el); else cols.current.delete(s); }} />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(.22,1,.36,1)" }}>{active && <KanbanCard q={active} onStatus={onStatus} overlay />}</DragOverlay>
    </DndContext>
  );
}

/* ---------------------------------------------------------
   Page
   --------------------------------------------------------- */
export function Demandes() {
  const { data } = useEspace();
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const [view, setView] = useState<View>(params.get("vue") === "kanban" ? "kanban" : "liste");
  const [filter, setFilter] = useState<InquiryStatus | "all" | "unread">((params.get("statut") as InquiryStatus) ?? "all");
  const [query, setQuery] = useState("");
  const { request, dialogs } = useStatusFlow();

  const sync = (v: View, f: string) => {
    const q = new URLSearchParams();
    if (v === "kanban") q.set("vue", v);
    if (f !== "all" && v === "liste") q.set("statut", f);
    router.replace(`${path}${q.size ? `?${q}` : ""}`, { scroll: false });
  };

  const searched = useMemo(() => {
    const s = query.trim().toLowerCase();
    const list = [...data.inquiries].sort((a, b) => +new Date(lastMessage(data.messages, b).at) - +new Date(lastMessage(data.messages, a).at));
    return s ? list.filter((q) => `${q.couple} ${q.city} ${q.venue ?? ""} ${q.message}`.toLowerCase().includes(s)) : list;
  }, [data.inquiries, data.messages, query]);
  const shown = view === "kanban" || filter === "all" ? searched : filter === "unread" ? searched.filter((q) => q.unread) : searched.filter((q) => q.status === filter);
  const unread = data.inquiries.filter((q) => q.unread).length;
  const count = (s: InquiryStatus) => searched.filter((q) => q.status === s).length;

  const chips: { id: typeof filter; label: string; n: number }[] = [
    { id: "all", label: "Toutes", n: searched.length },
    { id: "unread", label: "Non lues", n: searched.filter((q) => q.unread).length },
    ...STATUS_ORDER.map((s) => ({ id: s, label: INQUIRY_STATUS[s].label, n: count(s) })),
  ];

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="font-display text-[2.1rem] leading-tight sm:text-5xl"><em className="text-gold-ink">Demandes</em></h1>
          <p className="mt-1 text-muted">{unread ? `${unread} demande${unread > 1 ? "s" : ""} non lue${unread > 1 ? "s" : ""}. Répondre en moins de 2 h double vos chances de signer.` : "Toutes vos demandes sont à jour."}</p>
        </div>
        <Segmented layoutId="inbox-view" label="Affichage" value={view} onChange={(v) => { setView(v); sync(v, filter); }}
          options={[{ value: "liste", label: <span className="inline-flex items-center gap-2"><LayoutList className="size-4" aria-hidden />Liste</span> }, { value: "kanban", label: <span className="inline-flex items-center gap-2"><Columns3 className="size-4" aria-hidden />Kanban</span> }]} />
      </div>

      {data.inquiries.length > 0 && (
        <div className="grid grid-cols-1 gap-3">
          <label className="relative block max-w-md">
            <span className="sr-only">Rechercher une demande</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un couple, une ville…"
              className="h-12 w-full rounded-full border border-line-strong bg-surface pl-11 pr-11 text-[15px] focus-visible:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 [&::-webkit-search-cancel-button]:hidden" />
            {query && <button type="button" onClick={() => setQuery("")} className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-surface-2" aria-label="Effacer la recherche"><X className="size-4" aria-hidden /></button>}
          </label>
          {view === "liste" && (
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filtrer par statut">
              {chips.map((c) => (
                <button key={c.id} type="button" aria-pressed={filter === c.id} onClick={() => { setFilter(c.id); sync(view, c.id); }}
                  className={cn("inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors", filter === c.id ? "border-gold bg-gold text-on-gold" : "border-line text-muted hover:border-gold hover:text-text")}>
                  {c.label}<span className={cn("tabular-nums", filter === c.id ? "opacity-80" : "opacity-60")}>{c.n}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {data.inquiries.length === 0 ? (
        <EmptyState icon={<Inbox />} title="Pas encore de demande">
          Les demandes des couples arrivent ici. Une vitrine complète avec au moins 12 photos et un forfait clair reçoit en moyenne 3 fois plus de demandes.
        </EmptyState>
      ) : shown.length === 0 ? (
        <EmptyState icon={<Search />} title="Aucun résultat" action={<button type="button" className="text-sm font-semibold text-gold-ink underline-offset-4 hover:underline" onClick={() => { setQuery(""); setFilter("all"); sync(view, "all"); }}>Effacer les filtres</button>}>
          Aucune demande ne correspond à votre recherche.
        </EmptyState>
      ) : view === "liste" ? <ListView items={shown} onStatus={request} /> : <KanbanView items={shown} onStatus={request} />}
      {dialogs}
    </div>
  );
}

export function DemandesSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6" aria-busy="true" aria-label="Chargement des demandes">
      <div className="flex justify-between gap-6"><Skeleton className="h-14 w-56" /><Skeleton className="h-11 w-52 rounded-full" /></div>
      <Skeleton className="h-12 max-w-md rounded-full" />
      <div className="grid gap-px overflow-hidden rounded-3xl border border-line">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-24 rounded-none" />)}</div>
    </div>
  );
}
