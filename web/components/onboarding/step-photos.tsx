"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, ArrowLeft, ArrowRight, ImagePlus, Images, Sparkles, Star, Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/lib/onboarding/store";
import { MIN_PHOTOS, type MediaRef } from "@/lib/onboarding/types";
import { DEMO } from "@/lib/config";
import { PHOTO_ACCEPT } from "@/lib/media";
import { cn, formatBytes } from "@/lib/utils";
import { StepFooter, StepHeader } from "./step-ui";

const ACCEPT = PHOTO_ACCEPT;

function DropZone({ onFiles, multiple, className, children, label }: { onFiles: (f: FileList) => void; multiple?: boolean; className?: string; children: React.ReactNode; label: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      role="button" tabIndex={0} aria-label={label}
      onClick={() => input.current?.click()}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.current?.click(); } }}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files); }}
      className={cn("relative cursor-pointer overflow-hidden rounded-3xl border-2 border-dashed transition-colors", over ? "border-gold bg-gold/10" : "border-line-strong hover:border-gold/70", className)}>
      {children}
      <input ref={input} type="file" accept={ACCEPT} multiple={multiple} className="sr-only" tabIndex={-1}
        onChange={(e) => { if (e.target.files?.length) onFiles(e.target.files); e.target.value = ""; }} />
    </div>
  );
}

function Thumb({ m, index, total, isCover }: { m: MediaRef; index: number; total: number; isCover: boolean }) {
  const { removePhoto, setCover, movePhoto } = useOnboarding();
  return (
    <motion.li layout initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={cn("group relative aspect-square overflow-hidden rounded-2xl bg-surface-2 ring-1", m.status === "error" ? "ring-danger" : isCover ? "ring-2 ring-gold" : "ring-line")}>
      {m.url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={m.url} alt={`Réalisation ${index + 1}`} className={cn("size-full object-cover", m.status === "uploading" && "opacity-60 blur-[1px]")} />
      )}
      {m.status === "uploading" && (
        <div className="absolute inset-x-3 bottom-3" role="progressbar" aria-valuenow={m.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Envoi de ${m.name}`}>
          <div className="mb-1 flex justify-between text-[11px] font-semibold text-white drop-shadow"><span className="truncate pr-2">{m.name}</span><span>{m.progress} %</span></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/30"><div className="h-full rounded-full bg-gold transition-[width] duration-200" style={{ width: `${m.progress}%` }} /></div>
        </div>
      )}
      {m.status === "error" && (
        <div className="absolute inset-0 grid place-items-center bg-black/70 p-3 text-center text-xs font-medium text-white">
          <span><AlertCircle className="mx-auto mb-1 size-5 text-rose" aria-hidden />{m.error ?? "Échec de l’envoi"}</span>
        </div>
      )}
      {isCover && m.status === "ready" && (
        <span className="absolute left-1.5 top-1.5 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold">Couverture</span>
      )}
      {m.status !== "uploading" && (
        <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-gradient-to-t from-black/80 to-transparent p-1.5 pt-6 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
          <div className="flex gap-1">
            <IconBtn label="Déplacer vers la gauche" disabled={index === 0} onClick={() => movePhoto(m.id, -1)}><ArrowLeft /></IconBtn>
            <IconBtn label="Déplacer vers la droite" disabled={index === total - 1} onClick={() => movePhoto(m.id, 1)}><ArrowRight /></IconBtn>
          </div>
          <div className="flex gap-1">
            {m.status === "ready" && !isCover && <IconBtn label="Utiliser comme couverture" onClick={() => setCover(m.id)}><Star /></IconBtn>}
            <IconBtn label="Supprimer la photo" onClick={() => removePhoto(m.id)}><Trash2 /></IconBtn>
          </div>
        </div>
      )}
    </motion.li>
  );
}

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label}
      className="grid size-7 place-items-center rounded-full bg-black/55 text-white backdrop-blur transition-colors hover:bg-gold hover:text-black disabled:opacity-30 [&_svg]:size-3.5">
      {children}
    </button>
  );
}

export function StepPhotos() {
  const { draft, addPhotos, addDemoPhotos, errors } = useOnboarding();
  const ready = draft.photos.filter((p) => p.status === "ready").length;
  const uploading = draft.photos.filter((p) => p.status === "uploading").length;
  const totalSize = draft.photos.reduce((s, p) => s + (p.status === "ready" ? p.size : 0), 0);
  const cover = draft.cover;

  return (
    <div className="mx-auto max-w-3xl">
      <StepHeader title={<>Vos plus belles <em className="text-gold-ink">images</em></>}
        lead={`Une couverture, puis au moins ${MIN_PHOTOS} réalisations en pleine qualité.`} />

      {DEMO && (
        <Button variant="ghost" size="sm" className="-mt-3 mb-5 px-0 text-gold-ink hover:bg-transparent" onClick={addDemoPhotos}><Sparkles aria-hidden />Ajouter 8 photos de démonstration</Button>
      )}

      {/* Couverture */}
      <section aria-labelledby="cover-title" className="mb-8">
        <h2 id="cover-title" className="mb-3 text-sm font-semibold">Photo de couverture</h2>
        <DropZone label={cover ? "Changer la photo de couverture" : "Ajouter une photo de couverture"} onFiles={(f) => void addPhotos(f, "cover")}
          className={cn("h-36 w-full sm:h-auto sm:aspect-[16/5]", errors.cover && "border-danger")}>
          {cover?.url ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cover.url} alt="Photo de couverture" className={cn("absolute inset-0 size-full object-cover", cover.status === "uploading" && "opacity-60")} />
              <span className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <span className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-sm font-semibold text-white backdrop-blur">
                <ImagePlus className="size-4" aria-hidden />{cover.status === "uploading" ? `Envoi… ${cover.progress} %` : "Changer la couverture"}
              </span>
            </>
          ) : (
            <span className="absolute inset-0 grid place-items-center p-6 text-center">
              <span>
                <ImagePlus className="mx-auto mb-2 size-6 text-gold" aria-hidden />
                <span className="block text-sm font-semibold">Glissez votre couverture ici</span>
                <span className="mt-0.5 block text-[13px] text-muted">ou cliquez · format paysage</span>
              </span>
            </span>
          )}
        </DropZone>
        {errors.cover && <p role="alert" className="mt-2 text-sm font-medium text-danger">{errors.cover}</p>}
      </section>

      {/* Réalisations */}
      <section aria-labelledby="gal-title">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <h2 id="gal-title" className="text-sm font-semibold">Vos réalisations</h2>
          <p className="text-sm" aria-live="polite">
            <b className={cn("tabular-nums", ready >= MIN_PHOTOS ? "text-success" : "text-gold-ink")}>{ready}</b>
            <span className="text-muted"> / {MIN_PHOTOS} minimum{uploading ? ` · ${uploading} en cours` : ""}{totalSize ? ` · ${formatBytes(totalSize)}` : ""}</span>
          </p>
        </div>
        <div className="mb-4 h-1 overflow-hidden rounded-full bg-line" aria-hidden>
          <motion.div className={cn("h-full rounded-full", ready >= MIN_PHOTOS ? "bg-success" : "bg-gold")} initial={false} animate={{ width: `${Math.min(100, (ready / MIN_PHOTOS) * 100)}%` }} />
        </div>

        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
          <li>
            <DropZone multiple label="Ajouter des photos" onFiles={(f) => void addPhotos(f)} className={cn("grid aspect-square place-items-center p-3 text-center", errors.photos && "border-danger")}>
              <span>
                <UploadCloud className="mx-auto mb-1.5 size-6 text-gold" aria-hidden />
                <span className="block text-[13px] font-semibold">Ajouter</span>
              </span>
            </DropZone>
          </li>
          <AnimatePresence initial={false}>
            {draft.photos.map((m, i) => <Thumb key={m.id} m={m} index={i} total={draft.photos.length} isCover={cover?.id === m.id} />)}
          </AnimatePresence>
        </ul>
        {errors.photos && <p role="alert" className="mt-3 text-sm font-medium text-danger">{errors.photos}</p>}

        {draft.photos.length === 0 && (
          <p className="mt-4 flex items-start gap-2 text-[13px] text-muted">
            <Images className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
            Variez les moments : préparatifs, cérémonie, portraits, soirée. Les 6 premières passent « à la une ».
          </p>
        )}
      </section>
      <StepFooter step="photos" disabled={uploading > 0} />
    </div>
  );
}
