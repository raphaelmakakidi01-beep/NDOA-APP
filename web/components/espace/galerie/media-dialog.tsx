"use client";

import { useState } from "react";
import { Crop, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/field";
import { dateFr } from "@/components/ui/bits";
import { useEspace } from "@/lib/espace/store";
import type { MediaItem } from "@/lib/espace/types";
import { formatBytes } from "@/lib/utils";
import { CropDialog } from "./crop-dialog";

export const fmtDuration = (s?: number) => (s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}` : "");

/** Détail d’un média : aperçu, texte alternatif, album, « à la une », recadrage, suppression */
export function MediaDialog({ item, onClose, onDelete }: { item: MediaItem | null; onClose: () => void; onDelete: (ids: string[]) => void }) {
  const { data, updateMedia, replacePhoto } = useEspace();
  const [alt, setAlt] = useState(item?.alt ?? "");
  const [albumId, setAlbumId] = useState(item?.albumId ?? "");
  const [cropOpen, setCropOpen] = useState(false);
  const live = item ? data.media.find((m) => m.id === item.id) ?? item : null;

  if (!live) return null;
  const featuredCount = data.media.filter((m) => m.featured).length;

  return (
    <>
      <Dialog open={!!item} onOpenChange={(o) => !o && onClose()} title={live.kind === "video" ? "Vidéo" : "Photo"} description={live.name} wide
        footer={<>
          <Button variant="danger" className="mr-auto" onClick={() => onDelete([live.id])}><Trash2 aria-hidden />Supprimer</Button>
          <Button variant="ghost" onClick={onClose}>Fermer</Button>
          <Button onClick={() => { updateMedia(live.id, { alt: alt.trim(), albumId: albumId || undefined }); toast.success("Modifications enregistrées"); onClose(); }}>Enregistrer</Button>
        </>}>
        <div className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
          <div className="relative overflow-hidden rounded-2xl bg-black">
            {live.kind === "video" && live.url ? (
              <video src={live.url} poster={live.posterUrl} controls playsInline className="max-h-[55dvh] w-full" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={live.kind === "video" ? live.posterUrl : live.url} alt={alt || "Aperçu"} className="max-h-[55dvh] w-full object-contain" />
            )}
            {live.kind === "video" && !live.url && <p className="absolute inset-x-0 bottom-0 bg-black/70 p-2 text-center text-xs text-white">Vidéo de démonstration : seule la vignette est disponible.</p>}
          </div>
          <div className="grid content-start gap-5">
            <Field id="m-alt" label="Description (texte alternatif)" counter={{ value: alt.length, max: 200 }} hint="Décrivez la scène pour les personnes malvoyantes et pour le référencement.">
              {({ id, describedBy }) => <Textarea id={id} rows={3} maxLength={220} value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="Ex. : Les mariés sous une arche de fleurs blanches à la Gombe" aria-describedby={describedBy} />}
            </Field>
            <Field id="m-album" label="Album">
              {({ id }) => (
                <Select id={id} value={albumId} onChange={(e) => setAlbumId(e.target.value)}>
                  <option value="">Aucun album</option>
                  {data.albums.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
                </Select>
              )}
            </Field>
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-line p-4 text-sm">
              <input type="checkbox" className="size-5 accent-[#C4975A]" checked={live.featured}
                onChange={(e) => {
                  if (e.target.checked && featuredCount >= 12) { toast.error("12 médias maximum « à la une ». Retirez-en un d’abord."); return; }
                  updateMedia(live.id, { featured: e.target.checked });
                }} />
              <span className="flex-1"><b className="flex items-center gap-1.5"><Star className="size-4 text-gold" aria-hidden />À la une</b><span className="text-muted">Affiché en premier sur votre vitrine ({featuredCount}/12).</span></span>
            </label>
            {live.kind === "photo" && <Button variant="outline" onClick={() => setCropOpen(true)}><Crop aria-hidden />Recadrer</Button>}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[13px]">
              {live.width ? <><dt className="text-muted">Dimensions</dt><dd>{live.width} × {live.height} px</dd></> : null}
              <dt className="text-muted">Poids</dt><dd>{formatBytes(live.size)}</dd>
              {live.duration ? <><dt className="text-muted">Durée</dt><dd>{fmtDuration(live.duration)}</dd></> : null}
              <dt className="text-muted">Ajouté le</dt><dd>{dateFr(live.createdAt, { day: "numeric", month: "long", year: "numeric" })}</dd>
            </dl>
          </div>
        </div>
      </Dialog>
      {live.kind === "photo" && cropOpen && (
        <CropDialog open={cropOpen} onOpenChange={setCropOpen} src={live.url} onDone={({ blob, width, height }) => replacePhoto(live.id, blob, width, height)} />
      )}
    </>
  );
}
