"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Archive, ArchiveRestore, Check, Clock, Lock, Play, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState } from "@/components/ui/bits";
import { useEspace } from "@/lib/espace/store";
import { PLANS, type Story } from "@/lib/espace/types";
import { cn } from "@/lib/utils";
import { goldConfetti } from "@/lib/confetti";

function remaining(iso?: string) {
  if (!iso) return "";
  const h = Math.max(0, Math.round((+new Date(iso) - Date.now()) / 3600_000));
  return h < 1 ? "expire dans moins d’1 h" : `expire dans ${h} h`;
}

/** Visionneuse façon stories : barres de progression, avance auto, clic pour passer */
function StoryViewer({ story, onClose }: { story: Story; onClose: () => void }) {
  const { data } = useEspace();
  const items = story.mediaIds.map((id) => data.media.find((m) => m.id === id)).filter(Boolean);
  const [i, setI] = useState(0);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setTimeout(() => (i < items.length - 1 ? setI(i + 1) : onClose()), story.durationSec * 1000);
    return () => clearTimeout(t);
  }, [i, items.length, story.durationSec, onClose]);
  const m = items[i];
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={story.title} description={`${i + 1} sur ${items.length}`}>
      <div className="relative mx-auto aspect-[9/16] max-h-[64dvh] overflow-hidden rounded-2xl bg-black">
        <div className="absolute inset-x-3 top-3 z-10 flex gap-1" aria-hidden>
          {items.map((_, k) => (
            <span key={k} className="h-0.5 flex-1 overflow-hidden rounded bg-white/30">
              <span className={cn("block h-full bg-white", k < i && "w-full", k > i && "w-0")} style={k === i ? { animation: `storyBar ${story.durationSec}s linear forwards` } : undefined} />
            </span>
          ))}
        </div>
        {m && (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={m.id} src={m.kind === "video" ? m.posterUrl : m.url} alt={m.alt || ""} className="size-full object-cover" />
        )}
        <button type="button" className="absolute inset-y-0 left-0 w-1/3" aria-label="Précédent" onClick={() => setI(Math.max(0, i - 1))} />
        <button type="button" className="absolute inset-y-0 right-0 w-2/3" aria-label="Suivant" onClick={() => (i < items.length - 1 ? setI(i + 1) : onClose())} />
      </div>
      <style>{"@keyframes storyBar{from{width:0}to{width:100%}}"}</style>
    </Dialog>
  );
}

export function StoriesTab({ openCreate }: { openCreate?: boolean }) {
  const { data, saveStory, deleteStory } = useEspace();
  const allowed = PLANS[data.plan].stories;
  const [creating, setCreating] = useState(!!openCreate && allowed);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<Story["kind"]>("highlight");
  const [duration, setDuration] = useState(5);
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [viewing, setViewing] = useState<Story | null>(null);
  const [now] = useState(() => Date.now()); // horloge figée au montage (rendu pur)
  const ready = data.media.filter((m) => m.status === "ready");
  // une story de 24 h expirée bascule d’elle-même dans les archives
  const isOff = (s: Story) => s.archived || (s.kind === "story" && !!s.expiresAt && +new Date(s.expiresAt) < now);
  const active = data.stories.filter((s) => !isOff(s)), archived = data.stories.filter(isOff);

  function reset() { setTitle(""); setKind("highlight"); setDuration(5); setPicked([]); setError(""); }
  function publish() {
    if (title.trim().length < 2) { setError("Donnez un titre court à la story."); return; }
    if (!picked.length) { setError("Choisissez au moins une photo ou vidéo."); return; }
    const first = data.stories.length === 0;
    saveStory({ title: title.trim(), mediaIds: picked, durationSec: duration, kind, archived: false, expiresAt: kind === "story" ? new Date(Date.now() + 24 * 3600_000).toISOString() : undefined });
    setCreating(false); reset();
    toast.success(kind === "story" ? "Story publiée pour 24 h" : "Story ajoutée à la une de votre vitrine");
    if (first) goldConfetti();
  }

  if (!allowed) {
    return (
      <EmptyState icon={<Lock />} title="Stories disponibles avec l’offre Pro" action={<Button asChild><Link href="/espace/abonnement">Voir les offres</Link></Button>}>
        Montrez vos coulisses et vos derniers mariages en stories, comme sur Instagram.
      </EmptyState>
    );
  }

  const row = (s: Story) => {
    const cover = data.media.find((m) => m.id === s.mediaIds[0]);
    return (
      <li key={s.id} className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-3 pr-2">
        <button type="button" onClick={() => setViewing(s)} aria-label={`Voir la story ${s.title}`}
          className={cn("size-16 shrink-0 rounded-full p-[3px]", isOff(s) ? "bg-line-strong" : "bg-[conic-gradient(from_210deg,#C4975A,#E8A2B4,#E6C694,#6B1E2E,#C4975A)]")}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {cover && <img src={cover.kind === "video" ? cover.posterUrl : cover.url} alt="" className="size-full rounded-full border-[3px] border-surface object-cover" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{s.title}</p>
          <p className="flex flex-wrap items-center gap-x-2 text-[13px] text-muted">
            {s.kind === "story" ? <span className="inline-flex items-center gap-1"><Clock className="size-3.5" aria-hidden />{isOff(s) ? (s.archived ? "Archivée" : "Expirée") : remaining(s.expiresAt)}</span> : <span>À la une, permanente</span>}
            <span>· {s.mediaIds.length} média{s.mediaIds.length > 1 ? "s" : ""} · {s.durationSec} s chacun</span>
          </p>
        </div>
        <button type="button" onClick={() => setViewing(s)} className="grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-text" aria-label={`Aperçu de ${s.title}`}><Play className="size-4" aria-hidden /></button>
        <button type="button" onClick={() => { const restore = isOff(s); saveStory({ ...s, archived: !restore, ...(restore && s.kind === "story" ? { expiresAt: new Date(Date.now() + 24 * 3600_000).toISOString() } : {}) }); toast.success(restore ? "Story republiée" : "Story archivée"); }} className="grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-text"
          aria-label={isOff(s) ? `Restaurer ${s.title}` : `Archiver ${s.title}`}>{isOff(s) ? <ArchiveRestore className="size-4" aria-hidden /> : <Archive className="size-4" aria-hidden />}</button>
        <button type="button" onClick={() => { deleteStory(s.id); toast.success("Story supprimée"); }} className="grid size-10 place-items-center rounded-full text-muted hover:bg-danger/10 hover:text-danger" aria-label={`Supprimer ${s.title}`}><Trash2 className="size-4" aria-hidden /></button>
      </li>
    );
  };

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Les stories « à la une » restent sur votre vitrine ; les stories classiques disparaissent après 24 h.</p>
        <Button onClick={() => { reset(); setCreating(true); }} disabled={!ready.length}><Plus aria-hidden />Nouvelle story</Button>
      </div>

      <section aria-labelledby="st-active">
        <h2 id="st-active" className="mb-3 text-xs font-bold uppercase tracking-[.16em] text-muted">Publiées ({active.length})</h2>
        {active.length ? <ul className="grid gap-2 lg:grid-cols-2">{active.map(row)}</ul> : (
          <EmptyState icon={<Play />} title="Aucune story publiée" action={ready.length ? <Button onClick={() => setCreating(true)}>Publier ma première story</Button> : undefined}>
            Une story par mariage ou par semaine garde votre vitrine vivante (+5 % au score).
          </EmptyState>
        )}
      </section>
      {archived.length > 0 && (
        <section aria-labelledby="st-archived">
          <h2 id="st-archived" className="mb-3 text-xs font-bold uppercase tracking-[.16em] text-muted">Archivées ({archived.length})</h2>
          <ul className="grid gap-2 lg:grid-cols-2">{archived.map(row)}</ul>
        </section>
      )}

      <Dialog open={creating} onOpenChange={setCreating} title="Nouvelle story" wide
        footer={<><Button variant="ghost" onClick={() => setCreating(false)}>Annuler</Button><Button onClick={publish}>Publier{picked.length ? ` (${picked.length})` : ""}</Button></>}>
        <div className="grid grid-cols-1 gap-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="st-title" label="Titre" counter={{ value: title.length, max: 24 }} error={error && title.trim().length < 2 ? error : undefined}>
              {({ id, describedBy, invalid }) => <Input id={id} maxLength={24} value={title} onChange={(e) => { setTitle(e.target.value); setError(""); }} placeholder="Coulisses" aria-describedby={describedBy} aria-invalid={invalid || undefined} />}
            </Field>
            <div className="grid content-start gap-2">
              <span className="text-sm font-semibold">Type</span>
              <Segmented label="Type de story" layoutId="story-kind" value={kind} onChange={setKind} options={[{ value: "highlight", label: "À la une" }, { value: "story", label: "24 heures" }]} />
            </div>
          </div>
          <label className="grid gap-2 text-sm font-semibold">
            <span className="flex justify-between">Durée par image <span className="tabular-nums text-gold-ink">{duration} s</span></span>
            <input type="range" min={3} max={10} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="accent-[#C4975A]" />
          </label>
          <fieldset>
            <legend className="mb-3 text-sm font-semibold">Images, dans l’ordre de lecture</legend>
            <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {ready.map((m) => {
                const idx = picked.indexOf(m.id);
                return (
                  <li key={m.id}>
                    <button type="button" aria-pressed={idx >= 0} onClick={() => { setPicked((p) => (idx >= 0 ? p.filter((x) => x !== m.id) : [...p, m.id])); setError(""); }}
                      className={cn("relative block aspect-[9/16] w-full overflow-hidden rounded-xl ring-2 ring-offset-2 ring-offset-surface", idx >= 0 ? "ring-gold" : "ring-transparent hover:ring-gold/50")}
                      aria-label={`${idx >= 0 ? `Image ${idx + 1}, retirer` : "Ajouter"} : ${m.name}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={m.kind === "video" ? m.posterUrl : m.url} alt="" className="size-full object-cover" loading="lazy" />
                      {idx >= 0 && <span className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-gold text-xs font-bold text-on-gold">{idx + 1}</span>}
                      {idx < 0 && <span className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full border-2 border-white/80 bg-black/30"><Check className="size-3 text-transparent" aria-hidden /></span>}
                    </button>
                  </li>
                );
              })}
            </ul>
            {error && picked.length === 0 && title.trim().length >= 2 && <p role="alert" className="mt-2 text-[13px] font-medium text-danger">{error}</p>}
          </fieldset>
        </div>
      </Dialog>

      {viewing && <StoryViewer story={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
