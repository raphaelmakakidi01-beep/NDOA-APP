"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Ban, Check as CheckIcon, EyeOff, Flag, ImageOff, MessageSquareQuote, RefreshCw, RotateCcw, ShieldCheck, Store, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, Stars, StatusTag } from "@/components/ui/bits";
import { Segmented } from "@/components/ui/segmented";
import { listHiddenMedia, listPendingReviews, listReports, moderate } from "@/lib/admin/content";
import { MODERATION_REASONS, TARGET_LABEL, reasonLabel, type HiddenMedia, type PendingReview, type ReportGroup, type ReportTarget } from "@/lib/admin/content-types";
import { cn } from "@/lib/utils";
import { useAdmin } from "./context";
import { Check, ConfirmDialog, FilterSelect, PageHeader, Panel, fmtDate, waited } from "./ui";

type Tab = "reports" | "reviews" | "hidden";
type Decision = { type: ReportTarget; id: string; action: "hide" | "delete"; label: string; suggested?: string };

export function Moderation() {
  const { isAdmin } = useAdmin();
  const [tab, setTab] = React.useState<Tab>("reports");
  const [reports, setReports] = React.useState<ReportGroup[] | null>(null);
  const [reviews, setReviews] = React.useState<PendingReview[] | null>(null);
  const [hidden, setHidden] = React.useState<HiddenMedia[] | null>(null);
  const [error, setError] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<"" | ReportTarget>("");
  const [decision, setDecision] = React.useState<Decision | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState("");

  const load = React.useCallback(() => {
    Promise.all([listReports(), listPendingReviews(), listHiddenMedia()])
      .then(([r, v, h]) => { setReports(r); setReviews(v); setHidden(h); setError(""); })
      .catch((e: Error) => setError(e.message));
  }, []);
  React.useEffect(load, [load]);

  async function act(type: ReportTarget, id: string, action: "approve" | "hide" | "delete", reason?: string, note?: string, success?: string) {
    setBusy(`${type}:${id}`);
    try {
      await moderate(type, id, action, reason, note);
      toast.success(success ?? (action === "approve" ? "Signalement classé" : action === "hide" ? "Contenu masqué" : "Contenu supprimé"));
      setDecision(null);
      load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(""); }
  }

  async function publishSelected() {
    setBusy("bulk");
    let ok = 0;
    for (const id of selected) { try { await moderate("review", id, "approve"); ok++; } catch { /* compté ci-dessous */ } }
    setBusy("");
    toast.success(`${ok} avis publié${ok > 1 ? "s" : ""}`);
    if (ok < selected.size) toast.error(`${selected.size - ok} avis non publié${selected.size - ok > 1 ? "s" : ""}`);
    setSelected(new Set());
    load();
  }

  const shown = (reports ?? []).filter((g) => !typeFilter || g.targetType === typeFilter);

  return (
    <>
      <PageHeader title="Modération" sub="Signalements des couples, avis à publier et médias masqués"
        actions={<Button variant="ghost" size="sm" onClick={load}><RefreshCw aria-hidden />Actualiser</Button>} />

      <Segmented label="Rubrique" layoutId="moderation-tab" value={tab} onChange={setTab} className="mb-4 max-w-full overflow-x-auto"
        options={[
          { value: "reports", label: <>Signalements{reports ? ` (${reports.length})` : ""}</> },
          { value: "reviews", label: <>Avis à publier{reviews ? ` (${reviews.length})` : ""}</> },
          { value: "hidden", label: <>Masqués{hidden ? ` (${hidden.length})` : ""}</> },
        ]} />

      {error ? (
        <EmptyState icon={<AlertTriangle />} title="Chargement impossible" action={<Button variant="outline" size="sm" onClick={load}><RefreshCw aria-hidden />Réessayer</Button>}>{error}</EmptyState>
      ) : tab === "reports" ? (
        <>
          <div className="mb-3 flex flex-wrap items-end gap-3">
            <FilterSelect label="Type" value={typeFilter} onChange={(v) => setTypeFilter(v as "" | ReportTarget)}
              options={[{ value: "", label: "Tous" }, ...(Object.keys(TARGET_LABEL) as ReportTarget[]).map((k) => ({ value: k, label: TARGET_LABEL[k] }))]} />
            <p className="pb-2 text-[13px] text-muted">Les éléments les plus signalés en premier.</p>
          </div>
          {!reports ? <SkeletonList /> : !shown.length ? (
            <EmptyState icon={<ShieldCheck />} title="Aucun signalement à traiter">Les couples peuvent signaler une photo, un avis ou une vitrine depuis le site.</EmptyState>
          ) : (
            <ul className="grid gap-3">
              {shown.map((g) => (
                <li key={g.key}>
                  <Panel className="grid gap-3 p-3 sm:grid-cols-[120px_minmax(0,1fr)] sm:p-4">
                    <ReportPreview g={g} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-[13px]">
                        <StatusTag tone="muted">{TARGET_LABEL[g.targetType]}</StatusTag>
                        <span className="inline-flex items-center gap-1 font-semibold text-danger"><Flag className="size-3.5" aria-hidden />{g.count} signalement{g.count > 1 ? "s" : ""}</span>
                        <span className="text-muted">· dernier il y a {waited(g.lastAt)}</span>
                        {g.preview.hidden && <StatusTag tone="muted">Déjà masqué</StatusTag>}
                      </div>
                      <p className="mt-1.5 text-sm">
                        <Link href={`/admin/prestataires/${g.vendor.id}`} className="font-semibold hover:text-gold-ink">{g.vendor.name}</Link>
                        {g.vendor.city && <span className="text-muted"> · {g.vendor.city}</span>}
                      </p>
                      <p className="mt-1 flex flex-wrap gap-1.5">{g.reasons.map((r) => <span key={r} className="rounded-md bg-danger/10 px-2 py-0.5 text-[12px] font-semibold text-danger">{reasonLabel(r)}</span>)}</p>
                      {g.details.length > 0 && (
                        <ul className="mt-2 grid gap-1 text-[13px] text-muted">{g.details.slice(0, 3).map((d, i) => <li key={i} className="border-l-2 border-line pl-2">« {d} »</li>)}</ul>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" loading={busy === `${g.targetType}:${g.targetId}`} onClick={() => act(g.targetType, g.targetId, "approve", undefined, undefined, "Signalement classé : le contenu reste en ligne")}>
                          <CheckIcon aria-hidden />Conserver
                        </Button>
                        {g.targetType === "vendor" ? (
                          <Button size="sm" variant="danger" disabled={!isAdmin} title={isAdmin ? undefined : "Réservé aux administrateurs"}
                            onClick={() => setDecision({ type: "vendor", id: g.targetId, action: "hide", label: "Suspendre la vitrine", suggested: g.reasons[0] })}>
                            <Ban aria-hidden />Suspendre la vitrine
                          </Button>
                        ) : (
                          <>
                            {!g.preview.hidden && !g.preview.missing && (
                              <Button size="sm" variant="danger" onClick={() => setDecision({ type: g.targetType, id: g.targetId, action: "hide", label: "Masquer", suggested: g.reasons[0] })}><EyeOff aria-hidden />Masquer</Button>
                            )}
                            <Button size="sm" variant="ghost" className="text-danger" onClick={() => setDecision({ type: g.targetType, id: g.targetId, action: "delete", label: "Supprimer", suggested: g.reasons[0] })}><Trash2 aria-hidden />Supprimer</Button>
                          </>
                        )}
                      </div>
                    </div>
                  </Panel>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : tab === "reviews" ? (
        !reviews ? <SkeletonList /> : !reviews.length ? (
          <EmptyState icon={<MessageSquareQuote />} title="Aucun avis en attente">Les nouveaux avis laissés par les couples apparaîtront ici avant publication.</EmptyState>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 text-[13px] font-semibold">
                <Check label="Tout sélectionner" checked={selected.size === reviews.length} indeterminate={selected.size > 0 && selected.size < reviews.length}
                  onChange={(on) => setSelected(on ? new Set(reviews.map((r) => r.id)) : new Set())} />
                Tout sélectionner
              </label>
              {selected.size > 0 && <Button size="sm" loading={busy === "bulk"} onClick={publishSelected}><CheckIcon aria-hidden />Publier ({selected.size})</Button>}
            </div>
            <ul className="grid gap-3 lg:grid-cols-2">
              {reviews.map((r) => (
                <li key={r.id}>
                  <Panel className={cn("flex h-full gap-3 p-4", selected.has(r.id) && "border-gold/60")}>
                    <Check label={`Sélectionner l’avis de ${r.author}`} checked={selected.has(r.id)} onChange={(on) => setSelected((s) => { const n = new Set(s); if (on) n.add(r.id); else n.delete(r.id); return n; })} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-[13px]">
                        <Stars value={r.rating} /><b>{r.author}</b>
                        {r.verified && <StatusTag tone="success">Mariage vérifié</StatusTag>}
                        <span className="text-muted">· {fmtDate(r.createdAt)}</span>
                      </div>
                      <p className="mt-1 text-[13px] text-muted">Pour <Link href={`/admin/prestataires/${r.vendor.id}`} className="font-semibold text-text hover:text-gold-ink">{r.vendor.name}</Link>{r.city && ` · ${r.city}`}</p>
                      <p className="mt-2 text-sm">{r.body}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button size="sm" loading={busy === `review:${r.id}`} onClick={() => act("review", r.id, "approve", undefined, undefined, "Avis publié")}><CheckIcon aria-hidden />Publier</Button>
                        <Button size="sm" variant="danger" onClick={() => setDecision({ type: "review", id: r.id, action: "hide", label: "Masquer l’avis" })}><EyeOff aria-hidden />Masquer</Button>
                      </div>
                    </div>
                  </Panel>
                </li>
              ))}
            </ul>
          </>
        )
      ) : !hidden ? <SkeletonList /> : !hidden.length ? (
        <EmptyState icon={<ImageOff />} title="Aucun média masqué">Les photos et vidéos masquées par la modération apparaîtront ici.</EmptyState>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {hidden.map((m) => (
            <li key={m.id}>
              <Panel className="overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt="" loading="lazy" className="aspect-square w-full object-cover opacity-60" />
                <div className="grid gap-1.5 p-2.5 text-[12.5px]">
                  <Link href={`/admin/prestataires/${m.vendor.id}`} className="truncate font-semibold hover:text-gold-ink">{m.vendor.name}</Link>
                  <span className="text-muted">{m.reason ? reasonLabel(m.reason) : "Sans motif"} · {fmtDate(m.moderatedAt)}</span>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" className="h-8 flex-1 px-2" loading={busy === `media:${m.id}`} onClick={() => act("media", m.id, "approve", undefined, undefined, "Média rétabli")}><RotateCcw aria-hidden />Rétablir</Button>
                    <Button size="sm" variant="danger" className="h-8 px-2" aria-label="Supprimer définitivement" onClick={() => setDecision({ type: "media", id: m.id, action: "delete", label: "Supprimer", suggested: m.reason })}><Trash2 aria-hidden /></Button>
                  </div>
                </div>
              </Panel>
            </li>
          ))}
        </ul>
      )}

      <DecisionDialog decision={decision} onClose={() => setDecision(null)} busy={!!busy}
        onConfirm={(reason, note) => decision && act(decision.type, decision.id, decision.action, reason, note,
          decision.type === "vendor" ? "Vitrine suspendue" : decision.action === "hide" ? "Contenu masqué" : "Contenu supprimé")} />
    </>
  );
}

function ReportPreview({ g }: { g: ReportGroup }) {
  if (g.preview.missing) return <div className="grid aspect-square place-items-center rounded-lg bg-surface-2 text-center text-[12px] text-muted">Déjà supprimé</div>;
  if (g.targetType === "review") return (
    <div className="rounded-lg bg-surface-2 p-2.5 text-[12.5px]">
      <Stars value={g.preview.rating ?? 0} />
      <p className="mt-1 line-clamp-5">{g.preview.text}</p>
      <p className="mt-1 text-muted">— {g.preview.author}</p>
    </div>
  );
  if (g.targetType === "vendor") return <div className="grid aspect-square place-items-center rounded-lg bg-surface-2 text-muted"><Store className="size-7" aria-hidden /></div>;
  return (
    <div className="relative aspect-square overflow-hidden rounded-lg bg-surface-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {g.preview.url && <img src={g.preview.url} alt="Contenu signalé" loading="lazy" className={cn("size-full object-cover", g.preview.hidden && "opacity-40")} />}
      {g.preview.kind === "video" && <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 text-[10px] font-semibold text-white">Vidéo</span>}
    </div>
  );
}

/** Motif prédéfini obligatoire ; la suppression demande en plus une confirmation */
function DecisionDialog({ decision, onClose, onConfirm, busy }: { decision: Decision | null; onClose: () => void; onConfirm: (reason: string, note: string) => void; busy: boolean }) {
  if (!decision) return null;
  return <DecisionDialogOpen key={`${decision.type}:${decision.id}:${decision.action}`} decision={decision} onClose={onClose} onConfirm={onConfirm} busy={busy} />;
}
function DecisionDialogOpen({ decision, onClose, onConfirm, busy }: { decision: Decision; onClose: () => void; onConfirm: (reason: string, note: string) => void; busy: boolean }) {
  const [reason, setReason] = React.useState(decision.suggested ?? "");
  const [note, setNote] = React.useState("");
  const [confirm, setConfirm] = React.useState(false);
  const destructive = decision.action === "delete";
  const body = (
    <div className="grid gap-4">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Motif</legend>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {MODERATION_REASONS.map((r) => (
            <label key={r.code} className={cn("flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm", reason === r.code ? "border-gold bg-gold/8" : "border-line hover:border-line-strong")}>
              <input type="radio" name="motif" value={r.code} checked={reason === r.code} onChange={() => setReason(r.code)} className="accent-[var(--gold)]" />{r.label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="grid gap-1.5 text-sm font-semibold">
        Note interne <span className="font-normal text-muted">(facultatif, conservée au journal)</span>
        <input value={note} onChange={(e) => setNote(e.target.value.slice(0, 300))}
          className="h-10 rounded-lg border border-line-strong bg-surface px-3 text-sm font-normal focus-visible:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40" />
      </label>
    </div>
  );
  if (destructive && confirm) {
    return (
      <ConfirmDialog open onOpenChange={(o) => !o && onClose()} title="Supprimer définitivement ?" confirmLabel="Supprimer" onConfirm={() => onConfirm(reason, note)}>
        <p>Le contenu sera effacé (fichier compris) et ne pourra pas être restauré. Motif : <b>{reasonLabel(reason)}</b>.</p>
      </ConfirmDialog>
    );
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={decision.label} wide className="admin-ui"
      description={decision.type === "vendor" ? "La vitrine disparaît du site et le prestataire est prévenu par e-mail." : destructive ? "Suppression définitive, journalisée avec le motif." : "Le contenu n’est plus visible sur le site ; le prestataire est prévenu."}
      footer={<>
        <Button variant="ghost" size="sm" onClick={onClose}>Annuler</Button>
        <Button variant="danger" size="sm" loading={busy} disabled={!reason} onClick={() => (destructive ? setConfirm(true) : onConfirm(reason, note))}>{decision.label}</Button>
      </>}>
      {body}
    </Dialog>
  );
}

function SkeletonList() {
  return <div className="grid gap-3" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-32 rounded-2xl" />)}</div>;
}
