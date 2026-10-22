"use client";

import * as React from "react";
import { AlertTriangle, Bell, Mail, Megaphone, Pencil, Plus, RefreshCw, Send, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, StatusTag } from "@/components/ui/bits";
import { audienceCount, deleteAnnouncement, listAnnouncements, saveAnnouncement, sendAnnouncement, type Announcement, type Audience, type OutboxStats } from "@/lib/admin/manage";
import { PLAN_LABEL, STATUS_META } from "@/lib/admin/types";
import { CATEGORIES, CITIES } from "@/lib/onboarding/catalog";
import { cn } from "@/lib/utils";
import { dateInputClass } from "./pickers";
import { ConfirmDialog, PageHeader, Panel, fmtDate } from "./ui";

const STATUSES = ["published", "pending_review", "rejected", "draft"] as const;
const CHANNEL = { in_app: { label: "Notification", icon: Bell }, email: { label: "E-mail", icon: Mail } } as const;

function audienceSummary(a: Audience) {
  const parts = [
    a.statuses?.length ? a.statuses.map((s) => STATUS_META[s as keyof typeof STATUS_META]?.label ?? s).join(", ") : "",
    a.plans?.length ? `offre ${a.plans.map((p) => PLAN_LABEL[p as keyof typeof PLAN_LABEL] ?? p).join(" ou ")}` : "",
    a.cities?.length ? a.cities.join(", ") : "",
    a.categories?.length ? a.categories.map((c) => CATEGORIES.find((x) => x.slug === c)?.name ?? c).join(", ") : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Tous les prestataires";
}

export function Communication() {
  const [data, setData] = React.useState<{ list: Announcement[]; outbox: OutboxStats } | null>(null);
  const [error, setError] = React.useState("");
  const [edit, setEdit] = React.useState<Announcement | "new" | null>(null);
  const [toSend, setToSend] = React.useState<{ a: Announcement; count: number } | null>(null);
  const [toDelete, setToDelete] = React.useState<Announcement | null>(null);

  const load = React.useCallback(() => { listAnnouncements().then((d) => { setData(d); setError(""); }).catch((e: Error) => setError(e.message)); }, []);
  React.useEffect(load, [load]);

  async function askSend(a: Announcement) {
    try { setToSend({ a, count: await audienceCount(a.audience) }); } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <>
      <PageHeader title="Communication" sub="Annonces aux prestataires, par notification dans leur espace et par e-mail"
        actions={<Button size="sm" onClick={() => setEdit("new")}><Plus aria-hidden />Nouvelle annonce</Button>} />
      {error ? (
        <EmptyState icon={<AlertTriangle />} title="Chargement impossible" action={<Button variant="outline" size="sm" onClick={load}><RefreshCw aria-hidden />Réessayer</Button>}>{error}</EmptyState>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <Panel title="Annonces" id="com-list">
            {!data ? <div className="grid gap-2 p-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-20 rounded-lg" />)}</div> : !data.list.length ? (
              <EmptyState className="m-3" icon={<Megaphone />} title="Aucune annonce" action={<Button size="sm" onClick={() => setEdit("new")}>Rédiger une annonce</Button>}>
                Informez les prestataires d’une nouveauté, d’une maintenance ou d’une opération commerciale.
              </EmptyState>
            ) : (
              <ul className="divide-y divide-line">
                {data.list.map((a) => (
                  <li key={a.id} className="grid gap-1.5 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="min-w-0 flex-1 truncate text-sm font-semibold">{a.title}</p>
                      {a.status === "sent" ? <StatusTag tone="success">Envoyée</StatusTag> : <StatusTag tone="gold">Brouillon</StatusTag>}
                    </div>
                    <p className="line-clamp-2 text-[13px] text-muted">{a.body}</p>
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
                      {a.channels.map((c) => { const C = CHANNEL[c]; return <span key={c} className="inline-flex items-center gap-1"><C.icon className="size-3.5" aria-hidden />{C.label}</span>; })}
                      <span className="inline-flex items-center gap-1"><Users className="size-3.5" aria-hidden />{audienceSummary(a.audience)}</span>
                      <span>{a.status === "sent" ? `${a.recipientsCount ?? 0} destinataire${(a.recipientsCount ?? 0) > 1 ? "s" : ""} · ${fmtDate(a.sentAt, true)}` : `créée le ${fmtDate(a.createdAt)}`}</span>
                    </p>
                    {a.status === "draft" && (
                      <div className="mt-1 flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => askSend(a)}><Send aria-hidden />Envoyer</Button>
                        <Button size="sm" variant="outline" onClick={() => setEdit(a)}><Pencil aria-hidden />Modifier</Button>
                        <Button size="sm" variant="ghost" className="text-danger" onClick={() => setToDelete(a)}><Trash2 aria-hidden />Supprimer</Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="E-mails sortants" id="com-outbox">
            {!data ? <div className="skeleton m-3 h-24 rounded-lg" /> : (
              <div className="grid gap-3 p-4 text-sm">
                <dl className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-surface-2 p-2"><dt className="text-[11px] uppercase tracking-wide text-muted">En file</dt><dd className="font-display text-2xl tabular">{data.outbox.pending}</dd></div>
                  <div className="rounded-lg bg-surface-2 p-2"><dt className="text-[11px] uppercase tracking-wide text-muted">Envoyés</dt><dd className="font-display text-2xl tabular">{data.outbox.sent}</dd></div>
                  <div className="rounded-lg bg-surface-2 p-2"><dt className="text-[11px] uppercase tracking-wide text-muted">Échecs</dt><dd className={cn("font-display text-2xl tabular", data.outbox.failed > 0 && "text-danger")}>{data.outbox.failed}</dd></div>
                </dl>
                <p className="text-[12.5px] text-muted">Les e-mails (annonces, refus de vitrine, relances) partent depuis cette file dès qu’un serveur d’envoi (SMTP) est branché. Les notifications dans l’espace prestataire sont immédiates.</p>
              </div>
            )}
          </Panel>
        </div>
      )}

      <Composer value={edit} onClose={() => setEdit(null)} onSaved={(a, sendNow) => { setEdit(null); load(); if (sendNow) void askSend(a); }} />
      <ConfirmDialog open={!!toSend} onOpenChange={(o) => !o && setToSend(null)} title={`Envoyer à ${toSend?.count ?? 0} destinataire${(toSend?.count ?? 0) > 1 ? "s" : ""} ?`} confirmLabel="Envoyer maintenant"
        onConfirm={async () => {
          if (!toSend) return;
          try { const n = await sendAnnouncement(toSend.a.id); toast.success(`Annonce envoyée à ${n} destinataire${n > 1 ? "s" : ""}`); setToSend(null); load(); }
          catch (e) { toast.error((e as Error).message); }
        }}>
        <p>« {toSend?.a.title} » — {toSend && audienceSummary(toSend.a.audience)}. Un envoi ne peut pas être annulé.</p>
        {toSend?.count === 0 && <p className="font-semibold text-danger">Aucun prestataire ne correspond à ce ciblage.</p>}
      </ConfirmDialog>
      <ConfirmDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)} title="Supprimer ce brouillon ?" confirmLabel="Supprimer"
        onConfirm={async () => { if (!toDelete) return; try { await deleteAnnouncement(toDelete.id); toast.success("Brouillon supprimé"); setToDelete(null); load(); } catch (e) { toast.error((e as Error).message); } }}>
        <p>« {toDelete?.title} »</p>
      </ConfirmDialog>
    </>
  );
}

function Chips<T extends string>({ label, options, value, onChange }: { label: string; options: { value: T; label: string }[]; value: T[]; onChange: (v: T[]) => void }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-[12px] font-bold uppercase tracking-[.08em] text-muted">{label} <span className="font-normal normal-case tracking-normal">{value.length ? `(${value.length})` : "· tous"}</span></legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = value.includes(o.value);
          return (
            <button key={o.value} type="button" aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== o.value) : [...value, o.value])}
              className={cn("h-8 rounded-full border px-3 text-[12.5px] font-semibold transition-colors", on ? "border-gold bg-gold/15 text-gold-ink" : "border-line text-muted hover:border-line-strong hover:text-text")}>
              {o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function Composer({ value, onClose, onSaved }: { value: Announcement | "new" | null; onClose: () => void; onSaved: (a: Announcement, sendNow: boolean) => void }) {
  if (!value) return null;
  return <ComposerOpen key={value === "new" ? "new" : value.id} initial={value === "new" ? null : value} onClose={onClose} onSaved={onSaved} />;
}
function ComposerOpen({ initial, onClose, onSaved }: { initial: Announcement | null; onClose: () => void; onSaved: (a: Announcement, sendNow: boolean) => void }) {
  const [title, setTitle] = React.useState(initial?.title ?? "");
  const [body, setBody] = React.useState(initial?.body ?? "");
  const [channels, setChannels] = React.useState<Announcement["channels"]>(initial?.channels ?? ["in_app"]);
  const [aud, setAud] = React.useState<Audience>(initial?.audience ?? { statuses: ["published"] });
  const [count, setCount] = React.useState<{ key: string; n: number } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const audKey = JSON.stringify(aud);

  React.useEffect(() => {
    let alive = true;
    const t = setTimeout(() => { audienceCount(aud).then((n) => alive && setCount({ key: audKey, n })).catch(() => {}); }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [aud, audKey]);

  const valid = title.trim().length >= 3 && body.trim().length >= 3 && channels.length > 0;
  async function save(sendNow: boolean) {
    setBusy(true);
    try {
      const id = await saveAnnouncement({ id: initial?.id, title: title.trim(), body: body.trim(), channels, audience: aud });
      toast.success("Brouillon enregistré");
      onSaved({ id, title: title.trim(), body: body.trim(), channels, audience: aud, status: "draft", createdAt: new Date().toISOString() }, sendNow);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={initial ? "Modifier l’annonce" : "Nouvelle annonce"} wide className="admin-ui"
      footer={<>
        <span className="mr-auto self-center text-[13px] text-muted" aria-live="polite">{count?.key === audKey ? <><b className="tabular text-text">{count.n}</b> destinataire{count.n > 1 ? "s" : ""}</> : "Calcul…"}</span>
        <Button variant="ghost" size="sm" onClick={onClose}>Annuler</Button>
        <Button variant="outline" size="sm" disabled={!valid} loading={busy} onClick={() => save(false)}>Enregistrer le brouillon</Button>
        <Button size="sm" disabled={!valid || busy} onClick={() => save(true)}><Send aria-hidden />Envoyer…</Button>
      </>}>
      <div className="grid gap-4">
        <label className="grid gap-1.5 text-sm font-semibold">Titre<input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} className={dateInputClass} placeholder="Nouveau : les stories arrivent sur NDOA" /></label>
        <label className="grid gap-1.5 text-sm font-semibold">Message
          <textarea value={body} maxLength={5000} rows={6} onChange={(e) => setBody(e.target.value)} placeholder="Bonjour, …"
            className="rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm font-normal focus-visible:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40" />
          <span className="text-right text-[12px] font-normal text-muted tabular">{body.length} / 5000</span>
        </label>
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold">Canaux</legend>
          <div className="flex flex-wrap gap-4">
            {(Object.keys(CHANNEL) as (keyof typeof CHANNEL)[]).map((c) => (
              <label key={c} className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 accent-[var(--gold)]" checked={channels.includes(c)} onChange={(e) => setChannels((x) => (e.target.checked ? [...x, c] : x.filter((y) => y !== c)))} />
                {CHANNEL[c].label}{c === "email" && <span className="text-[12px] text-muted">(file d’envoi)</span>}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-3 rounded-xl border border-line p-3">
          <p className="text-sm font-semibold">Destinataires : équipes des prestataires correspondant à tous les critères</p>
          <Chips label="Statut de la vitrine" value={(aud.statuses ?? []) as typeof STATUSES[number][]} onChange={(v) => setAud((a) => ({ ...a, statuses: v }))}
            options={STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label }))} />
          <Chips label="Offre" value={(aud.plans ?? []) as ("free" | "pro" | "prestige")[]} onChange={(v) => setAud((a) => ({ ...a, plans: v }))}
            options={(Object.keys(PLAN_LABEL) as ("free" | "pro" | "prestige")[]).map((p) => ({ value: p, label: PLAN_LABEL[p] }))} />
          <Chips label="Ville" value={aud.cities ?? []} onChange={(v) => setAud((a) => ({ ...a, cities: v }))} options={CITIES.map((c) => ({ value: c, label: c }))} />
          <Chips label="Catégorie" value={aud.categories ?? []} onChange={(v) => setAud((a) => ({ ...a, categories: v }))} options={CATEGORIES.map((c) => ({ value: c.slug, label: c.name }))} />
        </div>
      </div>
    </Dialog>
  );
}
