"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Check as CheckIcon, CheckCircle2, ClipboardCheck, Clock, ExternalLink, MapPin, PartyPopper, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/bits";
import { adminError, getQueue, reviewVendors } from "@/lib/admin/api";
import { REJECT_REASONS, readiness, type AdminVendorDetail } from "@/lib/admin/types";
import { cn } from "@/lib/utils";
import { useAdmin } from "./context";
import { PublicPreview } from "./preview";
import { Check, PageHeader, Panel, ReasonDialog, waited } from "./ui";

export function ValidationQueue() {
  const { refreshPending } = useAdmin();
  const [queue, setQueue] = React.useState<AdminVendorDetail[] | null>(null);
  const [error, setError] = React.useState("");
  const [current, setCurrent] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [reject, setReject] = React.useState<string[] | null>(null);
  const [busy, setBusy] = React.useState(false);
  const detailRef = React.useRef<HTMLDivElement>(null);

  const load = React.useCallback(() => {
    getQueue().then((q) => { setQueue(q); setError(""); setCurrent((c) => (c && q.some((v) => v.id === c) ? c : q[0]?.id ?? null)); })
      .catch((e: Error) => setError(e.message));
  }, []);
  React.useEffect(load, [load]);

  const v = queue?.find((x) => x.id === current) ?? null;

  async function decide(ids: string[], decision: "approve" | "reject", reason?: string) {
    setBusy(true);
    try {
      const r = await reviewVendors(ids, decision, reason);
      if (r.ok) toast.success(decision === "approve" ? `${r.ok} vitrine${r.ok > 1 ? "s" : ""} mise${r.ok > 1 ? "s" : ""} en ligne` : `${r.ok} vitrine${r.ok > 1 ? "s" : ""} refusée${r.ok > 1 ? "s" : ""} — motif envoyé`);
      r.errors.forEach((e) => toast.error(`${queue?.find((x) => x.id === e.id)?.name ?? "Vitrine"} : ${adminError(e.error)}`));
      const done = new Set(ids.filter((id) => !r.errors.some((e) => e.id === id)));
      // passe au profil suivant dans la file
      const rest = (queue ?? []).filter((x) => !done.has(x.id));
      const idx = (queue ?? []).findIndex((x) => x.id === current);
      setQueue(rest);
      setCurrent(done.has(current ?? "") ? (rest[Math.min(idx, rest.length - 1)]?.id ?? null) : current);
      setSelected((s) => new Set([...s].filter((id) => !done.has(id))));
      setReject(null);
      refreshPending();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const open = (id: string) => {
    setCurrent(id);
    // sur mobile, le détail est sous la liste : on y amène l'utilisateur
    if (window.matchMedia("(max-width: 1023px)").matches) requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  if (error) return (
    <>
      <PageHeader title="File de validation" />
      <EmptyState icon={<AlertTriangle />} title="Chargement impossible" action={<Button variant="outline" size="sm" onClick={load}><RefreshCw aria-hidden />Réessayer</Button>}>{error}</EmptyState>
    </>
  );

  const allOn = !!queue?.length && queue.every((x) => selected.has(x.id));

  return (
    <>
      <PageHeader title="File de validation"
        sub={queue ? (queue.length ? `${queue.length} vitrine${queue.length > 1 ? "s" : ""} à vérifier avant publication — les plus anciennes d’abord` : "Tout est traité") : "Chargement…"}
        actions={selected.size > 0 && <>
          <Button size="sm" loading={busy} onClick={() => decide([...selected], "approve")}><CheckIcon aria-hidden />Valider ({selected.size})</Button>
          <Button size="sm" variant="danger" onClick={() => setReject([...selected])}><X aria-hidden />Refuser ({selected.size})</Button>
        </>} />

      {queue && !queue.length ? (
        <EmptyState icon={<PartyPopper />} title="Aucune vitrine en attente" action={<Button asChild variant="outline" size="sm"><Link href="/admin/prestataires">Voir tous les prestataires</Link></Button>}>
          Les nouvelles demandes de publication apparaîtront ici.
        </EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
          {/* Liste */}
          <Panel className="lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6.5rem)] lg:overflow-y-auto">
            <div className="flex items-center gap-3 border-b border-line px-3 py-2 text-[12px] font-semibold uppercase tracking-[.08em] text-muted">
              <Check label="Tout sélectionner" checked={allOn} indeterminate={selected.size > 0 && !allOn} onChange={(on) => setSelected(on ? new Set(queue?.map((x) => x.id)) : new Set())} />
              En attente
            </div>
            <ul className="divide-y divide-line" aria-label="Vitrines en attente">
              {!queue ? Array.from({ length: 5 }, (_, i) => <li key={i} className="p-3"><div className="skeleton h-12 rounded-lg" /></li>) : queue.map((x) => {
                const missing = readiness(x).filter((c) => c.required && !c.ok).length;
                const on = x.id === current;
                return (
                  <li key={x.id} className={cn("flex items-center gap-3 px-3 py-2.5", on && "bg-gold/10")}>
                    <Check label={`Sélectionner ${x.name}`} checked={selected.has(x.id)} onChange={(c) => setSelected((s) => { const n = new Set(s); if (c) n.add(x.id); else n.delete(x.id); return n; })} />
                    <button type="button" onClick={() => open(x.id)} aria-current={on ? "true" : undefined} className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-[13.5px] font-semibold">{x.name}</span>
                      <span className="flex items-center gap-2 text-[12px] text-muted">
                        <span className="truncate">{x.category?.name} · {x.city}</span>
                        <span className="ml-auto inline-flex shrink-0 items-center gap-1 tabular"><Clock className="size-3" aria-hidden />{waited(x.submittedAt)}</span>
                      </span>
                      {missing > 0 && <span className="mt-0.5 block text-[12px] font-semibold text-danger">{missing} point{missing > 1 ? "s" : ""} bloquant{missing > 1 ? "s" : ""}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </Panel>

          {/* Détail */}
          <div ref={detailRef} className="min-w-0 scroll-mt-16">
            {!v ? <div className="skeleton h-[520px] rounded-2xl" /> : <QueueItem key={v.id} v={v} busy={busy}
              onApprove={() => decide([v.id], "approve")} onReject={() => setReject([v.id])}
              onBack={() => document.querySelector("main")?.scrollIntoView({ behavior: "smooth" })} />}
          </div>
        </div>
      )}

      <ReasonDialog open={!!reject} onOpenChange={(o) => !o && setReject(null)}
        title={reject && reject.length > 1 ? `Refuser ${reject.length} vitrines` : `Refuser « ${queue?.find((x) => x.id === reject?.[0])?.name ?? ""} »`}
        description="Le motif est envoyé par e-mail. Le prestataire corrige puis renvoie sa vitrine en validation."
        presets={REJECT_REASONS} confirmLabel="Refuser et notifier" onConfirm={(r) => decide(reject ?? [], "reject", r)} />
    </>
  );
}

function QueueItem({ v, busy, onApprove, onReject, onBack }: { v: AdminVendorDetail; busy: boolean; onApprove: () => void; onReject: () => void; onBack: () => void }) {
  const checks = readiness(v);
  const blocking = checks.filter((c) => c.required && !c.ok);
  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line p-4">
        <div className="min-w-0">
          <button type="button" onClick={onBack} className="mb-1 inline-flex items-center gap-1 text-[12px] font-semibold text-muted lg:hidden"><ArrowLeft className="size-3.5" aria-hidden />Liste</button>
          <h2 className="font-display text-2xl leading-tight">{v.name}</h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-muted">
            <span>{v.categories.map((c) => c.name).join(", ")}</span>
            <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" aria-hidden />{v.city}</span>
            <span>· soumise il y a {waited(v.submittedAt)}</span>
          </p>
        </div>
        <Link href={`/admin/prestataires/${v.id}`} className="inline-flex items-center gap-1 text-[13px] font-semibold text-gold-ink hover:underline">Fiche complète<ExternalLink className="size-3.5" aria-hidden /></Link>
      </div>

      <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <PublicPreview v={v} />
        <div className="grid content-start gap-4 text-[13.5px]">
          <section aria-labelledby={`chk-${v.id}`}>
            <h3 id={`chk-${v.id}`} className="mb-2 text-[12px] font-bold uppercase tracking-[.08em] text-muted">Contrôles</h3>
            <ul className="grid gap-1.5">
              {checks.map((c) => (
                <li key={c.label} className="flex items-start gap-2">
                  {c.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> : <AlertTriangle className={cn("mt-0.5 size-4 shrink-0", c.required ? "text-danger" : "text-muted")} aria-hidden />}
                  <span className={cn(!c.ok && c.required && "font-semibold text-danger")}>{c.label}<span className="sr-only">{c.ok ? " : conforme" : " : à corriger"}</span></span>
                </li>
              ))}
            </ul>
          </section>
          <section aria-labelledby={`ph-${v.id}`}>
            <h3 id={`ph-${v.id}`} className="mb-2 text-[12px] font-bold uppercase tracking-[.08em] text-muted">Toutes les photos ({v.media.length})</h3>
            <ul className="grid grid-cols-4 gap-1">
              {v.media.slice(0, 16).map((m) => (
                // eslint-disable-next-line @next/next/no-img-element
                <li key={m.id} className="aspect-square overflow-hidden rounded-md bg-surface-2"><img src={m.url} alt="" loading="lazy" className="size-full object-cover" /></li>
              ))}
            </ul>
          </section>
          <section className="grid gap-1 text-muted">
            <p><b className="text-text">Contact :</b> {v.phone ?? v.whatsapp ?? "aucun"}{v.email && ` · ${v.email}`}</p>
            {v.packages[0] && <p><b className="text-text">Forfait :</b> {v.packages[0].name} — {v.packages[0].amount} {v.packages[0].currency}</p>}
          </section>
        </div>
      </div>

      {/* Barre d'action : collée en bas sur mobile pour valider d'un pouce */}
      <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t border-line bg-surface/95 p-3 backdrop-blur" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
        {blocking.length > 0 && <p className="mr-auto text-[12.5px] text-danger">{blocking.length} point{blocking.length > 1 ? "s" : ""} bloquant{blocking.length > 1 ? "s" : ""} : refusez avec le motif correspondant.</p>}
        <Button variant="danger" size="sm" className="ml-auto" onClick={onReject} disabled={busy}><X aria-hidden />Refuser</Button>
        <Button size="sm" loading={busy} onClick={onApprove} disabled={blocking.length > 0} title={blocking.length ? "Des éléments obligatoires manquent" : undefined}>
          <ClipboardCheck aria-hidden />Valider et publier
        </Button>
      </div>
    </Panel>
  );
}
