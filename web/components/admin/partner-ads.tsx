"use client";

import * as React from "react";
import { AlertTriangle, ExternalLink, Handshake, Pencil, Plus, RefreshCw, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, StatusTag } from "@/components/ui/bits";
import { deletePartnerAd, listPartnerAds, normalizeLink, reorderPartnerAds, savePartnerAd, setPartnerAdActive, uploadSiteImage } from "@/lib/admin/content";
import { periodStatus, type PartnerAd } from "@/lib/admin/content-types";
import { revalidatePublic } from "@/lib/admin/manage";
import { checkPhoto } from "@/lib/media";
import { cn } from "@/lib/utils";
import { DragHandle, SortableList } from "./sortable";
import { dateInputClass, fromLocalInput, toLocalInput } from "./pickers";
import { ConfirmDialog, Panel, fmtDate } from "./ui";

function AdStatus({ ad }: { ad: PartnerAd }) {
  if (!ad.isActive) return <StatusTag tone="muted">Désactivée</StatusTag>;
  const s = periodStatus(ad.startsAt, ad.endsAt);
  return s === "upcoming" ? <StatusTag tone="gold">À venir · {fmtDate(ad.startsAt)}</StatusTag>
    : s === "ended" ? <StatusTag tone="muted">Terminée</StatusTag>
      : <StatusTag tone="success">{ad.endsAt ? `En ligne jusqu’au ${fmtDate(ad.endsAt)}` : "En ligne"}</StatusTag>;
}

const host = (url?: string) => { try { return url ? new URL(url).hostname.replace(/^www\./, "") : ""; } catch { return ""; } };

/** Partenaires & publicités : visuels affichés dans le bandeau « Nos partenaires » de l'accueil */
export function PartnerAdsPanel() {
  const [ads, setAds] = React.useState<PartnerAd[] | null>(null);
  const [error, setError] = React.useState("");
  const [edit, setEdit] = React.useState<PartnerAd | "new" | null>(null);
  const [toDelete, setToDelete] = React.useState<PartnerAd | null>(null);

  const load = React.useCallback(() => {
    listPartnerAds().then((a) => { setAds(a); setError(""); }).catch((e: Error) => setError(e.message));
  }, []);
  React.useEffect(load, [load]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); toast.success(ok); void revalidatePublic(["accueil"]); load(); } catch (e) { toast.error((e as Error).message); load(); }
  };

  return (
    <Panel id="f-partners"
      title={<span className="inline-flex items-center gap-2"><Handshake className="size-4 text-gold-ink" aria-hidden />Partenaires & publicités ({ads?.length ?? 0})</span>}
      action={<Button size="sm" onClick={() => setEdit("new")}><Plus aria-hidden />Ajouter une publicité</Button>}>
      {error ? (
        <EmptyState className="m-3" icon={<AlertTriangle />} title="Chargement impossible" action={<Button variant="outline" size="sm" onClick={load}><RefreshCw aria-hidden />Réessayer</Button>}>{error}</EmptyState>
      ) : !ads ? <div className="grid gap-2 p-3">{[0, 1].map((i) => <div key={i} className="skeleton h-20 rounded-lg" />)}</div> : !ads.length ? (
        <EmptyState className="m-3" icon={<Handshake />} title="Aucune publicité" action={<Button size="sm" variant="outline" onClick={() => setEdit("new")}>Ajouter la première</Button>}>
          Visuels de vos partenaires (salles, boissons, banques…) affichés sur l’accueil, avec un lien vers leur site ou leur page.
        </EmptyState>
      ) : (
        <SortableList items={ads} getId={(a) => a.id} label={(a) => a.partner} className="divide-y divide-line"
          onReorder={(next) => {
            setAds(next);
            reorderPartnerAds(next.map((a) => a.id)).then(() => { toast.success("Ordre enregistré"); void revalidatePublic(["accueil"]); }).catch((e: Error) => { toast.error(e.message); load(); });
          }}>
          {(a, handle, dragging) => (
            <div className={cn("flex items-center gap-3 bg-surface px-3 py-2.5", dragging && "rounded-lg shadow-2xl ring-1 ring-gold/50")}>
              <DragHandle handle={handle} />
              <span className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-lg bg-surface-2 sm:w-36">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {a.imageUrl && <img src={a.imageUrl} alt="" className="size-full object-cover" loading="lazy" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{a.partner}</p>
                <p className="truncate text-[12.5px] text-muted">{a.title || (a.linkUrl ? host(a.linkUrl) : "Sans lien")}</p>
                <div className="mt-1 flex flex-wrap gap-1.5"><AdStatus ad={a} />{a.showInHero && <StatusTag tone="gold">Aussi dans le bandeau</StatusTag>}</div>
              </div>
              <label className="hidden items-center gap-2 text-[12.5px] font-semibold sm:inline-flex">
                <input type="checkbox" checked={a.isActive} className="size-4 accent-[var(--gold)]"
                  onChange={(e) => run(() => setPartnerAdActive(a.id, e.target.checked), e.target.checked ? "Publicité activée" : "Publicité désactivée")} />Active
              </label>
              {a.linkUrl && (
                <Button variant="ghost" size="icon" className="size-9" asChild>
                  <a href={a.linkUrl} target="_blank" rel="noreferrer" aria-label={`Ouvrir le lien de ${a.partner}`}><ExternalLink aria-hidden /></a>
                </Button>
              )}
              <Button variant="ghost" size="icon" className="size-9" aria-label={`Modifier ${a.partner}`} onClick={() => setEdit(a)}><Pencil aria-hidden /></Button>
              <Button variant="ghost" size="icon" className="size-9 text-danger" aria-label={`Supprimer ${a.partner}`} onClick={() => setToDelete(a)}><Trash2 aria-hidden /></Button>
            </div>
          )}
        </SortableList>
      )}

      <AdDialog ad={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); void revalidatePublic(["accueil"]); load(); }} />
      <ConfirmDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)} title="Supprimer cette publicité ?" confirmLabel="Supprimer"
        onConfirm={async () => { if (toDelete) { await run(() => deletePartnerAd(toDelete), "Publicité supprimée"); setToDelete(null); } }}>
        <p>La publicité « {toDelete?.partner} » et son visuel seront retirés de l’accueil.</p>
      </ConfirmDialog>
    </Panel>
  );
}

function AdDialog({ ad, onClose, onSaved }: { ad: PartnerAd | "new" | null; onClose: () => void; onSaved: () => void }) {
  if (!ad) return null;
  return <AdDialogOpen key={ad === "new" ? "new" : ad.id} ad={ad === "new" ? null : ad} onClose={onClose} onSaved={onSaved} />;
}

function AdDialogOpen({ ad, onClose, onSaved }: { ad: PartnerAd | null; onClose: () => void; onSaved: () => void }) {
  const [image, setImage] = React.useState<{ path?: string; url?: string }>({ path: ad?.imagePath, url: ad?.imageUrl });
  const [partner, setPartner] = React.useState(ad?.partner ?? "");
  const [title, setTitle] = React.useState(ad?.title ?? "");
  const [link, setLink] = React.useState(ad?.linkUrl ?? "");
  const [starts, setStarts] = React.useState(toLocalInput(ad?.startsAt));
  const [ends, setEnds] = React.useState(toLocalInput(ad?.endsAt));
  const [active, setActive] = React.useState(ad?.isActive ?? true);
  const [inHero, setInHero] = React.useState(ad?.showInHero ?? true);
  const [busy, setBusy] = React.useState<"" | "upload" | "save">("");
  const fileRef = React.useRef<HTMLInputElement>(null);

  const invalidDates = !!(starts && ends && ends <= starts);
  const linkUrl = normalizeLink(link);
  const invalidLink = !!link.trim() && !linkUrl;
  const canSave = !!image.path && !!partner.trim() && !invalidDates && !invalidLink && busy === "";

  async function upload(file: File) {
    const err = checkPhoto(file);
    if (err) { toast.error(err); return; }
    setBusy("upload");
    try { setImage(await uploadSiteImage(file, "partenaires")); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(""); }
  }

  async function save() {
    if (!image.path) return;
    setBusy("save");
    try {
      await savePartnerAd({ id: ad?.id, partner, title, imagePath: image.path, linkUrl, showInHero: inHero, startsAt: fromLocalInput(starts), endsAt: fromLocalInput(ends), isActive: active });
      toast.success(ad ? "Publicité modifiée" : "Publicité ajoutée");
      onSaved();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(""); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={ad ? "Modifier la publicité" : "Nouvelle publicité"} wide className="admin-ui"
      footer={<>
        <Button variant="ghost" size="sm" onClick={onClose}>Annuler</Button>
        <Button size="sm" loading={busy === "save"} disabled={!canSave} onClick={save}>Enregistrer</Button>
      </>}>
      <div className="grid gap-5">
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-semibold">Visuel</legend>
          <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
          {image.url ? (
            <div className="relative aspect-video overflow-hidden rounded-xl bg-surface-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.url} alt="Visuel de la publicité" className="size-full object-cover" />
              <Button size="sm" variant="subtle" className="absolute right-2 top-2" loading={busy === "upload"} onClick={() => fileRef.current?.click()}><Upload aria-hidden />Remplacer</Button>
            </div>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy === "upload"}
              className="grid aspect-video place-items-center gap-1 rounded-xl border border-dashed border-line bg-surface-2 text-center text-sm text-muted hover:border-gold hover:text-text">
              <span className="grid justify-items-center gap-2">
                <Upload className="size-6" aria-hidden />
                <b className="text-text">{busy === "upload" ? "Envoi en cours…" : "Envoyer le visuel"}</b>
                <span className="text-[12.5px]">Format paysage 16:9 conseillé (ex. 1600 × 900), JPG, PNG ou WebP</span>
              </span>
            </button>
          )}
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-semibold">Partenaire *
            <input value={partner} maxLength={80} onChange={(e) => setPartner(e.target.value)} className={dateInputClass} placeholder="Nom de l’entreprise" />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold">Accroche
            <input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} className={dateInputClass} placeholder="-20 % pour les mariés NDOA" />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold sm:col-span-2">Lien (site, page Facebook, WhatsApp…)
            <input value={link} inputMode="url" onChange={(e) => setLink(e.target.value)} className={dateInputClass} placeholder="www.partenaire.cd" aria-invalid={invalidLink || undefined} />
          </label>
        </div>
        {invalidLink && <p role="alert" className="-mt-3 text-[13px] font-medium text-danger">Ce lien n’est pas valide.</p>}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-semibold">Début de diffusion<input type="datetime-local" value={starts} onChange={(e) => setStarts(e.target.value)} className={dateInputClass} /></label>
          <label className="grid gap-1.5 text-sm font-semibold">Fin de diffusion<input type="datetime-local" value={ends} min={starts || undefined} onChange={(e) => setEnds(e.target.value)} className={dateInputClass} aria-invalid={invalidDates || undefined} /></label>
        </div>
        {invalidDates && <p role="alert" className="-mt-3 text-[13px] font-medium text-danger">La fin doit être après le début.</p>}
        <p className="-mt-2 text-[12.5px] text-muted">Sans dates, la publicité reste en ligne tant qu’elle est active.</p>

        <label className="flex items-start gap-2 text-sm font-semibold">
          <input type="checkbox" checked={inHero} onChange={(e) => setInHero(e.target.checked)} className="mt-0.5 size-4 accent-[var(--gold)]" />
          <span>Afficher aussi en fond du bandeau d’accueil
            <span className="block text-[12.5px] font-normal text-muted">La publicité défile en plein écran avec les photos des prestataires. Idéal : image large (2400 px), sans texte important sur la gauche, où s’affiche le titre du site.</span>
          </span>
        </label>

        <label className="inline-flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-4 accent-[var(--gold)]" />Active
          {image.url && <button type="button" className="ml-auto inline-flex items-center gap-1 text-[12.5px] font-semibold text-muted hover:text-danger" onClick={() => setImage({})}><X className="size-3.5" aria-hidden />Retirer le visuel</button>}
        </label>
      </div>
    </Dialog>
  );
}
