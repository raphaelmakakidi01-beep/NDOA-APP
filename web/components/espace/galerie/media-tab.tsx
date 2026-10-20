"use client";

import { useMemo, useRef, useState } from "react";
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertCircle, Check, FolderInput, GripVertical, ImagePlus, Loader2, Play, Star, StarOff, Trash2, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/bits";
import { useEspace } from "@/lib/espace/store";
import { MEDIA_ACCEPT } from "@/lib/media";
import type { MediaItem } from "@/lib/espace/types";
import { cn } from "@/lib/utils";
import { MediaDialog, fmtDuration } from "./media-dialog";

const ACCEPT = MEDIA_ACCEPT;
type Filter = "all" | "photo" | "video" | "featured" | "none" | `album:${string}`;

export function UploadZone({ albumId, highlight }: { albumId?: string; highlight?: boolean }) {
  const { upload } = useEspace();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files.length) upload(e.dataTransfer.files, albumId); }}
      className={cn("grid gap-3 rounded-3xl border-2 border-dashed p-6 text-center transition-colors sm:flex sm:items-center sm:gap-5 sm:text-left",
        over ? "border-gold bg-gold/10" : highlight ? "border-gold/70 bg-gold/5" : "border-line-strong")}>
      <span className="mx-auto grid size-12 shrink-0 place-items-center rounded-2xl bg-gold/15 text-gold-ink sm:mx-0"><UploadCloud className="size-6" aria-hidden /></span>
      <div className="flex-1">
        <p className="font-semibold">Glissez vos photos et vidéos ici</p>
        <p className="text-sm text-muted">Plusieurs fichiers à la fois · photos compressées et redimensionnées automatiquement · photos JPEG, PNG ou WebP · vidéos MP4</p>
      </div>
      <Button onClick={() => input.current?.click()}><ImagePlus aria-hidden />Choisir des fichiers</Button>
      <input ref={input} type="file" multiple accept={ACCEPT} className="sr-only" tabIndex={-1} aria-label="Choisir des fichiers"
        onChange={(e) => { if (e.target.files?.length) upload(e.target.files, albumId); e.target.value = ""; }} />
    </div>
  );
}

function Tile({ m, selected, selecting, onToggle, onOpen, sortable }: { m: MediaItem; selected: boolean; selecting: boolean; onToggle: () => void; onOpen: () => void; sortable: boolean }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: m.id, disabled: !sortable });
  const busy = m.status === "uploading" || m.status === "processing";
  const thumb = m.kind === "video" ? m.posterUrl : m.url;
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("group relative aspect-square overflow-hidden rounded-2xl bg-surface-2 ring-1 ring-line", isDragging && "z-10 opacity-80 shadow-2xl ring-2 ring-gold", selected && "ring-2 ring-gold")}>
      {thumb && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb} alt={m.alt || ""} loading="lazy" className={cn("size-full object-cover transition-transform duration-500", busy && "opacity-50 blur-[1px]", !busy && "group-hover:scale-[1.03]")} />
      )}
      {!busy && m.status !== "error" && (
        <button type="button" onClick={selecting ? onToggle : onOpen} className="absolute inset-0" aria-label={`${selecting ? (selected ? "Désélectionner" : "Sélectionner") : "Ouvrir"} ${m.kind === "video" ? "la vidéo" : "la photo"} ${m.name}`} aria-pressed={selecting ? selected : undefined} />
      )}
      {m.kind === "video" && !busy && (
        <span className="pointer-events-none absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold text-white"><Play className="size-3 fill-current" aria-hidden />{fmtDuration(m.duration)}</span>
      )}
      {m.featured && !busy && <span className="pointer-events-none absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-black/60 text-gold" title="À la une"><Star className="size-3.5 fill-current" aria-hidden /><span className="sr-only">À la une</span></span>}
      {busy && (
        <div className="absolute inset-x-3 bottom-3" role="progressbar" aria-valuenow={m.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Envoi de ${m.name}`}>
          <p className="mb-1 flex items-center justify-between gap-2 text-[11px] font-semibold text-white drop-shadow">
            <span className="truncate">{m.status === "processing" ? "Compression…" : m.name}</span><span>{m.progress} %</span>
          </p>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/25"><div className="h-full rounded-full bg-gold transition-[width]" style={{ width: `${m.progress}%` }} /></div>
        </div>
      )}
      {busy && m.progress < 10 && <Loader2 className="absolute left-1/2 top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 animate-spin text-white" aria-hidden />}
      {m.status === "error" && (
        <div className="absolute inset-0 grid place-items-center bg-black/75 p-3 text-center text-xs text-white">
          <span><AlertCircle className="mx-auto mb-1 size-5 text-rose" aria-hidden />{m.error}</span>
        </div>
      )}
      {!busy && (
        <>
          <button type="button" onClick={onToggle} aria-label={selected ? `Désélectionner ${m.name}` : `Sélectionner ${m.name}`} aria-pressed={selected}
            className={cn("absolute left-2 top-2 grid size-7 place-items-center rounded-full border-2 transition-opacity", selected ? "border-gold bg-gold text-on-gold opacity-100" : "border-white/80 bg-black/30 text-transparent opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100", selecting && "opacity-100")}>
            <Check className="size-4" strokeWidth={3} aria-hidden />
          </button>
          {sortable && (
            <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners} aria-label={`Déplacer ${m.name} (espace pour saisir, flèches pour déplacer)`}
              className="absolute bottom-2 right-2 grid size-8 cursor-grab touch-none place-items-center rounded-full bg-black/60 text-white opacity-100 active:cursor-grabbing sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100">
              <GripVertical className="size-4" aria-hidden />
            </button>
          )}
        </>
      )}
    </li>
  );
}

export function MediaTab({ initialAlbum, highlightUpload }: { initialAlbum?: string; highlightUpload?: boolean }) {
  const { data, reorder, updateMedia, deleteMedia } = useEspace();
  const [filter, setFilter] = useState<Filter>(initialAlbum ? `album:${initialAlbum}` : "all");
  const [selected, setSelected] = useState<string[]>([]);
  const [open, setOpen] = useState<MediaItem | null>(null);
  const [confirm, setConfirm] = useState<string[] | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);

  const list = useMemo(() => data.media.filter((m) => {
    if (filter === "photo" || filter === "video") return m.kind === filter;
    if (filter === "featured") return m.featured;
    if (filter === "none") return !m.albumId;
    if (filter.startsWith("album:")) return m.albumId === filter.slice(6);
    return true;
  }), [data.media, filter]);
  const sortable = filter === "all" && selected.length === 0;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const albumName = filter.startsWith("album:") ? data.albums.find((a) => a.id === filter.slice(6))?.title : undefined;

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const ids = data.media.map((m) => m.id);
    reorder(arrayMove(ids, ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id))));
  }
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const doDelete = (ids: string[]) => { deleteMedia(ids); setSelected([]); setOpen(null); setConfirm(null); toast.success(ids.length > 1 ? `${ids.length} fichiers supprimés` : "Fichier supprimé"); };

  const chips: { v: Filter; label: string }[] = [
    { v: "all", label: `Tout (${data.media.length})` }, { v: "photo", label: "Photos" }, { v: "video", label: "Vidéos" }, { v: "featured", label: "À la une" }, { v: "none", label: "Sans album" },
    ...data.albums.map((a) => ({ v: `album:${a.id}` as Filter, label: a.title })),
  ];

  return (
    <div className="grid grid-cols-1 gap-5">
      <UploadZone albumId={filter.startsWith("album:") ? filter.slice(6) : undefined} highlight={highlightUpload} />

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filtrer les médias">
        {chips.map((c) => (
          <button key={c.v} type="button" aria-pressed={filter === c.v} onClick={() => { setFilter(c.v); setSelected([]); }}
            className={cn("h-9 shrink-0 rounded-full border px-3.5 text-sm font-semibold transition-colors", filter === c.v ? "border-gold bg-gold text-on-gold" : "border-line-strong text-muted hover:text-text")}>
            {c.label}
          </button>
        ))}
      </div>

      {selected.length > 0 ? (
        <div className="sticky top-[124px] z-20 flex flex-wrap items-center gap-2 rounded-2xl border border-gold/40 bg-surface/95 p-2 pl-4 shadow-xl backdrop-blur-xl" role="toolbar" aria-label="Actions sur la sélection">
          <span className="mr-auto text-sm font-semibold">{selected.length} sélectionné{selected.length > 1 ? "s" : ""}</span>
          <Button variant="ghost" size="sm" onClick={() => {
            const canAdd = 12 - data.media.filter((m) => m.featured && !selected.includes(m.id)).length;
            selected.slice(0, Math.max(0, canAdd)).forEach((id) => updateMedia(id, { featured: true }));
            if (selected.length > canAdd) toast("Limite de 12 médias à la une atteinte.");
            setSelected([]);
          }}><Star aria-hidden />À la une</Button>
          <Button variant="ghost" size="sm" onClick={() => { selected.forEach((id) => updateMedia(id, { featured: false })); setSelected([]); }}><StarOff aria-hidden />Retirer</Button>
          <Button variant="ghost" size="sm" onClick={() => setMoveOpen(true)} disabled={!data.albums.length}><FolderInput aria-hidden />Album</Button>
          <Button variant="danger" size="sm" onClick={() => setConfirm(selected)}><Trash2 aria-hidden />Supprimer</Button>
          <button type="button" onClick={() => setSelected([])} className="grid size-9 place-items-center rounded-full hover:bg-surface-2" aria-label="Annuler la sélection"><X className="size-4" aria-hidden /></button>
        </div>
      ) : (
        <p className="text-[13px] text-muted">
          {sortable ? "Glissez la poignée d’une vignette pour changer l’ordre d’affichage sur votre vitrine (au clavier : Espace puis flèches)." : filter !== "all" ? "La réorganisation se fait depuis le filtre « Tout »." : ""}
        </p>
      )}

      {list.length ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}
          accessibility={{
            screenReaderInstructions: { draggable: "Appuyez sur Espace pour saisir la vignette, utilisez les flèches pour la déplacer, puis Espace pour la déposer ou Échap pour annuler." },
            announcements: {
              onDragStart: () => "Vignette saisie.",
              onDragOver: ({ over }) => (over ? `Au-dessus de la position ${data.media.findIndex((m) => m.id === over.id) + 1}.` : "Hors de la grille."),
              onDragEnd: ({ over }) => (over ? `Vignette déposée en position ${data.media.findIndex((m) => m.id === over.id) + 1}.` : "Vignette relâchée."),
              onDragCancel: () => "Déplacement annulé.",
            },
          }}>
          <SortableContext items={list.map((m) => m.id)} strategy={rectSortingStrategy}>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
              {list.map((m) => <Tile key={m.id} m={m} sortable={sortable} selected={selected.includes(m.id)} selecting={selected.length > 0} onToggle={() => toggle(m.id)} onOpen={() => setOpen(m)} />)}
            </ul>
          </SortableContext>
        </DndContext>
      ) : (
        <EmptyState icon={<ImagePlus />} title={albumName ? `L’album « ${albumName} » est vide` : "Aucun média ici"}>
          {filter === "video" ? "Ajoutez un teaser ou un extrait de film : les vidéos captent deux fois plus l’attention." : "Glissez des fichiers dans la zone ci-dessus pour commencer."}
        </EmptyState>
      )}

      <MediaDialog key={open?.id} item={open} onClose={() => setOpen(null)} onDelete={(ids) => setConfirm(ids)} />

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)} title="Supprimer définitivement ?"
        description={confirm && confirm.length > 1 ? `${confirm.length} fichiers seront retirés de votre vitrine et de vos stories.` : "Ce fichier sera retiré de votre vitrine et de vos stories."}
        footer={<><Button variant="ghost" onClick={() => setConfirm(null)}>Annuler</Button><Button variant="danger" onClick={() => confirm && doDelete(confirm)}><Trash2 aria-hidden />Supprimer</Button></>}>
        <p className="text-sm text-muted">Cette action est irréversible.</p>
      </Dialog>

      <Dialog open={moveOpen} onOpenChange={setMoveOpen} title="Déplacer vers un album">
        <ul className="grid gap-2">
          {[{ id: "", title: "Aucun album" }, ...data.albums].map((a) => (
            <li key={a.id || "none"}>
              <button type="button" onClick={() => { selected.forEach((id) => updateMedia(id, { albumId: a.id || undefined })); toast.success(`${selected.length} média${selected.length > 1 ? "s" : ""} déplacé${selected.length > 1 ? "s" : ""}`); setSelected([]); setMoveOpen(false); }}
                className="flex h-12 w-full items-center rounded-xl border border-line px-4 text-left text-sm font-semibold hover:border-gold">{a.title}</button>
            </li>
          ))}
        </ul>
      </Dialog>
    </div>
  );
}
