"use client";

import { useState } from "react";
import { FolderPlus, Heart, Images, Pencil, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState, dateFr } from "@/components/ui/bits";
import { useEspace } from "@/lib/espace/store";
import type { Album } from "@/lib/espace/types";

type Draft = { id?: string; title: string; kind: Album["kind"]; date: string };

export function AlbumsTab({ onOpenAlbum }: { onOpenAlbum: (id: string) => void }) {
  const { data, saveAlbum, deleteAlbum } = useEspace();
  const [edit, setEdit] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<Album | null>(null);

  const cover = (a: Album) => {
    const m = data.media.find((x) => x.id === a.coverId) ?? data.media.find((x) => x.albumId === a.id && x.status === "ready");
    return m ? (m.kind === "video" ? m.posterUrl : m.url) : undefined;
  };

  function submit() {
    if (!edit) return;
    if (edit.title.trim().length < 2) { setError("Donnez un nom à l’album (2 caractères minimum)."); return; }
    saveAlbum({ id: edit.id, title: edit.title.trim(), kind: edit.kind, date: edit.kind === "wedding" && edit.date ? edit.date : undefined, coverId: edit.id ? data.albums.find((a) => a.id === edit.id)?.coverId : undefined });
    toast.success(edit.id ? "Album renommé" : "Album créé");
    setEdit(null);
  }

  return (
    <div className="grid grid-cols-1 gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Regroupez vos réalisations par mariage ou par thème : les mariés les parcourent comme des reportages.</p>
        <Button onClick={() => { setError(""); setEdit({ title: "", kind: "wedding", date: "" }); }}><FolderPlus aria-hidden />Nouvel album</Button>
      </div>

      {data.albums.length ? (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.albums.map((a) => {
            const count = data.media.filter((m) => m.albumId === a.id).length;
            const src = cover(a);
            return (
              <li key={a.id} className="group overflow-hidden rounded-3xl border border-line bg-surface">
                <button type="button" onClick={() => onOpenAlbum(a.id)} className="relative block aspect-[4/3] w-full overflow-hidden bg-surface-2" aria-label={`Ouvrir l’album ${a.title}`}>
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt="" className="size-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" />
                  ) : <span className="grid size-full place-items-center text-muted"><Images className="size-8" aria-hidden /></span>}
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-md bg-black/65 px-2 py-1 text-xs font-semibold text-white">
                    {a.kind === "wedding" ? <Heart className="size-3.5" aria-hidden /> : <Sparkles className="size-3.5" aria-hidden />}{a.kind === "wedding" ? "Mariage" : "Thème"}
                  </span>
                </button>
                <div className="flex items-center gap-2 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-display truncate text-xl">{a.title}</p>
                    <p className="text-[13px] text-muted">{count} média{count > 1 ? "s" : ""}{a.date ? ` · ${dateFr(a.date, { month: "long", year: "numeric" })}` : ""}</p>
                  </div>
                  <button type="button" onClick={() => { setError(""); setEdit({ id: a.id, title: a.title, kind: a.kind, date: a.date ?? "" }); }} className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-text" aria-label={`Modifier l’album ${a.title}`}><Pencil className="size-4" aria-hidden /></button>
                  <button type="button" onClick={() => setConfirm(a)} className="grid size-9 place-items-center rounded-full text-muted hover:bg-danger/10 hover:text-danger" aria-label={`Supprimer l’album ${a.title}`}><Trash2 className="size-4" aria-hidden /></button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={<FolderPlus />} title="Aucun album" action={<Button onClick={() => setEdit({ title: "", kind: "wedding", date: "" })}>Créer mon premier album</Button>}>
          Un album par mariage (« Grâce & Patrick ») ou par thème (« Décors », « Soirées ») rend votre portfolio plus lisible.
        </EmptyState>
      )}

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)} title={edit?.id ? "Modifier l’album" : "Nouvel album"}
        footer={<><Button variant="ghost" onClick={() => setEdit(null)}>Annuler</Button><Button onClick={submit}>{edit?.id ? "Enregistrer" : "Créer l’album"}</Button></>}>
        {edit && (
          <form className="grid grid-cols-1 gap-5" onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <div className="grid gap-2">
              <span className="text-sm font-semibold">Type</span>
              <Segmented label="Type d’album" layoutId="album-kind" value={edit.kind} onChange={(kind) => setEdit({ ...edit, kind })} options={[{ value: "wedding", label: "Mariage" }, { value: "theme", label: "Thème" }]} />
            </div>
            <Field id="al-title" label={edit.kind === "wedding" ? "Prénoms des mariés" : "Nom du thème"} error={error}>
              {({ id, describedBy, invalid }) => <Input id={id} autoFocus maxLength={80} value={edit.title} onChange={(e) => { setEdit({ ...edit, title: e.target.value }); setError(""); }} placeholder={edit.kind === "wedding" ? "Grâce & Patrick" : "Décors & détails"} aria-describedby={describedBy} aria-invalid={invalid || undefined} />}
            </Field>
            {edit.kind === "wedding" && (
              <Field id="al-date" label="Date du mariage" optional>
                {({ id }) => <Input id={id} type="date" value={edit.date} onChange={(e) => setEdit({ ...edit, date: e.target.value })} />}
              </Field>
            )}
          </form>
        )}
      </Dialog>

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)} title="Supprimer cet album ?" description="Les photos et vidéos restent dans votre galerie, sans album."
        footer={<><Button variant="ghost" onClick={() => setConfirm(null)}>Annuler</Button><Button variant="danger" onClick={() => { if (confirm) { deleteAlbum(confirm.id); toast.success("Album supprimé"); } setConfirm(null); }}><Trash2 aria-hidden />Supprimer l’album</Button></>}>
        <p className="text-sm">« {confirm?.title} »</p>
      </Dialog>
    </div>
  );
}
