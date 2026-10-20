"use client";

import { useState } from "react";
import Link from "next/link";
import { DropdownMenu } from "radix-ui";
import { motion } from "motion/react";
import { ArrowDown, ArrowUp, Check, Copy, Eye, EyeOff, MoreHorizontal, Pencil, Percent, Plus, Sparkles, Star, Tags, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { Card, CardHeader, EmptyState, Skeleton, StatusTag, dateFr } from "@/components/ui/bits";
import { ChipsEditor } from "@/components/espace/vitrine";
import { useEspace } from "@/lib/espace/store";
import { useBusiness } from "@/lib/espace/business";
import { PLANS, PLAN_MAX_PACKAGES, activePromo, promoPrice, type Currency, type Package, type PackageOption, type Promotion } from "@/lib/espace/types";
import { INCLUDE_SUGGESTIONS } from "@/lib/onboarding/catalog";
import { cn, formatPrice, uid } from "@/lib/utils";

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

const menuItem = "flex h-10 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm outline-none data-[highlighted]:bg-surface-2 data-[disabled]:pointer-events-none data-[disabled]:opacity-40 [&_svg]:size-4 [&_svg]:text-muted";

export function promoLabel(p: Promotion, currency: Currency = "USD") {
  if (p.discount === "percent") return `−${p.value} %`;
  if (p.discount === "amount") return `−${formatPrice(p.value, currency)}`;
  return `Prix spécial ${formatPrice(p.value, currency)}`;
}

function promoState(p: Promotion, day: string) {
  if (day < p.startsAt) return { label: "À venir", tone: "muted" as const };
  if (day > p.endsAt) return { label: "Terminée", tone: "danger" as const };
  return { label: "En cours", tone: "success" as const };
}

/* ---------------------------------------------------------
   Éditeur de forfait
   --------------------------------------------------------- */
type PkgForm = Omit<Package, "amount"> & { amount: string };
const blankPkg = (): PkgForm => ({ id: uid(), name: "", description: "", priceMode: "from", amount: "", currency: "USD", duration: "", includes: [], excludes: [], featured: false, visible: true });

function PackageDialog({ initial, onClose }: { initial: PkgForm | null; onClose: () => void }) {
  const biz = useBusiness();
  const { vendor } = useEspace();
  const [f, setF] = useState<PkgForm>(initial ?? blankPkg());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (p: Partial<PkgForm>) => { setF((x) => ({ ...x, ...p })); setErrors((e) => { const n = { ...e }; Object.keys(p).forEach((k) => delete n[k]); return n; }); };
  const suggestions = INCLUDE_SUGGESTIONS[vendor.primaryCategory ?? ""] ?? [];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (f.name.trim().length < 2) err.name = "Donnez un nom à ce forfait.";
    const amount = Number(f.amount.replace(/\s/g, "").replace(",", "."));
    if (!f.amount || !Number.isFinite(amount) || amount <= 0) err.amount = "Indiquez un prix supérieur à 0.";
    if (!f.includes.length) err.includes = "Ajoutez au moins un élément inclus.";
    setErrors(err);
    if (Object.keys(err).length) { document.getElementById(`pkg-${Object.keys(err)[0]}`)?.focus(); return; }
    if (biz.savePackage({ ...f, name: f.name.trim(), amount })) onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} wide title={initial ? "Modifier le forfait" : "Nouveau forfait"} description="Ce que les couples voient sur votre vitrine, et la base de vos devis."
      footer={<><Button variant="ghost" onClick={onClose}>Annuler</Button><Button type="submit" form="pkg-form">{initial ? "Enregistrer" : "Créer le forfait"}</Button></>}>
      <form id="pkg-form" onSubmit={submit} noValidate className="grid grid-cols-1 gap-5">
        <Field id="pkg-name" label="Nom du forfait" error={errors.name} counter={{ value: f.name.length, max: 40 }}>
          {(a) => <Input id={a.id} aria-describedby={a.describedBy} aria-invalid={a.invalid} value={f.name} maxLength={40} onChange={(e) => set({ name: e.target.value })} placeholder="Ex. Premium" />}
        </Field>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-[auto_1fr_8rem]">
          <div className="grid gap-1.5">
            <span className="text-sm font-semibold" id="pkg-mode-l">Affichage du prix</span>
            <Segmented layoutId="pkg-mode" label="Affichage du prix" value={f.priceMode} onChange={(v) => set({ priceMode: v })} options={[{ value: "from", label: "À partir de" }, { value: "fixed", label: "Prix fixe" }]} />
          </div>
          <Field id="pkg-amount" label="Prix" error={errors.amount}>
            {(a) => <Input id={a.id} aria-describedby={a.describedBy} aria-invalid={a.invalid} inputMode="decimal" value={f.amount} onChange={(e) => set({ amount: e.target.value.replace(/[^\d\s,.]/g, "") })} placeholder="850" />}
          </Field>
          <Field id="pkg-currency" label="Devise">
            {(a) => <Select id={a.id} value={f.currency} onChange={(e) => set({ currency: e.target.value as Currency })}><option value="USD">USD</option><option value="CDF">CDF</option></Select>}
          </Field>
        </div>
        <Field id="pkg-duration" label="Durée de la prestation" optional hint="Ex. 8 h, journée complète, week-end.">
          {(a) => <Input id={a.id} aria-describedby={a.describedBy} value={f.duration} maxLength={40} onChange={(e) => set({ duration: e.target.value })} />}
        </Field>
        <Field id="pkg-description" label="Description" optional counter={{ value: f.description.length, max: 300 }}>
          {(a) => <Textarea id={a.id} className="min-h-24" value={f.description} maxLength={300} onChange={(e) => set({ description: e.target.value })} placeholder="Pour qui est ce forfait, ce qui le rend unique." />}
        </Field>
        <div className="grid gap-1.5">
          <label htmlFor="pkg-includes" className="text-sm font-semibold">Inclus</label>
          <ChipsEditor id="pkg-includes" values={f.includes} onChange={(v) => set({ includes: v })} suggestions={suggestions} placeholder="Ex. 400 photos retouchées" />
          {errors.includes && <p role="alert" className="text-[13px] font-medium text-danger">{errors.includes}</p>}
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="pkg-excludes" className="text-sm font-semibold">Non inclus <span className="font-normal text-muted">(facultatif)</span></label>
          <ChipsEditor id="pkg-excludes" values={f.excludes} onChange={(v) => set({ excludes: v })} suggestions={[]} placeholder="Ex. Album imprimé" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {([["featured", "Le plus populaire", "Mis en avant sur votre vitrine (un seul forfait)."], ["visible", "Visible sur ma vitrine", "Masquez-le pour le garder en réserve."]] as const).map(([k, l, h]) => (
            <label key={k} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line p-4 has-[:checked]:border-gold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold/40">
              <input type="checkbox" className="mt-0.5 size-5 accent-[var(--color-gold)]" checked={f[k]} onChange={(e) => set({ [k]: e.target.checked } as Partial<PkgForm>)} />
              <span><span className="block text-sm font-semibold">{l}</span><span className="text-[13px] text-muted">{h}</span></span>
            </label>
          ))}
        </div>
      </form>
    </Dialog>
  );
}

/* ---------------------------------------------------------
   Carte forfait
   --------------------------------------------------------- */
function PackageCard({ p, index, count, day, onEdit, onDelete }: { p: Package; index: number; count: number; day: string; onEdit: () => void; onDelete: () => void }) {
  const { data } = useEspace();
  const biz = useBusiness();
  const promo = activePromo(data.promotions, p.id, day);
  const price = promoPrice(p.amount, promo);
  return (
    <motion.article layout transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
      className={cn("relative flex min-w-0 flex-col rounded-3xl border bg-surface p-5 sm:p-6", p.featured ? "border-gold shadow-[0_0_0_1px_var(--color-gold)]" : "border-line", !p.visible && "border-dashed opacity-75")}>
      <div className="mb-4 flex min-h-6 flex-wrap items-center gap-2">
        {p.featured && <StatusTag tone="gold"><Star className="size-3" aria-hidden />Le plus populaire</StatusTag>}
        {!p.visible && <StatusTag tone="muted">Masqué</StatusTag>}
        {promo && p.visible && <StatusTag tone="rose">{promo.label} {promoLabel(promo, p.currency)}</StatusTag>}
      </div>
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-2xl leading-tight">{p.name}</h3>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger className="-mr-2 -mt-1 grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-text" aria-label={`Actions pour ${p.name}`}>
            <MoreHorizontal className="size-5" aria-hidden />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" sideOffset={4} className="z-50 min-w-60 rounded-2xl border border-line bg-surface p-1.5 shadow-2xl">
              <DropdownMenu.Item className={menuItem} onSelect={onEdit}><Pencil aria-hidden />Modifier</DropdownMenu.Item>
              <DropdownMenu.Item className={menuItem} onSelect={() => biz.duplicatePackage(p.id)}><Copy aria-hidden />Dupliquer</DropdownMenu.Item>
              <DropdownMenu.Item className={menuItem} onSelect={() => biz.toggleVisible(p.id)}>{p.visible ? <><EyeOff aria-hidden />Masquer de ma vitrine</> : <><Eye aria-hidden />Afficher sur ma vitrine</>}</DropdownMenu.Item>
              <DropdownMenu.Item className={menuItem} disabled={!p.visible} onSelect={() => biz.setFeatured(p.featured ? null : p.id)}><Star aria-hidden />{p.featured ? "Retirer « Le plus populaire »" : "Marquer « Le plus populaire »"}</DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1 h-px bg-line" />
              <DropdownMenu.Item className={menuItem} disabled={index === 0} onSelect={() => biz.movePackage(p.id, -1)}><ArrowUp aria-hidden />Déplacer avant</DropdownMenu.Item>
              <DropdownMenu.Item className={menuItem} disabled={index === count - 1} onSelect={() => biz.movePackage(p.id, 1)}><ArrowDown aria-hidden />Déplacer après</DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1 h-px bg-line" />
              <DropdownMenu.Item className={cn(menuItem, "text-danger data-[highlighted]:bg-danger/10 [&_svg]:text-danger")} onSelect={onDelete}><Trash2 aria-hidden />Supprimer</DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
      <p className="mt-3 flex flex-wrap items-baseline gap-x-2">
        {p.priceMode === "from" && <span className="text-sm text-muted">À partir de</span>}
        <span className="font-display text-3xl tabular-nums">{formatPrice(price, p.currency)}</span>
        {promo && <s className="text-sm text-muted tabular-nums" aria-label={`au lieu de ${formatPrice(p.amount, p.currency)}`}>{formatPrice(p.amount, p.currency)}</s>}
      </p>
      {promo && <p className="mt-1 text-[13px] text-rose-ink">Jusqu’au {dateFr(promo.endsAt)}</p>}
      {p.duration && <p className="mt-1 text-sm text-muted">{p.duration}</p>}
      {p.description && <p className="mt-4 text-[15px] leading-relaxed text-muted">{p.description}</p>}
      <ul className="mt-5 grid gap-2 text-[15px]" aria-label="Inclus">
        {p.includes.map((i) => <li key={i} className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-gold-ink" aria-hidden />{i}</li>)}
      </ul>
      {p.excludes.length > 0 && (
        <ul className="mt-3 grid gap-2 text-sm text-muted" aria-label="Non inclus">
          {p.excludes.map((i) => <li key={i} className="flex gap-2.5"><X className="mt-0.5 size-4 shrink-0" aria-hidden /><span><span className="sr-only">Non inclus : </span>{i}</span></li>)}
        </ul>
      )}
      <div className="mt-auto pt-6">
        <Button variant="outline" className="w-full" onClick={onEdit}><Pencil aria-hidden />Modifier</Button>
      </div>
    </motion.article>
  );
}

/* ---------------------------------------------------------
   Options payantes
   --------------------------------------------------------- */
function OptionDialog({ initial, onClose }: { initial: PackageOption | null; onClose: () => void }) {
  const { data } = useEspace();
  const biz = useBusiness();
  const [f, setF] = useState({ id: initial?.id ?? uid(), name: initial?.name ?? "", amount: initial ? String(initial.amount) : "", currency: initial?.currency ?? ("USD" as Currency), packageId: initial?.packageId ?? "" });
  const [err, setErr] = useState<Record<string, string>>({});
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(f.amount.replace(",", "."));
    const n: Record<string, string> = {};
    if (f.name.trim().length < 2) n.name = "Nommez cette option.";
    if (!Number.isFinite(amount) || amount <= 0) n.amount = "Indiquez un prix supérieur à 0.";
    setErr(n);
    if (Object.keys(n).length) return;
    biz.saveOption({ id: f.id, name: f.name.trim(), amount, currency: f.currency, packageId: f.packageId || undefined });
    onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={initial ? "Modifier l’option" : "Nouvelle option"} description="Un supplément que le couple peut ajouter à un forfait."
      footer={<><Button variant="ghost" onClick={onClose}>Annuler</Button><Button type="submit" form="opt-form">Enregistrer</Button></>}>
      <form id="opt-form" onSubmit={submit} noValidate className="grid grid-cols-1 gap-5">
        <Field label="Nom" error={err.name}>{(a) => <Input id={a.id} aria-describedby={a.describedBy} aria-invalid={a.invalid} value={f.name} maxLength={60} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ex. Plans drone" autoFocus />}</Field>
        <div className="grid grid-cols-[1fr_8rem] gap-4">
          <Field label="Prix" error={err.amount}>{(a) => <Input id={a.id} aria-describedby={a.describedBy} aria-invalid={a.invalid} inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d,.]/g, "") })} />}</Field>
          <Field label="Devise">{(a) => <Select id={a.id} value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value as Currency })}><option>USD</option><option>CDF</option></Select>}</Field>
        </div>
        <Field label="Proposée avec" hint="Laissez « Tous les forfaits » si l’option s’applique partout.">
          {(a) => <Select id={a.id} aria-describedby={a.describedBy} value={f.packageId} onChange={(e) => setF({ ...f, packageId: e.target.value })}><option value="">Tous les forfaits</option>{data.packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>}
        </Field>
      </form>
    </Dialog>
  );
}

/* ---------------------------------------------------------
   Promotions et prix saisonniers
   --------------------------------------------------------- */
function PromoDialog({ initial, onClose }: { initial: Promotion | null; onClose: () => void }) {
  const { data } = useEspace();
  const biz = useBusiness();
  const [f, setF] = useState({
    id: initial?.id ?? uid(), label: initial?.label ?? "", kind: initial?.kind ?? ("seasonal" as Promotion["kind"]), discount: initial?.discount ?? ("percent" as Promotion["discount"]),
    value: initial ? String(initial.value) : "", startsAt: initial?.startsAt ?? today(), endsAt: initial?.endsAt ?? addDays(30), packageId: initial?.packageId ?? "",
  });
  const [err, setErr] = useState<Record<string, string>>({});
  const pkg = data.packages.find((p) => p.id === f.packageId) ?? data.packages[0];
  const value = Number(f.value.replace(",", "."));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n: Record<string, string> = {};
    if (f.label.trim().length < 2) n.label = "Donnez un nom à cette promotion.";
    if (!Number.isFinite(value) || value <= 0) n.value = "Indiquez une valeur supérieure à 0.";
    else if (f.discount === "percent" && value >= 90) n.value = "Une remise ne peut pas dépasser 90 %.";
    if (f.endsAt < f.startsAt) n.endsAt = "La fin doit être après le début.";
    setErr(n);
    if (Object.keys(n).length) return;
    biz.savePromotion({ id: f.id, label: f.label.trim(), kind: f.kind, discount: f.discount, value, startsAt: f.startsAt, endsAt: f.endsAt, packageId: f.packageId || undefined });
    onClose();
  };
  const preview = pkg && Number.isFinite(value) && value > 0 ? promoPrice(pkg.amount, { ...f, value } as Promotion) : null;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={initial ? "Modifier la promotion" : "Nouvelle promotion"} description="Le prix barré s’affiche automatiquement sur votre vitrine pendant la période."
      footer={<><Button variant="ghost" onClick={onClose}>Annuler</Button><Button type="submit" form="promo-form">Enregistrer</Button></>}>
      <form id="promo-form" onSubmit={submit} noValidate className="grid grid-cols-1 gap-5">
        <div className="grid gap-1.5">
          <span className="text-sm font-semibold">Type</span>
          <Segmented layoutId="promo-kind" label="Type de promotion" value={f.kind} onChange={(v) => setF({ ...f, kind: v })} options={[{ value: "seasonal", label: "Prix saisonnier" }, { value: "limited", label: "Offre limitée" }]} />
        </div>
        <Field label="Nom affiché" error={err.label}>{(a) => <Input id={a.id} aria-describedby={a.describedBy} aria-invalid={a.invalid} value={f.label} maxLength={40} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder={f.kind === "seasonal" ? "Ex. Saison sèche" : "Ex. Offre de lancement"} />}</Field>
        <Field label="Forfait concerné">{(a) => <Select id={a.id} value={f.packageId} onChange={(e) => setF({ ...f, packageId: e.target.value })}><option value="">Tous les forfaits</option>{data.packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>}</Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Réduction">{(a) => <Select id={a.id} value={f.discount} onChange={(e) => setF({ ...f, discount: e.target.value as Promotion["discount"] })}><option value="percent">Pourcentage</option><option value="amount">Montant déduit</option><option value="override">Prix remplacé</option></Select>}</Field>
          <Field label={f.discount === "percent" ? "Pourcentage" : f.discount === "amount" ? "Montant déduit" : "Nouveau prix"} error={err.value}>
            {(a) => <Input id={a.id} aria-describedby={a.describedBy} aria-invalid={a.invalid} inputMode="decimal" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value.replace(/[^\d,.]/g, "") })} placeholder={f.discount === "percent" ? "10" : "200"} />}
          </Field>
          <Field label="Début">{(a) => <Input id={a.id} type="date" value={f.startsAt} onChange={(e) => setF({ ...f, startsAt: e.target.value })} />}</Field>
          <Field label="Fin" error={err.endsAt}>{(a) => <Input id={a.id} type="date" aria-describedby={a.describedBy} aria-invalid={a.invalid} value={f.endsAt} min={f.startsAt} onChange={(e) => setF({ ...f, endsAt: e.target.value })} />}</Field>
        </div>
        {preview !== null && pkg && (
          <p className="rounded-2xl bg-surface-2 px-4 py-3 text-sm" aria-live="polite">
            Aperçu sur « {pkg.name} » : <s className="text-muted">{formatPrice(pkg.amount, pkg.currency)}</s> <strong className="text-text">{formatPrice(preview, pkg.currency)}</strong>
          </p>
        )}
      </form>
    </Dialog>
  );
}

/* ---------------------------------------------------------
   Page
   --------------------------------------------------------- */
type Confirm = { title: string; body: string; run: () => void } | null;

export function Tarifs() {
  const { data } = useEspace();
  const biz = useBusiness();
  const [day] = useState(today);
  const [pkgEdit, setPkgEdit] = useState<PkgForm | null | "new">(null);
  const [optEdit, setOptEdit] = useState<PackageOption | null | "new">(null);
  const [promoEdit, setPromoEdit] = useState<Promotion | null | "new">(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const max = PLAN_MAX_PACKAGES[data.plan];
  const full = data.packages.length >= max;
  const pkgName = (id?: string) => (id ? data.packages.find((p) => p.id === id)?.name ?? "Forfait supprimé" : "Tous les forfaits");

  return (
    <div className="grid grid-cols-1 gap-8">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="font-display text-[2.1rem] leading-tight sm:text-5xl"><em className="text-gold-ink">Tarifs</em></h1>
          <p className="mt-1 text-muted">Vos forfaits, options et promotions, tels qu’ils apparaissent sur votre vitrine.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted tabular-nums">{data.packages.length} / {max >= 99 ? "illimité" : max} forfait{max > 1 ? "s" : ""} · offre {PLANS[data.plan].name}</span>
          <Button onClick={() => setPkgEdit("new")} disabled={full} aria-describedby={full ? "pkg-full" : undefined}><Plus aria-hidden />Nouveau forfait</Button>
        </div>
      </div>
      {full && (
        <p id="pkg-full" className="-mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-gold/40 bg-gold/8 px-4 py-3 text-sm">
          <Sparkles className="size-4 text-gold-ink" aria-hidden />Vous avez atteint le nombre de forfaits de votre offre.
          <Link href="/espace/abonnement" className="font-semibold text-gold-ink underline-offset-4 hover:underline">Voir les offres</Link>
        </p>
      )}

      {data.packages.length === 0 ? (
        <EmptyState icon={<Tags />} title="Aucun forfait pour l’instant" action={<Button onClick={() => setPkgEdit("new")}><Plus aria-hidden />Créer mon premier forfait</Button>}>
          Les couples comparent d’abord les prix. Un forfait clair multiplie les demandes.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.packages.map((p, i) => (
            <PackageCard key={p.id} p={p} index={i} count={data.packages.length} day={day}
              onEdit={() => setPkgEdit({ ...p, amount: String(p.amount) })}
              onDelete={() => setConfirm({ title: `Supprimer « ${p.name} » ?`, body: "Le forfait disparaît de votre vitrine. Les devis déjà envoyés restent inchangés.", run: () => biz.deletePackage(p.id) })} />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card aria-labelledby="opt-h">
          <CardHeader id="opt-h" title="Options payantes" sub="Les suppléments proposés en plus d’un forfait."
            action={<Button size="sm" variant="outline" onClick={() => setOptEdit("new")}><Plus aria-hidden />Ajouter</Button>} />
          {data.options.length === 0 ? (
            <EmptyState icon={<Plus />} title="Aucune option" className="py-8">Drone, heure supplémentaire, livraison express… autant de façons d’augmenter votre panier moyen.</EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {data.options.map((o) => (
                <li key={o.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{o.name}</p>
                    <p className="text-[13px] text-muted">{pkgName(o.packageId)}</p>
                  </div>
                  <span className="font-semibold tabular-nums">+{formatPrice(o.amount, o.currency)}</span>
                  <button type="button" onClick={() => setOptEdit(o)} className="grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-text" aria-label={`Modifier ${o.name}`}><Pencil className="size-4" aria-hidden /></button>
                  <button type="button" onClick={() => setConfirm({ title: `Supprimer « ${o.name} » ?`, body: "L’option ne sera plus proposée dans vos devis.", run: () => biz.deleteOption(o.id) })} className="grid size-10 place-items-center rounded-full text-muted hover:bg-danger/10 hover:text-danger" aria-label={`Supprimer ${o.name}`}><Trash2 className="size-4" aria-hidden /></button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card aria-labelledby="promo-h">
          <CardHeader id="promo-h" title="Promotions et saisons" sub="Prix saisonniers et offres limitées dans le temps."
            action={<Button size="sm" variant="outline" onClick={() => setPromoEdit("new")} disabled={!data.packages.length}><Plus aria-hidden />Ajouter</Button>} />
          {data.promotions.length === 0 ? (
            <EmptyState icon={<Percent />} title="Aucune promotion" className="py-8">Remplissez les mois creux avec un prix saisonnier, ou créez l’urgence avec une offre limitée.</EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {[...data.promotions].sort((a, b) => a.startsAt.localeCompare(b.startsAt)).map((p) => {
                const st = promoState(p, day);
                const cur = data.packages.find((x) => x.id === p.packageId)?.currency ?? "USD";
                return (
                  <li key={p.id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 font-semibold"><span className="truncate">{p.label}</span><StatusTag tone={st.tone}>{st.label}</StatusTag></p>
                      <p className="text-[13px] text-muted">{p.kind === "seasonal" ? "Prix saisonnier" : "Offre limitée"} · {pkgName(p.packageId)} · du {dateFr(p.startsAt, { day: "numeric", month: "short" })} au {dateFr(p.endsAt, { day: "numeric", month: "short", year: "numeric" })}</p>
                    </div>
                    <span className="shrink-0 text-right font-semibold tabular-nums text-rose-ink">{promoLabel(p, cur)}</span>
                    <button type="button" onClick={() => setPromoEdit(p)} className="grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-text" aria-label={`Modifier ${p.label}`}><Pencil className="size-4" aria-hidden /></button>
                    <button type="button" onClick={() => setConfirm({ title: `Supprimer « ${p.label} » ?`, body: "Le prix normal s’affichera de nouveau sur votre vitrine.", run: () => biz.deletePromotion(p.id) })} className="grid size-10 place-items-center rounded-full text-muted hover:bg-danger/10 hover:text-danger" aria-label={`Supprimer ${p.label}`}><Trash2 className="size-4" aria-hidden /></button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {pkgEdit && <PackageDialog key={pkgEdit === "new" ? "new" : pkgEdit.id} initial={pkgEdit === "new" ? null : pkgEdit} onClose={() => setPkgEdit(null)} />}
      {optEdit && <OptionDialog initial={optEdit === "new" ? null : optEdit} onClose={() => setOptEdit(null)} />}
      {promoEdit && <PromoDialog initial={promoEdit === "new" ? null : promoEdit} onClose={() => setPromoEdit(null)} />}
      <ConfirmDialog confirm={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}

export function ConfirmDialog({ confirm, onClose, cta = "Supprimer" }: { confirm: Confirm; onClose: () => void; cta?: string }) {
  return (
    <Dialog open={!!confirm} onOpenChange={(o) => !o && onClose()} title={confirm?.title ?? ""} description={confirm?.body}
      footer={<><Button variant="ghost" onClick={onClose}>Annuler</Button><Button variant="danger" onClick={() => { confirm?.run(); onClose(); }}>{cta}</Button></>}>
      <p className="text-sm text-muted">Cette action est immédiate.</p>
    </Dialog>
  );
}

export function TarifsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-8" aria-busy="true" aria-label="Chargement des tarifs">
      <div className="flex justify-between gap-6"><Skeleton className="h-14 w-48" /><Skeleton className="h-11 w-44 rounded-full" /></div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-96 rounded-3xl" />)}</div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2"><Skeleton className="h-64 rounded-3xl" /><Skeleton className="h-64 rounded-3xl" /></div>
    </div>
  );
}
