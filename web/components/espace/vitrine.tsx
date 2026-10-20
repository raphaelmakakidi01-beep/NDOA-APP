"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Camera, Check, Eye, Film, Images, Loader2, Monitor, Plus, Smartphone, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { Dialog } from "@/components/ui/dialog";
import { Card, CardHeader, EmptyState, Skeleton } from "@/components/ui/bits";
import { PhoneInput } from "@/components/auth/phone-input";
import { DeviceFrame } from "@/components/shared/device-frame";
import { ProfilePreview } from "@/components/onboarding/profile-preview";
import { ToggleChip } from "@/components/onboarding/step-ui";
import { useEspace } from "@/lib/espace/store";
import type { MediaItem } from "@/lib/espace/types";
import { CITIES, DETAIL_FIELDS, LANGUAGES, STYLE_SUGGESTIONS, ZONE_SUGGESTIONS, categoryName } from "@/lib/onboarding/catalog";
import { stepSchemas } from "@/lib/onboarding/rules";
import { storeImage } from "@/lib/onboarding/repo";
import { checkPhoto, checkSignature, compressPhoto, PHOTO_ACCEPT } from "@/lib/media";
import type { Draft, MediaRef } from "@/lib/onboarding/types";
import { toFieldErrors, type FieldErrors } from "@/lib/validation";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "identite", label: "Identité" }, { id: "couverture", label: "Couverture" }, { id: "presentation", label: "Présentation" },
  { id: "details", label: "Détails" }, { id: "zones", label: "Zones et langues" }, { id: "contacts", label: "Contacts" },
];

const toRef = (m: MediaItem): MediaRef => ({ id: m.id, url: m.url, source: m.source, name: m.name, size: m.size, width: m.width, height: m.height, status: "ready", progress: 100 });

export function ChipsEditor({ id, values, onChange, suggestions, placeholder }: { id: string; values: string[]; onChange: (v: string[]) => void; suggestions: string[]; placeholder: string }) {
  const [v, setV] = useState("");
  const add = (x: string) => { const t = x.trim(); if (t && !values.includes(t)) onChange([...values, t]); setV(""); };
  return (
    <div className="grid gap-3">
      <div className="flex gap-2">
        <Input id={id} value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} maxLength={40}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(v); } }} />
        <button type="button" onClick={() => add(v)} className="grid size-12 shrink-0 place-items-center rounded-xl border border-line-strong hover:border-gold" aria-label="Ajouter"><Plus className="size-4" aria-hidden /></button>
      </div>
      <div className="flex flex-wrap gap-2">
        {values.map((x) => (
          <span key={x} className="inline-flex h-9 items-center gap-1 rounded-full bg-surface-2 pl-3.5 pr-1 text-sm font-medium">
            {x}
            <button type="button" onClick={() => onChange(values.filter((y) => y !== x))} className="grid size-7 place-items-center rounded-full hover:bg-line" aria-label={`Retirer ${x}`}><X className="size-3.5" aria-hidden /></button>
          </span>
        ))}
        {suggestions.filter((s) => !values.includes(s)).slice(0, 6).map((s) => (
          <button key={s} type="button" onClick={() => add(s)} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-dashed border-line-strong px-3 text-[13px] text-muted hover:border-gold hover:text-text">
            <Plus className="size-3.5" aria-hidden />{s}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Vitrine() {
  const { vendor, data, saveVitrine } = useEspace();
  const params = useSearchParams();
  const [form, setForm] = useState<Draft>(vendor);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  const [previewOpen, setPreviewOpen] = useState(params.get("apercu") === "1");
  const [coverOpen, setCoverOpen] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const avatarInput = useRef<HTMLInputElement>(null);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(vendor), [form, vendor]);
  const set = (patch: Partial<Draft>) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => { const n = { ...e }; Object.keys(patch).forEach((k) => delete n[k]); return n; });
  };
  const setContact = (patch: Partial<Draft["contacts"]>) => {
    setForm((f) => ({ ...f, contacts: { ...f.contacts, ...patch } }));
    setErrors((e) => { const n = { ...e }; Object.keys(patch).forEach((k) => delete n[k]); return n; });
  };
  const setDetail = (k: string, v: string) => setForm((f) => ({ ...f, details: { ...(f.details ?? {}), [k]: v } }));

  // Avertit avant de quitter avec des modifications non enregistrées
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    addEventListener("beforeunload", h);
    return () => removeEventListener("beforeunload", h);
  }, [dirty]);

  const cat = form.primaryCategory ?? form.categories[0] ?? "";
  const detailDef = DETAIL_FIELDS[cat];

  async function onSave() {
    const a = stepSchemas.entreprise.safeParse(form), c = stepSchemas.contacts.safeParse(form.contacts);
    const errs: FieldErrors = { ...(a.success ? {} : toFieldErrors(a.error)), ...(c.success ? {} : toFieldErrors(c.error)) };
    detailDef?.fields.filter((f) => f.type === "number").forEach((f) => {
      const v = form.details?.[f.key];
      if (v && !/^\d+$/.test(v)) errs[`d-${f.key}`] = "Indiquez un nombre entier.";
    });
    if (Object.keys(errs).length) {
      setErrors(errs);
      toast.error("Certaines informations sont à corriger.", { description: Object.values(errs)[0] });
      requestAnimationFrame(() => (document.querySelector("[aria-invalid=true]") as HTMLElement | null)?.focus());
      return;
    }
    setSaving(true);
    const ok = await saveVitrine(form);
    setSaving(false);
    if (ok) toast.success("Vitrine mise à jour", { description: "Les changements sont visibles sur votre page publique." });
  }

  async function onAvatar(file: File) {
    const err = checkPhoto(file) ?? (await checkSignature(file, "photo"));
    if (err) { toast.error(err); return; }
    setAvatarBusy(true);
    try {
      const p = await compressPhoto(file, 800);
      const ref = await storeImage({ vendorId: form.vendorId }, { ...p, name: file.name }, () => {}, "avatar");
      set({ avatar: ref });
    } catch { toast.error("La photo n’a pas pu être envoyée."); }
    setAvatarBusy(false);
  }

  const readyMedia = data.media.filter((m) => m.status === "ready");
  const preview = <ProfilePreview d={form} compact={device === "mobile"} />;

  return (
    <div className="pb-24">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[2.1rem] leading-tight sm:text-5xl">Ma <em className="text-gold-ink">vitrine</em></h1>
          <p className="mt-1 text-muted">Tout ce que voient les mariés sur votre page. L’aperçu se met à jour en direct.</p>
        </div>
        <Button variant="outline" className="xl:hidden" onClick={() => setPreviewOpen(true)}><Eye aria-hidden />Aperçu</Button>
      </div>

      <nav aria-label="Sections de la vitrine" className="sticky top-16 z-20 -mx-4 mb-6 flex gap-2 overflow-x-auto border-b border-line bg-bg/90 px-4 py-3 backdrop-blur-xl [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="shrink-0 rounded-full border border-line px-3.5 py-1.5 text-sm font-semibold text-muted hover:border-gold hover:text-text">{s.label}</a>
        ))}
      </nav>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="grid min-w-0 content-start gap-6">
          {/* Identité */}
          <Card id="identite" className="scroll-mt-36" aria-labelledby="h-identite">
            <CardHeader id="h-identite" title="Identité" sub={categoryName(cat) ? `Activité principale : ${categoryName(cat)}` : undefined} />
            <div className="grid gap-6 sm:grid-cols-[auto_1fr]">
              <button type="button" onClick={() => avatarInput.current?.click()} aria-label="Changer la photo de profil"
                className="group relative grid size-28 place-items-center overflow-hidden rounded-full border-2 border-dashed border-line-strong hover:border-gold">
                {form.avatar?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.avatar.url} alt="" className="size-full object-cover" />
                ) : <Camera className="size-6 text-gold" aria-hidden />}
                <span className="absolute inset-0 grid place-items-center bg-black/55 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  {avatarBusy ? <Loader2 className="size-5 animate-spin" aria-label="Envoi en cours" /> : "Changer"}
                </span>
              </button>
              <input ref={avatarInput} type="file" accept={PHOTO_ACCEPT} className="sr-only" tabIndex={-1}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void onAvatar(f); e.target.value = ""; }} />
              <div className="grid grid-cols-1 gap-5">
                <Field id="v-name" label="Nom affiché" error={errors.name}>
                  {({ id, describedBy, invalid }) => <Input id={id} value={form.name} maxLength={80} onChange={(e) => set({ name: e.target.value })} aria-describedby={describedBy} aria-invalid={invalid || undefined} />}
                </Field>
                <Field id="v-tagline" label="Accroche" optional error={errors.tagline} counter={{ value: form.tagline.length, max: 120 }}>
                  {({ id, describedBy, invalid }) => <Input id={id} value={form.tagline} maxLength={140} onChange={(e) => set({ tagline: e.target.value })} aria-describedby={describedBy} aria-invalid={invalid || undefined} />}
                </Field>
                <p className="text-[13px] text-muted">Adresse de votre page : <b className="text-text">ndoa.cd/prestataire/{form.slug}</b> · modifiable depuis les paramètres.</p>
              </div>
            </div>
          </Card>

          {/* Couverture */}
          <Card id="couverture" className="scroll-mt-36" aria-labelledby="h-couverture">
            <CardHeader id="h-couverture" title="Couverture" sub="Une photo, ou une vidéo courte qui se lance en boucle et sans son (offre Pro)." action={<Button variant="outline" size="sm" onClick={() => setCoverOpen(true)}><Images aria-hidden />Choisir</Button>} />
            <div className="relative aspect-[16/7] overflow-hidden rounded-2xl bg-surface-2">
              {form.coverVideo?.posterUrl || form.coverVideo?.url ? (
                form.coverVideo.url
                  ? <video src={form.coverVideo.url} poster={form.coverVideo.posterUrl} autoPlay muted loop playsInline className="size-full object-cover" aria-label="Vidéo de couverture" />
                  // eslint-disable-next-line @next/next/no-img-element
                  : <img src={form.coverVideo.posterUrl} alt="Vidéo de couverture" className="size-full object-cover" />
              ) : form.cover?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.cover.url} alt="Photo de couverture" className="size-full object-cover" />
              ) : <EmptyState className="h-full border-0" icon={<Images />} title="Aucune couverture" />}
              {form.coverVideo && (
                <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-md bg-black/65 px-2 py-1 text-xs font-semibold text-white"><Film className="size-3.5" aria-hidden />Vidéo</span>
              )}
            </div>
            {form.coverVideo && <Button variant="link" size="sm" className="mt-3" onClick={() => set({ coverVideo: undefined })}>Revenir à la photo de couverture</Button>}
          </Card>

          {/* Présentation */}
          <Card id="presentation" className="scroll-mt-36" aria-labelledby="h-presentation">
            <CardHeader id="h-presentation" title="Présentation" />
            <div className="grid grid-cols-1 gap-6">
              <Field id="v-bio" label="Bio" error={errors.bio} counter={{ value: form.bio.length, max: 3000 }} hint="La première phrase s’affiche en grand sur votre page : soignez-la.">
                {({ id, describedBy, invalid }) => <Textarea id={id} rows={7} value={form.bio} onChange={(e) => set({ bio: e.target.value })} aria-describedby={describedBy} aria-invalid={invalid || undefined} />}
              </Field>
              <div className="grid gap-2">
                <label htmlFor="v-style" className="text-sm font-semibold">Style <span className="font-normal text-muted">(5 maximum conseillés)</span></label>
                <ChipsEditor id="v-style" values={form.styleTags ?? []} onChange={(v) => set({ styleTags: v })} suggestions={STYLE_SUGGESTIONS} placeholder="Ex. : Éditorial" />
              </div>
            </div>
          </Card>

          {/* Détails métier */}
          <Card id="details" className="scroll-mt-36" aria-labelledby="h-details">
            <CardHeader id="h-details" title={detailDef?.title ?? "Détails"} sub="Ces informations rassurent les mariés et répondent à leurs premières questions." />
            {detailDef ? (
              <div className="grid gap-5 sm:grid-cols-2">
                {detailDef.fields.map((f) => (
                  <Field key={f.key} id={`d-${f.key}`} label={f.label} optional hint={f.hint} error={errors[`d-${f.key}`]} className={f.type === "list" || f.key === "acces" ? "sm:col-span-2" : undefined}>
                    {({ id, describedBy, invalid }) => f.type === "list" ? (
                      <Textarea id={id} rows={4} value={form.details?.[f.key] ?? ""} onChange={(e) => setDetail(f.key, e.target.value)} aria-describedby={describedBy} />
                    ) : (
                      <div className="relative">
                        <Input id={id} inputMode={f.type === "number" ? "numeric" : undefined} value={form.details?.[f.key] ?? ""} onChange={(e) => setDetail(f.key, e.target.value)} aria-describedby={describedBy} aria-invalid={invalid || undefined} className={f.suffix ? "pr-20" : undefined} />
                        {f.suffix && <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted">{f.suffix}</span>}
                      </div>
                    )}
                  </Field>
                ))}
              </div>
            ) : <p className="text-sm text-muted">Aucun champ spécifique pour votre activité. Votre bio et vos photos font le travail !</p>}
          </Card>

          {/* Zones & langues */}
          <Card id="zones" className="scroll-mt-36" aria-labelledby="h-zones">
            <CardHeader id="h-zones" title="Zones et langues" />
            <div className="grid grid-cols-1 gap-6">
              <Field id="v-city" label="Ville principale">
                {({ id }) => <Select id={id} value={form.city} onChange={(e) => set({ city: e.target.value })}>{CITIES.map((c) => <option key={c}>{c}</option>)}</Select>}
              </Field>
              <div className="grid gap-2">
                <label htmlFor="v-zones" className="text-sm font-semibold">Zones d’intervention</label>
                <ChipsEditor id="v-zones" values={form.zones} onChange={(v) => set({ zones: v })} suggestions={ZONE_SUGGESTIONS} placeholder="Ex. : Kongo-Central" />
                {errors.zones && <p role="alert" className="text-[13px] font-medium text-danger">{errors.zones}</p>}
              </div>
              <fieldset>
                <legend className="mb-3 text-sm font-semibold">Langues parlées</legend>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map((l) => <ToggleChip key={l} on={form.languages.includes(l)} onClick={() => set({ languages: form.languages.includes(l) ? form.languages.filter((x) => x !== l) : [...form.languages, l] })}>{l}</ToggleChip>)}
                </div>
                {errors.languages && <p role="alert" className="mt-2 text-[13px] font-medium text-danger">{errors.languages}</p>}
              </fieldset>
            </div>
          </Card>

          {/* Contacts */}
          <Card id="contacts" className="scroll-mt-36" aria-labelledby="h-contacts">
            <CardHeader id="h-contacts" title="Contacts et réseaux" />
            <div className="grid grid-cols-1 gap-5">
              <Field id="v-phone" label="Téléphone" error={errors.phone}>
                {({ id, describedBy, invalid }) => <PhoneInput id={id} country={form.contacts.country} onCountry={(v) => setContact({ country: v })} value={form.contacts.phone} onChange={(v) => setContact({ phone: v })} describedBy={describedBy} invalid={invalid} />}
              </Field>
              <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={form.contacts.whatsappSame} onChange={(e) => setContact({ whatsappSame: e.target.checked })} className="size-5 accent-[#C4975A]" />Même numéro sur WhatsApp</label>
              {!form.contacts.whatsappSame && (
                <Field id="v-wa" label="WhatsApp" error={errors.whatsapp}>
                  {({ id, describedBy, invalid }) => <PhoneInput id={id} country={form.contacts.country} onCountry={(v) => setContact({ country: v })} value={form.contacts.whatsapp} onChange={(v) => setContact({ whatsapp: v })} describedBy={describedBy} invalid={invalid} />}
                </Field>
              )}
              <div className="grid gap-5 sm:grid-cols-2">
                {([["email", "E-mail", "contact@studio.cd"], ["instagram", "Instagram", "studiolumiere"], ["tiktok", "TikTok", "studiolumiere"], ["facebook", "Facebook", "studiolumiere"], ["youtube", "YouTube", "studiolumiere"], ["website", "Site web", "https://…"]] as const).map(([k, label, ph]) => (
                  <Field key={k} id={`v-${k}`} label={label} optional error={errors[k]}>
                    {({ id, describedBy, invalid }) => <Input id={id} value={form.contacts[k]} placeholder={ph} onChange={(e) => setContact({ [k]: e.target.value.trim() })} aria-describedby={describedBy} aria-invalid={invalid || undefined} />}
                  </Field>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Aperçu en direct (grand écran) */}
        <aside className="hidden xl:block" aria-label="Aperçu en direct">
          <div className="sticky top-36 grid gap-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Aperçu en direct</p>
              <Segmented label="Appareil" layoutId="v-device" value={device} onChange={setDevice}
                options={[{ value: "mobile", label: <Smartphone className="size-4" aria-label="Mobile" /> }, { value: "desktop", label: <Monitor className="size-4" aria-label="Ordinateur" /> }]} />
            </div>
            <DeviceFrame device={device} mobileHeight="h-[calc(100dvh-260px)]">{preview}</DeviceFrame>
          </div>
        </aside>
      </div>

      {/* Barre d’enregistrement (au-dessus de la barre d’onglets mobile) */}
      <AnimatePresence>
        {dirty && (
          <motion.div role="region" aria-label="Modifications non enregistrées" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-x-3 bottom-[calc(76px+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-gold/40 bg-surface/95 p-3 pl-5 shadow-2xl backdrop-blur-xl lg:bottom-6">
            <span className="flex-1 text-sm font-semibold">Modifications non enregistrées</span>
            <Button variant="ghost" size="sm" onClick={() => { setForm(vendor); setErrors({}); }}>Annuler</Button>
            <Button size="sm" loading={saving} onClick={onSave}><Check aria-hidden />Enregistrer</Button>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen} title="Aperçu de votre page" wide>
        <div className="mb-4 flex justify-center">
          <Segmented label="Appareil" layoutId="v-device-dlg" value={device} onChange={setDevice} options={[{ value: "mobile", label: "Mobile" }, { value: "desktop", label: "Ordinateur" }]} />
        </div>
        <DeviceFrame device={device} mobileHeight="h-[60dvh]">{preview}</DeviceFrame>
      </Dialog>

      <Dialog open={coverOpen} onOpenChange={setCoverOpen} title="Choisir la couverture" description="Sélectionnez une photo ou une vidéo de votre galerie." wide>
        {readyMedia.length ? (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {readyMedia.map((m) => {
              const on = m.kind === "video" ? form.coverVideo?.id === m.id : !form.coverVideo && form.cover?.id === m.id;
              return (
                <li key={m.id}>
                  <button type="button" aria-pressed={on} onClick={() => {
                    if (m.kind === "video") set({ coverVideo: { ...toRef(m), posterUrl: m.posterUrl } });
                    else set({ cover: toRef(m), coverVideo: undefined });
                    setCoverOpen(false);
                  }} className={cn("relative block aspect-square w-full overflow-hidden rounded-xl ring-2 ring-offset-2 ring-offset-surface", on ? "ring-gold" : "ring-transparent hover:ring-gold/50")}
                    aria-label={`${m.kind === "video" ? "Vidéo" : "Photo"} ${m.name}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.kind === "video" ? m.posterUrl : m.url} alt="" className="size-full object-cover" loading="lazy" />
                    {m.kind === "video" && <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold text-white"><Film className="size-3" aria-hidden />Vidéo</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : <EmptyState icon={<Images />} title="Galerie vide" action={<Button asChild><Link href="/espace/galerie?ajouter=1">Ajouter des photos</Link></Button>} />}
      </Dialog>
    </div>
  );
}

export function VitrineSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6" aria-busy="true" aria-label="Chargement de la vitrine">
      <Skeleton className="h-12 w-64" />
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="grid grid-cols-1 gap-6">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-64 rounded-3xl" />)}</div>
        <Skeleton className="hidden h-[640px] rounded-[44px] xl:block" />
      </div>
    </div>
  );
}
