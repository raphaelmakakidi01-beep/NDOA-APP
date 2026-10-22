"use client";

import * as React from "react";
import {
  AlertTriangle, Brush, Building2, Cake, Camera, Car, Church, ClipboardList, Flower2, Gem, Heart, MapPin, Mic, Music, Pencil, Plane, Plus,
  RefreshCw, Shirt, Sparkles, Tent, Trash2, Upload, UtensilsCrossed, Video, X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, StatusTag } from "@/components/ui/bits";
import { deleteCategory, deleteCity, listCategories, listCities, reorder, saveCategory, saveCity, uploadSiteImage } from "@/lib/admin/content";
import { CATEGORY_ICONS, type AdminCategory, type AdminCity } from "@/lib/admin/content-types";
import { revalidatePublic } from "@/lib/admin/manage";
import { checkPhoto } from "@/lib/media";
import { cn, slugify } from "@/lib/utils";
import { DragHandle, SortableList } from "./sortable";
import { dateInputClass } from "./pickers";
import { ConfirmDialog, PageHeader, Panel } from "./ui";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  camera: Camera, video: Video, plane: Plane, drone: Plane, building: Building2, sparkles: Sparkles, flower: Flower2, utensils: UtensilsCrossed,
  music: Music, brush: Brush, car: Car, clipboard: ClipboardList, gem: Gem, cake: Cake, shirt: Shirt, mic: Mic, heart: Heart, church: Church, tent: Tent,
};
export const CategoryIcon = ({ name, className }: { name: string; className?: string }) => { const I = ICON_MAP[name] ?? Sparkles; return <I className={className} />; };

export function Catalog() {
  const [cats, setCats] = React.useState<AdminCategory[] | null>(null);
  const [cities, setCities] = React.useState<AdminCity[] | null>(null);
  const [error, setError] = React.useState("");
  const [editCat, setEditCat] = React.useState<AdminCategory | "new" | null>(null);
  const [editCity, setEditCity] = React.useState<AdminCity | "new" | null>(null);
  const [del, setDel] = React.useState<{ kind: "cat"; item: AdminCategory } | { kind: "city"; item: AdminCity } | null>(null);

  const load = React.useCallback(() => {
    Promise.all([listCategories(), listCities()]).then(([c, v]) => { setCats(c); setCities(v); setError(""); }).catch((e: Error) => setError(e.message));
  }, []);
  React.useEffect(load, [load]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); toast.success(ok); void revalidatePublic(["accueil", "prestataires"]); load(); return true; } catch (e) { toast.error((e as Error).message); load(); return false; }
  };
  const saveOrder = async (kind: "categories" | "cities", ids: number[]) => {
    try { await reorder(kind, ids); toast.success("Ordre enregistré"); void revalidatePublic(["accueil", "prestataires"]); } catch (e) { toast.error((e as Error).message); load(); }
  };

  if (error) return (
    <>
      <PageHeader title="Catégories et villes" />
      <EmptyState icon={<AlertTriangle />} title="Chargement impossible" action={<Button variant="outline" size="sm" onClick={load}><RefreshCw aria-hidden />Réessayer</Button>}>{error}</EmptyState>
    </>
  );

  return (
    <>
      <PageHeader title="Catégories et villes" sub="L’ordre choisi ici est celui des filtres et des rubriques du site. Glissez-déposez pour réordonner." />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel title={`Catégories (${cats?.length ?? "…"})`} id="c-cats" action={<Button size="sm" onClick={() => setEditCat("new")}><Plus aria-hidden />Ajouter</Button>}>
          {!cats ? <Rows /> : (
            <SortableList items={cats} getId={(c) => String(c.id)} label={(c) => c.name} className="divide-y divide-line"
              onReorder={(next) => { setCats(next); void saveOrder("categories", next.map((c) => c.id)); }}>
              {(c, handle, dragging) => (
                <div className={cn("flex items-center gap-3 bg-surface px-3 py-2", dragging && "rounded-lg shadow-2xl ring-1 ring-gold/50", !c.isActive && "opacity-60")}>
                  <DragHandle handle={handle} />
                  <span className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-2 text-gold-ink">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {c.imageUrl ? <img src={c.imageUrl} alt="" className="size-full object-cover" loading="lazy" /> : <CategoryIcon name={c.icon} className="size-5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm font-semibold"><CategoryIcon name={c.icon} className="size-3.5 shrink-0 text-gold-ink" />{c.name}</p>
                    <p className="truncate text-[12px] text-muted">/{c.slug} · {c.vendors} prestataire{c.vendors > 1 ? "s" : ""}</p>
                  </div>
                  {!c.isActive && <StatusTag tone="muted">Masquée</StatusTag>}
                  <Button variant="ghost" size="icon" className="size-9" aria-label={`Modifier ${c.name}`} onClick={() => setEditCat(c)}><Pencil aria-hidden /></Button>
                  <Button variant="ghost" size="icon" className="size-9 text-danger" aria-label={`Supprimer ${c.name}`} onClick={() => setDel({ kind: "cat", item: c })}><Trash2 aria-hidden /></Button>
                </div>
              )}
            </SortableList>
          )}
        </Panel>

        <Panel title={`Villes (${cities?.length ?? "…"})`} id="c-cities" action={<Button size="sm" onClick={() => setEditCity("new")}><Plus aria-hidden />Ajouter</Button>}>
          {!cities ? <Rows /> : (
            <SortableList items={cities} getId={(c) => String(c.id)} label={(c) => c.name} className="divide-y divide-line"
              onReorder={(next) => { setCities(next); void saveOrder("cities", next.map((c) => c.id)); }}>
              {(c, handle, dragging) => (
                <div className={cn("flex items-center gap-3 bg-surface px-3 py-2", dragging && "rounded-lg shadow-2xl ring-1 ring-gold/50", !c.isActive && "opacity-60")}>
                  <DragHandle handle={handle} />
                  <MapPin className="size-4 shrink-0 text-gold-ink" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{c.name}</p>
                    <p className="truncate text-[12px] text-muted">{c.province || "Province non renseignée"} · {c.vendors} prestataire{c.vendors > 1 ? "s" : ""}</p>
                  </div>
                  {!c.isActive && <StatusTag tone="muted">Masquée</StatusTag>}
                  <Button variant="ghost" size="icon" className="size-9" aria-label={`Modifier ${c.name}`} onClick={() => setEditCity(c)}><Pencil aria-hidden /></Button>
                  <Button variant="ghost" size="icon" className="size-9 text-danger" aria-label={`Supprimer ${c.name}`} onClick={() => setDel({ kind: "city", item: c })}><Trash2 aria-hidden /></Button>
                </div>
              )}
            </SortableList>
          )}
        </Panel>
      </div>

      <CategoryDialog cat={editCat} taken={cats?.map((c) => c.slug) ?? []} onClose={() => setEditCat(null)}
        onSave={async (c) => { if (await run(() => saveCategory(c), c.id ? "Catégorie modifiée" : "Catégorie ajoutée")) setEditCat(null); }} />
      <CityDialog city={editCity} onClose={() => setEditCity(null)}
        onSave={async (c) => { if (await run(() => saveCity(c), c.id ? "Ville modifiée" : "Ville ajoutée")) setEditCity(null); }} />
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title={`Supprimer « ${del?.item.name ?? ""} » ?`} confirmLabel="Supprimer"
        onConfirm={async () => { if (!del) return; await run(() => (del.kind === "cat" ? deleteCategory(del.item.id) : deleteCity(del.item)), "Supprimé"); setDel(null); }}>
        {del && del.item.vendors > 0
          ? <p className="text-danger">{del.item.vendors} prestataire{del.item.vendors > 1 ? "s" : ""} {del.kind === "cat" ? "utilisent cette catégorie" : "sont situés dans cette ville"} : la suppression sera refusée. Masquez-la plutôt (modifier → décocher « Visible »).</p>
          : <p>Elle disparaîtra des filtres du site. Cette action est journalisée.</p>}
      </ConfirmDialog>
    </>
  );
}

function Rows() {
  return <div className="grid gap-2 p-3" aria-busy="true">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-12 rounded-lg" />)}</div>;
}

type CatDraft = { id?: number; slug: string; name: string; namePlural: string; icon: string; imagePath?: string; imageUrl?: string; isActive: boolean };

function CategoryDialog({ cat, taken, onClose, onSave }: { cat: AdminCategory | "new" | null; taken: string[]; onClose: () => void; onSave: (c: CatDraft) => Promise<void> }) {
  if (!cat) return null;
  return <CategoryDialogOpen key={cat === "new" ? "new" : cat.id} cat={cat === "new" ? null : cat} taken={taken} onClose={onClose} onSave={onSave} />;
}
function CategoryDialogOpen({ cat, taken, onClose, onSave }: { cat: AdminCategory | null; taken: string[]; onClose: () => void; onSave: (c: CatDraft) => Promise<void> }) {
  const [d, setD] = React.useState<CatDraft>(cat ? { id: cat.id, slug: cat.slug, name: cat.name, namePlural: cat.namePlural, icon: cat.icon, imagePath: cat.imagePath, imageUrl: cat.imageUrl, isActive: cat.isActive }
    : { slug: "", name: "", namePlural: "", icon: "sparkles", isActive: true });
  const [slugTouched, setSlugTouched] = React.useState(!!cat);
  const [busy, setBusy] = React.useState<"" | "upload" | "save">("");
  const fileRef = React.useRef<HTMLInputElement>(null);
  const slugTaken = !cat && taken.includes(d.slug);
  const valid = d.name.trim().length >= 2 && d.namePlural.trim().length >= 2 && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(d.slug) && !slugTaken;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={cat ? `Modifier « ${cat.name} »` : "Nouvelle catégorie"} wide className="admin-ui"
      footer={<>
        <Button variant="ghost" size="sm" onClick={onClose}>Annuler</Button>
        <Button size="sm" loading={busy === "save"} disabled={!valid || busy === "upload"} onClick={async () => { setBusy("save"); try { await onSave({ ...d, name: d.name.trim(), namePlural: d.namePlural.trim() }); } finally { setBusy(""); } }}>Enregistrer</Button>
      </>}>
      <div className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-semibold">Nom (singulier)
            <input value={d.name} maxLength={40} className={dateInputClass} placeholder="Photographe"
              onChange={(e) => setD((x) => ({ ...x, name: e.target.value, slug: slugTouched ? x.slug : slugify(e.target.value), namePlural: x.namePlural && x.namePlural !== `${x.name}s` ? x.namePlural : e.target.value ? `${e.target.value}s` : "" }))} />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold">Nom (pluriel)
            <input value={d.namePlural} maxLength={40} className={dateInputClass} placeholder="Photographes" onChange={(e) => setD((x) => ({ ...x, namePlural: e.target.value }))} />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold sm:col-span-2">Adresse (slug)
            <span className="flex items-center gap-2"><span className="text-[13px] font-normal text-muted">/?categorie=</span>
              <input value={d.slug} disabled={!!cat} className={cn(dateInputClass, "font-mono")} aria-invalid={slugTaken || undefined}
                onChange={(e) => { setSlugTouched(true); setD((x) => ({ ...x, slug: slugify(e.target.value) })); }} />
            </span>
            <span className={cn("text-[12px] font-normal", slugTaken ? "text-danger" : "text-muted")}>{slugTaken ? "Ce slug existe déjà." : cat ? "Non modifiable : les liens existants en dépendent." : "Lettres minuscules, chiffres et tirets."}</span>
          </label>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Icône</legend>
          <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-9" role="radiogroup" aria-label="Icône">
            {CATEGORY_ICONS.map((name) => (
              <button key={name} type="button" role="radio" aria-checked={d.icon === name} aria-label={name} onClick={() => setD((x) => ({ ...x, icon: name }))}
                className={cn("grid aspect-square place-items-center rounded-lg border", d.icon === name ? "border-gold bg-gold/12 text-gold-ink" : "border-line text-muted hover:border-line-strong hover:text-text")}>
                <CategoryIcon name={name} className="size-5" />
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-semibold">Image (rubrique de l’accueil)</legend>
          <div className="flex items-center gap-3">
            <span className="relative grid aspect-[4/3] w-36 shrink-0 place-items-center overflow-hidden rounded-xl bg-surface-2 text-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {d.imageUrl ? <img src={d.imageUrl} alt="" className="size-full object-cover" /> : <CategoryIcon name={d.icon} className="size-7" />}
            </span>
            <div className="grid gap-2">
              <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1}
                onChange={async (e) => {
                  const f = e.target.files?.[0]; e.target.value = "";
                  if (!f) return;
                  const err = checkPhoto(f); if (err) { toast.error(err); return; }
                  setBusy("upload");
                  try { const r = await uploadSiteImage(f, "categories"); setD((x) => ({ ...x, imagePath: r.path, imageUrl: r.url })); }
                  catch (er) { toast.error((er as Error).message); } finally { setBusy(""); }
                }} />
              <Button size="sm" variant="outline" loading={busy === "upload"} onClick={() => fileRef.current?.click()}><Upload aria-hidden />{d.imageUrl ? "Remplacer" : "Envoyer une image"}</Button>
              {d.imageUrl && <Button size="sm" variant="ghost" onClick={() => setD((x) => ({ ...x, imagePath: undefined, imageUrl: undefined }))}><X aria-hidden />Retirer</Button>}
            </div>
          </div>
        </fieldset>

        <label className="inline-flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={d.isActive} onChange={(e) => setD((x) => ({ ...x, isActive: e.target.checked }))} className="size-4 accent-[var(--gold)]" />
          Visible sur le site et dans l’inscription
        </label>
      </div>
    </Dialog>
  );
}

function CityDialog({ city, onClose, onSave }: { city: AdminCity | "new" | null; onClose: () => void; onSave: (c: { id?: number; name: string; slug: string; province: string; isActive: boolean }) => Promise<void> }) {
  if (!city) return null;
  return <CityDialogOpen key={city === "new" ? "new" : city.id} city={city === "new" ? null : city} onClose={onClose} onSave={onSave} />;
}
function CityDialogOpen({ city, onClose, onSave }: { city: AdminCity | null; onClose: () => void; onSave: (c: { id?: number; name: string; slug: string; province: string; isActive: boolean }) => Promise<void> }) {
  const [name, setName] = React.useState(city?.name ?? "");
  const [province, setProvince] = React.useState(city?.province ?? "");
  const [active, setActive] = React.useState(city?.isActive ?? true);
  const [busy, setBusy] = React.useState(false);
  const renamed = !!city && city.vendors > 0 && name.trim() !== city.name;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={city ? `Modifier « ${city.name} »` : "Nouvelle ville"} className="admin-ui"
      footer={<>
        <Button variant="ghost" size="sm" onClick={onClose}>Annuler</Button>
        <Button size="sm" loading={busy} disabled={name.trim().length < 2} onClick={async () => { setBusy(true); try { await onSave({ id: city?.id, name: name.trim(), slug: city?.slug ?? slugify(name), province: province.trim(), isActive: active }); } finally { setBusy(false); } }}>Enregistrer</Button>
      </>}>
      <div className="grid gap-3">
        <label className="grid gap-1.5 text-sm font-semibold">Ville<input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className={dateInputClass} placeholder="Kinshasa" /></label>
        {renamed && <p className="text-[13px] text-danger">{city!.vendors} prestataire{city!.vendors > 1 ? "s ont" : " a"} « {city!.name} » comme ville : leur fiche ne sera pas renommée automatiquement.</p>}
        <label className="grid gap-1.5 text-sm font-semibold">Province<input value={province} maxLength={60} onChange={(e) => setProvince(e.target.value)} className={dateInputClass} placeholder="Kinshasa" /></label>
        <label className="inline-flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-4 accent-[var(--gold)]" />Visible dans les filtres et l’inscription</label>
      </div>
    </Dialog>
  );
}
