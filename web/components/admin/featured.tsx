"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, CalendarClock, Crown, ImagePlus, Pencil, Plus, RefreshCw, Sparkles, Star, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, StatusTag } from "@/components/ui/bits";
import {
  addFeaturedStory, addPick, deleteSlide, getHome, removeFeaturedStory, removePick, reorder, saveSlide, setPeriod, setSlideActive, uploadSiteImage, vendorMedia,
} from "@/lib/admin/content";
import { periodStatus, type FeaturedStory, type HomePick, type MediaOption, type Slide, type VendorRef } from "@/lib/admin/content-types";
import { PUBLIC_SITE_URL } from "@/lib/config";
import { revalidatePublic } from "@/lib/admin/manage";
import { checkPhoto } from "@/lib/media";
import { cn } from "@/lib/utils";
import { DragHandle, SortableList } from "./sortable";
import { PeriodDialog, StoryPickerDialog, VendorAvatar, VendorPickerDialog, dateInputClass, fromLocalInput, toLocalInput } from "./pickers";
import { ConfirmDialog, PageHeader, Panel, fmtDate } from "./ui";

type Home = { slides: Slide[]; picks: HomePick[]; stories: FeaturedStory[] };

function PeriodTag({ startsAt, endsAt, active = true }: { startsAt?: string; endsAt?: string; active?: boolean }) {
  if (!active) return <StatusTag tone="muted">Désactivé</StatusTag>;
  const s = periodStatus(startsAt, endsAt);
  return s === "upcoming" ? <StatusTag tone="gold">À venir · {fmtDate(startsAt)}</StatusTag>
    : s === "ended" ? <StatusTag tone="muted">Terminé</StatusTag>
      : <StatusTag tone="success">{endsAt ? `En ligne jusqu’au ${fmtDate(endsAt)}` : "En ligne"}</StatusTag>;
}

export function Featured() {
  const [home, setHome] = React.useState<Home | null>(null);
  const [error, setError] = React.useState("");
  const [slideEdit, setSlideEdit] = React.useState<Slide | "new" | null>(null);
  const [picker, setPicker] = React.useState<"recommandations" | "a_la_une" | "story" | null>(null);
  const [period, setPeriodTarget] = React.useState<{ kind: "home_picks" | "featured_stories"; id: string; label: string; startsAt?: string; endsAt?: string } | null>(null);
  const [toDelete, setToDelete] = React.useState<Slide | null>(null);

  const load = React.useCallback(() => {
    getHome().then((h) => { setHome(h); setError(""); }).catch((e: Error) => setError(e.message));
  }, []);
  React.useEffect(load, [load]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); toast.success(ok); void revalidatePublic(["accueil"]); load(); } catch (e) { toast.error((e as Error).message); load(); }
  };
  /** Ordre : appliqué tout de suite à l'écran, enregistré en un appel */
  const saveOrder = async (kind: "featured_slides" | "home_picks" | "featured_stories", ids: string[]) => {
    try { await reorder(kind, ids); toast.success("Ordre enregistré"); void revalidatePublic(["accueil"]); } catch (e) { toast.error((e as Error).message); load(); }
  };

  if (error) return (
    <>
      <PageHeader title="Mise en avant" />
      <EmptyState icon={<AlertTriangle />} title="Chargement impossible" action={<Button variant="outline" size="sm" onClick={load}><RefreshCw aria-hidden />Réessayer</Button>}>{error}</EmptyState>
    </>
  );

  const spotlight = home?.picks.find((p) => p.section === "a_la_une");
  const recos = home?.picks.filter((p) => p.section === "recommandations") ?? [];

  return (
    <>
      <PageHeader title="Mise en avant" sub="Ce qui apparaît sur la page d’accueil du site. Glissez-déposez pour changer l’ordre."
        actions={<Button variant="outline" size="sm" asChild><a href={PUBLIC_SITE_URL} target="_blank" rel="noreferrer">Voir l’accueil</a></Button>} />

      <div className="grid gap-4">
        {/* Bandeau d'accueil */}
        <Panel title="Bandeau d’accueil (hero)" id="f-hero" action={<Button size="sm" onClick={() => setSlideEdit("new")}><Plus aria-hidden />Ajouter un slide</Button>}>
          {!home ? <div className="grid gap-2 p-3">{[0, 1].map((i) => <div key={i} className="skeleton h-20 rounded-lg" />)}</div> : !home.slides.length ? (
            <EmptyState className="m-3" icon={<ImagePlus />} title="Aucun slide">Sans slide, l’accueil affiche son visuel par défaut.</EmptyState>
          ) : (
            <SortableList items={home.slides} getId={(s) => s.id} label={(s) => s.title || s.vendor.name} className="divide-y divide-line"
              onReorder={(next) => { setHome({ ...home, slides: next }); void saveOrder("featured_slides", next.map((s) => s.id)); }}>
              {(s, handle, dragging) => (
                <div className={cn("flex items-center gap-3 bg-surface px-3 py-2.5", dragging && "rounded-lg shadow-2xl ring-1 ring-gold/50")}>
                  <DragHandle handle={handle} />
                  <span className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-lg bg-surface-2 sm:w-36">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {s.imageUrl && <img src={s.imageUrl} alt="" className="size-full object-cover" loading="lazy" />}
                    {s.mediaKind === "video" && <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 text-[10px] font-semibold text-white">Vidéo</span>}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{s.title || <span className="text-muted">Sans titre</span>}</p>
                    <p className="truncate text-[12.5px] text-muted">{s.subtitle || s.vendor.name}</p>
                    <div className="mt-1"><PeriodTag startsAt={s.startsAt} endsAt={s.endsAt} active={s.isActive} /></div>
                  </div>
                  <label className="hidden items-center gap-2 text-[12.5px] font-semibold sm:inline-flex">
                    <input type="checkbox" checked={s.isActive} className="size-4 accent-[var(--gold)]"
                      onChange={(e) => run(() => setSlideActive(s.id, e.target.checked), e.target.checked ? "Slide activé" : "Slide désactivé")} />Actif
                  </label>
                  <Button variant="ghost" size="icon" className="size-9" aria-label={`Modifier ${s.title || "le slide"}`} onClick={() => setSlideEdit(s)}><Pencil aria-hidden /></Button>
                  <Button variant="ghost" size="icon" className="size-9 text-danger" aria-label={`Supprimer ${s.title || "le slide"}`} onClick={() => setToDelete(s)}><Trash2 aria-hidden /></Button>
                </div>
              )}
            </SortableList>
          )}
        </Panel>

        <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
          {/* À la une */}
          <Panel title={<span className="inline-flex items-center gap-2"><Crown className="size-4 text-gold-ink" aria-hidden />Prestataire à la une</span>} id="f-spot">
            {!home ? <div className="skeleton m-3 h-40 rounded-lg" /> : spotlight ? (
              <div className="grid gap-3 p-4">
                <div className="flex items-center gap-3">
                  <VendorAvatar v={spotlight.vendor} size={52} />
                  <div className="min-w-0">
                    <Link href={`/admin/prestataires/${spotlight.vendor.id}`} className="block truncate font-display text-xl hover:text-gold-ink">{spotlight.vendor.name}</Link>
                    <p className="text-[13px] text-muted">{[spotlight.vendor.category, spotlight.vendor.city].filter(Boolean).join(" · ")}</p>
                  </div>
                </div>
                <PeriodTag startsAt={spotlight.startsAt} endsAt={spotlight.endsAt} />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setPicker("a_la_une")}>Changer</Button>
                  <Button size="sm" variant="ghost" onClick={() => setPeriodTarget({ kind: "home_picks", id: spotlight.id, label: spotlight.vendor.name, startsAt: spotlight.startsAt, endsAt: spotlight.endsAt })}><CalendarClock aria-hidden />Période</Button>
                  <Button size="sm" variant="ghost" className="text-danger" onClick={() => run(() => removePick(spotlight.id), "Retiré de la une")}><X aria-hidden />Retirer</Button>
                </div>
              </div>
            ) : (
              <EmptyState className="m-3" icon={<Crown />} title="Personne à la une" action={<Button size="sm" onClick={() => setPicker("a_la_une")}>Choisir un prestataire</Button>}>
                Un seul prestataire peut être mis à la une à la fois.
              </EmptyState>
            )}
          </Panel>

          {/* Recommandations */}
          <Panel title={<span className="inline-flex items-center gap-2"><Sparkles className="size-4 text-gold-ink" aria-hidden />Nos recommandations ({recos.length})</span>} id="f-reco"
            action={<Button size="sm" variant="outline" onClick={() => setPicker("recommandations")}><Plus aria-hidden />Ajouter</Button>}>
            {!home ? <div className="grid grid-cols-2 gap-2 p-3">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-20 rounded-lg" />)}</div> : !recos.length ? (
              <EmptyState className="m-3" icon={<Star />} title="Aucune recommandation">Les prestataires ajoutés ici reçoivent le badge « Recommandé ».</EmptyState>
            ) : (
              <SortableList items={recos} getId={(p) => p.id} label={(p) => p.vendor.name} layout="grid" className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 2xl:grid-cols-3"
                onReorder={(next) => { setHome({ ...home, picks: [...home.picks.filter((p) => p.section !== "recommandations"), ...next] }); void saveOrder("home_picks", next.map((p) => p.id)); }}>
                {(p, handle, dragging) => (
                  <div className={cn("flex items-center gap-2 rounded-xl border border-line bg-surface p-2", dragging && "shadow-2xl ring-1 ring-gold/50")}>
                    <DragHandle handle={handle} />
                    <VendorAvatar v={p.vendor} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-semibold">{recos.indexOf(p) + 1}. {p.vendor.name}</p>
                      <p className="truncate text-[12px] text-muted">{p.startsAt || p.endsAt ? <PeriodTag startsAt={p.startsAt} endsAt={p.endsAt} /> : [p.vendor.category, p.vendor.city].filter(Boolean).join(" · ")}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="size-8" aria-label={`Mettre ${p.vendor.name} à la une`} title="Mettre à la une" onClick={() => run(() => addPick("a_la_une", p.vendor), `${p.vendor.name} est à la une`)}><Crown aria-hidden /></Button>
                    <Button variant="ghost" size="icon" className="size-8" aria-label={`Période de ${p.vendor.name}`} onClick={() => setPeriodTarget({ kind: "home_picks", id: p.id, label: p.vendor.name, startsAt: p.startsAt, endsAt: p.endsAt })}><CalendarClock aria-hidden /></Button>
                    <Button variant="ghost" size="icon" className="size-8 text-danger" aria-label={`Retirer ${p.vendor.name}`} onClick={() => run(() => removePick(p.id), "Retiré des recommandations")}><X aria-hidden /></Button>
                  </div>
                )}
              </SortableList>
            )}
          </Panel>
        </div>

        {/* Stories */}
        <Panel title={`Stories mises en avant (${home?.stories.length ?? 0})`} id="f-stories" action={<Button size="sm" variant="outline" onClick={() => setPicker("story")}><Plus aria-hidden />Ajouter une story</Button>}>
          {!home ? <div className="flex gap-3 p-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-40 w-28 rounded-xl" />)}</div> : !home.stories.length ? (
            <EmptyState className="m-3" title="Aucune story en avant">Les stories choisies ouvrent la rangée de stories de l’accueil.</EmptyState>
          ) : (
            <SortableList items={home.stories} getId={(s) => s.storyId} label={(s) => `${s.title} (${s.vendor.name})`} layout="grid" className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-4 lg:grid-cols-6"
              onReorder={(next) => { setHome({ ...home, stories: next }); void saveOrder("featured_stories", next.map((s) => s.storyId)); }}>
              {(s, handle, dragging) => (
                <div className={cn("grid gap-1.5 rounded-xl bg-surface", dragging && "shadow-2xl ring-1 ring-gold/50")}>
                  <div className="relative aspect-[9/14] overflow-hidden rounded-xl bg-surface-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {s.coverUrl && <img src={s.coverUrl} alt="" className="size-full object-cover" loading="lazy" />}
                    <DragHandle handle={handle} className="absolute left-1 top-1 bg-black/55 text-white hover:bg-black/70 hover:text-white" />
                    <button type="button" onClick={() => run(() => removeFeaturedStory(s.storyId), "Story retirée")} aria-label={`Retirer la story ${s.title}`}
                      className="absolute right-1 top-1 grid size-8 place-items-center rounded-lg bg-black/55 text-white hover:bg-black/75"><X className="size-4" aria-hidden /></button>
                  </div>
                  <p className="truncate px-0.5 text-[13px] font-semibold">{s.title}</p>
                  <p className="-mt-1.5 truncate px-0.5 text-[12px] text-muted">{s.vendor.name}</p>
                  <button type="button" className="justify-self-start px-0.5 text-[12px] font-semibold text-gold-ink hover:underline"
                    onClick={() => setPeriodTarget({ kind: "featured_stories", id: s.storyId, label: s.title, startsAt: s.startsAt, endsAt: s.endsAt })}>
                    {s.startsAt || s.endsAt ? <PeriodTag startsAt={s.startsAt} endsAt={s.endsAt} /> : "Définir une période"}
                  </button>
                </div>
              )}
            </SortableList>
          )}
        </Panel>
      </div>

      <SlideDialog slide={slideEdit} onClose={() => setSlideEdit(null)} onSaved={() => { setSlideEdit(null); load(); }} />
      <VendorPickerDialog open={picker === "recommandations" || picker === "a_la_une"} onOpenChange={(o) => !o && setPicker(null)}
        title={picker === "a_la_une" ? "Choisir le prestataire à la une" : "Ajouter aux recommandations"}
        exclude={picker === "a_la_une" ? (spotlight ? [spotlight.vendor.id] : []) : recos.map((p) => p.vendor.id)}
        onPick={(v) => run(() => addPick(picker === "a_la_une" ? "a_la_une" : "recommandations", v), picker === "a_la_une" ? `${v.name} est à la une` : `${v.name} ajouté aux recommandations`)} />
      <StoryPickerDialog open={picker === "story"} onOpenChange={(o) => !o && setPicker(null)} exclude={home?.stories.map((s) => s.storyId) ?? []}
        onPick={(s) => run(() => addFeaturedStory(s), "Story mise en avant")} />
      <PeriodDialog open={!!period} onOpenChange={(o) => !o && setPeriodTarget(null)} title={`Période de diffusion — ${period?.label ?? ""}`}
        startsAt={period?.startsAt} endsAt={period?.endsAt}
        onSave={async (s, e) => { if (period) await run(() => setPeriod(period.kind, period.id, s, e), "Période enregistrée"); }} />
      <ConfirmDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)} title="Supprimer ce slide ?" confirmLabel="Supprimer"
        onConfirm={async () => { if (toDelete) { await run(() => deleteSlide(toDelete.id), "Slide supprimé"); setToDelete(null); } }}>
        <p>« {toDelete?.title || toDelete?.vendor.name} » ne sera plus affiché sur l’accueil.</p>
      </ConfirmDialog>
    </>
  );
}

/** Création / modification d'un slide : prestataire, visuel (photo de sa vitrine ou visuel dédié), textes, période */
function SlideDialog({ slide, onClose, onSaved }: { slide: Slide | "new" | null; onClose: () => void; onSaved: () => void }) {
  if (!slide) return null;
  return <SlideDialogOpen key={slide === "new" ? "new" : slide.id} slide={slide === "new" ? null : slide} onClose={onClose} onSaved={onSaved} />;
}
function SlideDialogOpen({ slide, onClose, onSaved }: { slide: Slide | null; onClose: () => void; onSaved: () => void }) {
  const [vendor, setVendor] = React.useState<VendorRef | null>(slide?.vendor ?? null);
  // valeur à jour pour la fermeture du sélecteur (évite de lire un état périmé)
  const pickedRef = React.useRef<VendorRef | null>(slide?.vendor ?? null);
  const [picking, setPicking] = React.useState(!slide);
  const [mediaList, setMediaList] = React.useState<MediaOption[] | null>(null);
  const [mediaId, setMediaId] = React.useState(slide?.mediaId);
  const [image, setImage] = React.useState<{ path?: string; url?: string }>({ path: slide?.imagePath, url: slide?.imagePath ? slide.imageUrl : undefined });
  const [title, setTitle] = React.useState(slide?.title ?? "");
  const [subtitle, setSubtitle] = React.useState(slide?.subtitle ?? "");
  const [starts, setStarts] = React.useState(toLocalInput(slide?.startsAt));
  const [ends, setEnds] = React.useState(toLocalInput(slide?.endsAt));
  const [active, setActive] = React.useState(slide?.isActive ?? true);
  const [busy, setBusy] = React.useState<"" | "upload" | "save">("");
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!vendor) return;
    let alive = true;
    vendorMedia(vendor.id).then((m) => alive && setMediaList(m)).catch(() => alive && setMediaList([]));
    return () => { alive = false; };
  }, [vendor]);

  const invalidDates = !!(starts && ends && ends <= starts);
  const hasVisual = !!(image.path || mediaId);

  async function upload(file: File) {
    const err = checkPhoto(file);
    if (err) { toast.error(err); return; }
    setBusy("upload");
    try { const r = await uploadSiteImage(file, "hero"); setImage(r); setMediaId(undefined); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(""); }
  }

  async function save() {
    if (!vendor) return;
    setBusy("save");
    try {
      await saveSlide({ id: slide?.id, vendorId: vendor.id, mediaId: image.path ? undefined : mediaId, imagePath: image.path, title: title.trim(), subtitle: subtitle.trim(),
        startsAt: fromLocalInput(starts), endsAt: fromLocalInput(ends), isActive: active }, vendor);
      toast.success(slide ? "Slide modifié" : "Slide ajouté");
      onSaved();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(""); }
  }

  return (
    <>
      <Dialog open={!picking} onOpenChange={(o) => !o && onClose()} title={slide ? "Modifier le slide" : "Nouveau slide"} wide className="admin-ui"
        footer={<>
          <Button variant="ghost" size="sm" onClick={onClose}>Annuler</Button>
          <Button size="sm" loading={busy === "save"} disabled={!vendor || !hasVisual || invalidDates || busy === "upload"} onClick={save}>Enregistrer</Button>
        </>}>
        <div className="grid gap-5">
          <div className="flex items-center gap-3 rounded-xl border border-line p-3">
            {vendor ? <><VendorAvatar v={vendor} /><span className="min-w-0 flex-1"><b className="block truncate text-sm">{vendor.name}</b><span className="text-[12px] text-muted">{[vendor.category, vendor.city].filter(Boolean).join(" · ")}</span></span></> : <span className="flex-1 text-sm text-muted">Aucun prestataire</span>}
            <Button size="sm" variant="outline" onClick={() => setPicking(true)}>{vendor ? "Changer" : "Choisir"}</Button>
          </div>

          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-semibold">Visuel</legend>
            {image.url ? (
              <div className="relative aspect-[21/9] overflow-hidden rounded-xl bg-surface-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt="Visuel dédié" className="size-full object-cover" />
                <Button size="sm" variant="subtle" className="absolute right-2 top-2" onClick={() => setImage({})}><X aria-hidden />Retirer</Button>
              </div>
            ) : (
              <>
                <p className="text-[13px] text-muted">Choisissez une photo de sa vitrine ou envoyez un visuel dédié (format paysage conseillé).</p>
                {!mediaList ? <div className="grid grid-cols-4 gap-1.5">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton aspect-video rounded-lg" />)}</div> : (
                  <ul className="grid max-h-56 grid-cols-3 gap-1.5 overflow-y-auto sm:grid-cols-5" role="radiogroup" aria-label="Photos de la vitrine">
                    {mediaList.map((m) => (
                      <li key={m.id}>
                        <button type="button" role="radio" aria-checked={mediaId === m.id} aria-label={m.kind === "video" ? "Vidéo" : "Photo"} onClick={() => setMediaId(m.id)}
                          className={cn("relative block aspect-video w-full overflow-hidden rounded-lg bg-surface-2", mediaId === m.id ? "ring-2 ring-gold ring-offset-2 ring-offset-surface" : "opacity-80 hover:opacity-100")}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={m.url} alt="" className="size-full object-cover" loading="lazy" />
                          {m.kind === "video" && <span className="absolute left-1 top-1 rounded bg-black/70 px-1 text-[10px] font-semibold text-white">Vidéo</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
                <Button size="sm" variant="outline" className="justify-self-start" loading={busy === "upload"} onClick={() => fileRef.current?.click()}><Upload aria-hidden />Envoyer un visuel dédié</Button>
              </>
            )}
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-semibold">Titre<input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} className={dateInputClass} placeholder="L’art de raconter votre jour J" /></label>
            <label className="grid gap-1.5 text-sm font-semibold">Sous-titre<input value={subtitle} maxLength={200} onChange={(e) => setSubtitle(e.target.value)} className={dateInputClass} placeholder="Photographe · Kinshasa" /></label>
            <label className="grid gap-1.5 text-sm font-semibold">Début de diffusion<input type="datetime-local" value={starts} onChange={(e) => setStarts(e.target.value)} className={dateInputClass} /></label>
            <label className="grid gap-1.5 text-sm font-semibold">Fin de diffusion<input type="datetime-local" value={ends} min={starts || undefined} onChange={(e) => setEnds(e.target.value)} className={dateInputClass} aria-invalid={invalidDates || undefined} /></label>
          </div>
          {invalidDates && <p role="alert" className="-mt-3 text-[13px] font-medium text-danger">La fin doit être après le début.</p>}
          <label className="inline-flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-4 accent-[var(--gold)]" />Actif</label>
        </div>
      </Dialog>
      <VendorPickerDialog open={picking} onOpenChange={(o) => { setPicking(o); if (!o && !pickedRef.current) onClose(); }} title="Prestataire du slide"
        onPick={(v) => {
          pickedRef.current = v;
          setVendor(v); setMediaList(null); setMediaId(undefined);
          if (!title) setTitle(v.name);
          if (!subtitle) setSubtitle([v.category, v.city].filter(Boolean).join(" · "));
        }} />
    </>
  );
}
