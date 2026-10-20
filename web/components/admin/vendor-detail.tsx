"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle, BadgeCheck, Ban, Check as CheckIcon, CheckCircle2, Circle, Eye, EyeOff, ExternalLink, History, Mail, MapPin, Phone, RotateCcw, Trash2, X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/bits";
import { adminError, deleteVendor, getVendor, reviewVendors, setVerified, suspendVendor } from "@/lib/admin/api";
import { PLAN_LABEL, REJECT_REASONS, readiness, type AdminVendorDetail } from "@/lib/admin/types";
import { profileUrl } from "@/lib/config";
import { cn, formatPrice } from "@/lib/utils";
import { useAdmin } from "./context";
import { ConfirmDialog, PageHeader, Panel, ReasonDialog, VendorStatusTag, fmtDate, fmtInt } from "./ui";

const SUSPEND_REASONS = ["Signalements répétés des couples", "Fausses informations ou photos volées", "Comportement abusif envers des clients", "Impayé ou fraude au paiement", "Demande du prestataire"];
const ACTION_LABEL: Record<string, string> = {
  "vendor.approve": "Vitrine validée", "vendor.reject": "Vitrine refusée", "vendor.verify": "Badge Vérifié attribué", "vendor.unverify": "Badge Vérifié retiré",
  "vendor.suspend": "Vitrine suspendue", "vendor.unsuspend": "Suspension levée", "vendor.view_as": "Consultation en lecture seule", "vendor.delete": "Vitrine supprimée",
  "vendors.update": "Vitrine modifiée par l’équipe", "media.hide": "Média masqué", "media.approve": "Média rétabli", "media.delete": "Média supprimé",
};

export function VendorDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { me, isAdmin, refreshPending } = useAdmin();
  const [v, setV] = React.useState<AdminVendorDetail | null | undefined>(undefined);
  const [error, setError] = React.useState("");
  const [dialog, setDialog] = React.useState<"" | "reject" | "suspend" | "delete">("");
  const [busy, setBusy] = React.useState("");
  const [deleteReason, setDeleteReason] = React.useState("");

  const load = React.useCallback(() => {
    if (!me) return;
    getVendor(id, me.role).then((d) => { setV(d); setError(""); }).catch((e: Error) => setError(e.message));
  }, [id, me]);
  React.useEffect(load, [load]);

  async function run(key: string, fn: () => Promise<unknown>, success: string) {
    setBusy(key);
    try { await fn(); toast.success(success); setDialog(""); load(); refreshPending(); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(""); }
  }
  async function review(decision: "approve" | "reject", reason?: string) {
    setBusy(decision);
    try {
      const r = await reviewVendors([id], decision, reason);
      if (r.errors.length) throw new Error(adminError(r.errors[0].error));
      toast.success(decision === "approve" ? "Vitrine validée et mise en ligne" : "Vitrine refusée — motif envoyé par e-mail");
      setDialog(""); load(); refreshPending();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(""); }
  }

  if (error) return <EmptyState className="mt-10" icon={<AlertTriangle />} title="Chargement impossible" action={<Button variant="outline" size="sm" onClick={load}>Réessayer</Button>}>{error}</EmptyState>;
  if (v === undefined) return <div className="grid gap-3" aria-busy="true"><div className="skeleton h-12 w-80 rounded-xl" /><div className="grid gap-3 lg:grid-cols-[1fr_360px]"><div className="skeleton h-96 rounded-2xl" /><div className="skeleton h-96 rounded-2xl" /></div></div>;
  if (v === null) return <EmptyState className="mt-10" icon={<X />} title="Vitrine introuvable" action={<Button asChild variant="outline" size="sm"><Link href="/admin/prestataires">Retour à la liste</Link></Button>}>Elle a peut-être été supprimée.</EmptyState>;

  const checks = readiness(v);
  const canReview = v.status === "pending_review" || v.status === "rejected";

  return (
    <>
      <PageHeader back={{ href: "/admin/prestataires", label: "Prestataires" }} title={v.name}
        sub={<span className="inline-flex flex-wrap items-center gap-2"><VendorStatusTag status={v.status} />{v.isVerified && <span className="inline-flex items-center gap-1 text-gold-ink"><BadgeCheck className="size-4" aria-hidden />Vérifié</span>}<span>/{v.slug}</span></span>}
        actions={<>
          {canReview && <Button size="sm" loading={busy === "approve"} onClick={() => review("approve")}><CheckIcon aria-hidden />Valider</Button>}
          {v.status === "pending_review" && <Button size="sm" variant="danger" onClick={() => setDialog("reject")}><X aria-hidden />Refuser</Button>}
          <Button size="sm" variant="outline" asChild><Link href={`/admin/prestataires/${v.id}/apercu`}><Eye aria-hidden />Voir en tant que</Link></Button>
          {v.status === "published" && <Button size="sm" variant="ghost" asChild><a href={profileUrl(v.slug)} target="_blank" rel="noreferrer"><ExternalLink aria-hidden />Page publique</a></Button>}
        </>} />

      {v.status === "rejected" && v.rejectionReason && <Notice tone="rose" title="Refusée — en attente de corrections">{v.rejectionReason}</Notice>}
      {v.status === "suspended" && <Notice tone="danger" title="Vitrine suspendue">{v.suspendedReason ?? "Sans motif indiqué"}</Notice>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid min-w-0 content-start gap-4">
          <Panel title={`Médias (${v.media.length})`} id="v-media">
            {v.media.length ? (
              <ul className="grid grid-cols-3 gap-1.5 p-3 sm:grid-cols-4 xl:grid-cols-6">
                {v.media.map((m) => (
                  <li key={m.id} className="relative aspect-square overflow-hidden rounded-lg bg-surface-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.url} alt="" loading="lazy" className={cn("size-full object-cover", m.isHidden && "opacity-30")} />
                    {m.isHidden && <span className="absolute inset-x-1 bottom-1 inline-flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white"><EyeOff className="size-3" aria-hidden />Masquée</span>}
                    {m.kind === "video" && <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 text-[10px] font-semibold text-white">Vidéo</span>}
                  </li>
                ))}
              </ul>
            ) : <p className="px-4 py-6 text-sm text-muted">Aucun média publié.</p>}
          </Panel>

          <Panel title="Présentation" id="v-bio">
            <div className="grid gap-2 p-4 text-sm">
              {v.tagline && <p className="font-semibold">{v.tagline}</p>}
              <p className="whitespace-pre-line text-muted">{v.bio || "Pas encore de présentation."}</p>
            </div>
          </Panel>

          <Panel title={`Forfaits (${v.packages.length})`} id="v-pkg">
            {v.packages.length ? (
              <ul className="divide-y divide-line">
                {v.packages.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-sm">
                    <span className="font-semibold">{p.name}{!p.isVisible && <span className="ml-2 text-xs font-normal text-muted">(masqué)</span>}</span>
                    <span className="tabular">{p.priceMode === "from" ? "À partir de " : ""}{formatPrice(p.amount, p.currency)}</span>
                    {p.includes.length > 0 && <span className="w-full text-[13px] text-muted">{p.includes.join(" · ")}</span>}
                  </li>
                ))}
              </ul>
            ) : <p className="px-4 py-6 text-sm text-muted">Aucun forfait.</p>}
          </Panel>

          {isAdmin && (
            <Panel title={<span className="inline-flex items-center gap-2"><History className="size-4" aria-hidden />Historique des actions</span>} id="v-history">
              {v.history?.length ? (
                <ol className="divide-y divide-line">
                  {v.history.map((h) => (
                    <li key={h.id} className="grid gap-0.5 px-4 py-2.5 text-[13px]">
                      <span><b>{ACTION_LABEL[h.action] ?? h.action}</b> <span className="text-muted">par {h.actor}{h.actorRole === "moderateur" ? " (modérateur)" : ""}</span></span>
                      {h.reason && <span className="text-muted">Motif : {h.reason}</span>}
                      <span className="text-[12px] text-muted tabular">{fmtDate(h.createdAt, true)}</span>
                    </li>
                  ))}
                </ol>
              ) : <p className="px-4 py-6 text-sm text-muted">Aucune action de l’équipe pour l’instant.</p>}
            </Panel>
          )}
        </div>

        <div className="grid content-start gap-4">
          <Panel title="Publication" id="v-ready">
            <ul className="grid gap-1.5 p-4 text-[13.5px]">
              {checks.map((c) => (
                <li key={c.label} className="flex items-start gap-2">
                  {c.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> : c.required ? <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden /> : <Circle className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />}
                  <span className={cn(!c.ok && c.required && "text-danger")}>{c.label}{!c.required && <span className="text-muted"> · conseillé</span>}<span className="sr-only">{c.ok ? " : fait" : " : manquant"}</span></span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Informations" id="v-info">
            <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 p-4 text-[13.5px]">
              <dt className="text-muted">Activité</dt><dd>{v.categories.map((c) => c.name).join(", ") || "—"}</dd>
              <dt className="text-muted">Ville</dt><dd className="inline-flex items-center gap-1"><MapPin className="size-3.5 text-muted" aria-hidden />{v.city}</dd>
              <dt className="text-muted">Zones</dt><dd>{v.zones.join(", ") || "—"}</dd>
              <dt className="text-muted">Langues</dt><dd>{v.languages.join(", ") || "—"}</dd>
              <dt className="text-muted">Téléphone</dt><dd>{v.phone ? <a className="inline-flex items-center gap-1 hover:text-gold-ink" href={`tel:${v.phone}`}><Phone className="size-3.5" aria-hidden />{v.phone}</a> : "—"}</dd>
              <dt className="text-muted">WhatsApp</dt><dd>{v.whatsapp ?? "—"}</dd>
              <dt className="text-muted">E-mail</dt><dd className="break-all">{v.email ? <a className="inline-flex items-center gap-1 hover:text-gold-ink" href={`mailto:${v.email}`}><Mail className="size-3.5 shrink-0" aria-hidden />{v.email}</a> : "—"}</dd>
              <dt className="text-muted">Réseaux</dt><dd>{Object.values(v.socials).filter(Boolean).join(", ") || "—"}</dd>
              <dt className="text-muted">Responsable</dt><dd>{v.owner?.name ?? "—"}{v.owner?.phone && <span className="block text-muted">{v.owner.phone}</span>}</dd>
              <dt className="text-muted">Offre</dt><dd>{PLAN_LABEL[v.plan]}</dd>
              <dt className="text-muted">Inscrit le</dt><dd className="tabular">{fmtDate(v.createdAt)}</dd>
              {v.submittedAt && <><dt className="text-muted">Soumise le</dt><dd className="tabular">{fmtDate(v.submittedAt, true)}</dd></>}
              {v.approvedAt && <><dt className="text-muted">Validée le</dt><dd className="tabular">{fmtDate(v.approvedAt)}</dd></>}
            </dl>
          </Panel>

          {isAdmin && v.stats && (
            <Panel title="30 derniers jours" id="v-stats">
              <dl className="grid grid-cols-2 divide-x divide-line">
                <div className="p-4"><dt className="text-[12px] text-muted">Visites</dt><dd className="font-display text-2xl tabular">{fmtInt(v.stats.views30)}</dd></div>
                <div className="p-4"><dt className="text-[12px] text-muted">Demandes</dt><dd className="font-display text-2xl tabular">{fmtInt(v.stats.inquiries30)}</dd></div>
              </dl>
            </Panel>
          )}

          {isAdmin && (
            <Panel title="Actions administrateur" id="v-admin">
              <div className="grid gap-2 p-3">
                <Button variant="outline" size="sm" className="justify-start" loading={busy === "verify"}
                  onClick={() => run("verify", () => setVerified(v.id, !v.isVerified), v.isVerified ? "Badge Vérifié retiré" : "Badge Vérifié attribué")}>
                  <BadgeCheck aria-hidden />{v.isVerified ? "Retirer le badge Vérifié" : "Attribuer le badge Vérifié"}
                </Button>
                {v.status === "suspended" ? (
                  <Button variant="outline" size="sm" className="justify-start" loading={busy === "unsuspend"}
                    onClick={() => run("unsuspend", () => suspendVendor(v.id, false, "Levée par l’équipe"), "Suspension levée")}>
                    <RotateCcw aria-hidden />Lever la suspension
                  </Button>
                ) : (
                  <Button variant="danger" size="sm" className="justify-start" onClick={() => setDialog("suspend")}><Ban aria-hidden />Suspendre la vitrine</Button>
                )}
                <Button variant="danger" size="sm" className="justify-start" onClick={() => setDialog("delete")}><Trash2 aria-hidden />Supprimer définitivement</Button>
              </div>
            </Panel>
          )}
        </div>
      </div>

      <ReasonDialog open={dialog === "reject"} onOpenChange={(o) => setDialog(o ? "reject" : "")} title={`Refuser « ${v.name} »`}
        description="Le prestataire reçoit ce motif par e-mail et dans son espace, puis peut renvoyer sa vitrine."
        presets={REJECT_REASONS} confirmLabel="Refuser et notifier" onConfirm={(r) => review("reject", r)} />
      <ReasonDialog open={dialog === "suspend"} onOpenChange={(o) => setDialog(o ? "suspend" : "")} title={`Suspendre « ${v.name} »`}
        description="La vitrine disparaît immédiatement du site. Le prestataire est prévenu et ne peut pas la remettre en ligne lui-même."
        presets={SUSPEND_REASONS} confirmLabel="Suspendre" onConfirm={(r) => run("suspend", () => suspendVendor(v.id, true, r), "Vitrine suspendue")} />
      <ConfirmDialog open={dialog === "delete"} onOpenChange={(o) => { setDialog(o ? "delete" : ""); if (!o) setDeleteReason(""); }}
        title="Supprimer définitivement ?" confirmLabel="Supprimer" typeToConfirm={v.slug}
        onConfirm={async (typed) => {
          if (!deleteReason.trim()) { toast.error("Indiquez le motif de la suppression."); return; }
          setBusy("delete");
          try {
            const r = await deleteVendor(v.id, typed, deleteReason.trim());
            toast.success("Vitrine supprimée", { description: r.storageCleaned ? "Photos et documents retirés du stockage." : "Fichiers à retirer du stockage (clé serveur non configurée)." });
            refreshPending();
            router.replace("/admin/prestataires");
          } catch (e) { toast.error((e as Error).message); }
          finally { setBusy(""); }
        }}>
        <p>La vitrine, ses photos, forfaits, demandes de devis et avis seront effacés. <b>Cette action est irréversible.</b> Le prestataire est prévenu par e-mail.</p>
        <label className="grid gap-1.5 font-semibold">
          Motif (journalisé et envoyé)
          <input value={deleteReason} onChange={(e) => setDeleteReason(e.target.value.slice(0, 300))} placeholder="Ex. : doublon, demande du prestataire…"
            className="h-10 rounded-lg border border-line-strong bg-surface px-3 text-sm font-normal focus-visible:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40" />
        </label>
      </ConfirmDialog>
    </>
  );
}

function Notice({ tone, title, children }: { tone: "rose" | "danger"; title: string; children: React.ReactNode }) {
  return (
    <div role="status" className={cn("mb-4 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm", tone === "danger" ? "border-danger/40 bg-danger/10" : "border-rose/40 bg-rose/10")}>
      <AlertTriangle className={cn("mt-0.5 size-4 shrink-0", tone === "danger" ? "text-danger" : "text-rose-ink")} aria-hidden />
      <p><b>{title}.</b> <span className="text-muted">{children}</span></p>
    </div>
  );
}
