"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Check, Loader2, Plus, X } from "lucide-react";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { useOnboarding } from "@/lib/onboarding/store";
import { LANGUAGES, ZONE_SUGGESTIONS } from "@/lib/onboarding/catalog";
import { useCatalog, withCurrent } from "@/lib/onboarding/use-catalog";
import { PUBLIC_HOST } from "@/lib/config";
import { getSupabase } from "@/lib/supabase/client";
import { PHOTO_ACCEPT } from "@/lib/media";
import { slugify } from "@/lib/utils";
import { StepFooter, StepHeader, ToggleChip } from "./step-ui";

const TAKEN_DEMO = ["studio-lumiere-mbala", "salle-le-fleuve-dor", "dj-kinoir", "glam-by-grace"];

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Disponibilité de l’adresse : « vérification » tant que la réponse ne concerne pas la saisie actuelle */
function useSlugStatus(slug: string, vendorId?: string): "idle" | "checking" | "free" | "taken" {
  const [result, setResult] = useState<{ slug: string; taken: boolean } | null>(null);
  useEffect(() => {
    if (!SLUG_RE.test(slug)) return;
    let alive = true;
    const t = setTimeout(async () => {
      const sb = getSupabase();
      let taken = TAKEN_DEMO.includes(slug);
      if (sb) {
        const { data } = await sb.from("vendors").select("id").eq("slug", slug).maybeSingle();
        taken = !!data && data.id !== vendorId;
      }
      if (alive) setResult({ slug, taken });
    }, 450);
    return () => { alive = false; clearTimeout(t); };
  }, [slug, vendorId]);
  if (!SLUG_RE.test(slug)) return "idle";
  if (result?.slug !== slug) return "checking";
  return result.taken ? "taken" : "free";
}

export function StepEntreprise() {
  const { draft, update, errors, setAvatar, user } = useOnboarding();
  const { cities } = useCatalog();
  const [slugTouched, setSlugTouched] = useState(!!draft.slug && draft.slug !== slugify(draft.name));
  const [zoneInput, setZoneInput] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const slugStatus = useSlugStatus(draft.slug, draft.vendorId);
  const bioLen = draft.bio.trim().length;

  // Préremplit le nom avec celui du compte (modifiable)
  useEffect(() => {
    if (!draft.name && user.fullName && !user.fullName.includes("démo")) update({ name: user.fullName, slug: slugify(user.fullName) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addZone = (z: string) => {
    const v = z.trim();
    if (!v) return;
    update((d) => ({ zones: d.zones.includes(v) ? d.zones : [...d.zones, v] }));
    setZoneInput("");
  };

  return (
    <div className="mx-auto max-w-2xl">
      <StepHeader title={<>Votre <em className="text-gold-ink">entreprise</em></>}
        lead="Ce que les mariés liront en premier sur votre vitrine." />

      <div className="grid gap-5">
        {/* Photo de profil : compacte, à côté de son explication */}
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => fileRef.current?.click()}
            className="group relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-dashed border-line-strong bg-surface transition-colors hover:border-gold"
            aria-label={draft.avatar ? "Changer la photo de profil" : "Ajouter une photo de profil"}>
            {draft.avatar?.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={draft.avatar.url} alt="" className="size-full object-cover" />
            ) : <Camera className="size-5 text-gold" aria-hidden />}
            {draft.avatar?.status === "uploading" && (
              <span className="absolute inset-0 grid place-items-center bg-black/55 text-white">
                <Loader2 className="size-5 animate-spin" aria-hidden /><span className="sr-only">Envoi en cours</span>
              </span>
            )}
          </button>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Photo de profil ou logo <span className="font-normal text-muted">(facultatif)</span></p>
            <p className="text-[13px] text-muted">Carrée, 400 px minimum.</p>
            <button type="button" onClick={() => fileRef.current?.click()} className="mt-1 text-[13px] font-semibold text-gold-ink underline-offset-4 hover:underline">
              {draft.avatar ? "Changer" : "Choisir une image"}
            </button>
          </div>
          <input ref={fileRef} type="file" accept={PHOTO_ACCEPT} className="sr-only" tabIndex={-1}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void setAvatar(f); e.target.value = ""; }} />
        </div>

        <Field id="f-name" label="Nom de votre entreprise" error={errors.name}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} value={draft.name} maxLength={80} autoComplete="organization"
              onChange={(e) => update({ name: e.target.value, ...(slugTouched ? {} : { slug: slugify(e.target.value) }) })}
              placeholder="Studio Lumière Mbala" aria-describedby={describedBy} aria-invalid={invalid || undefined} />
          )}
        </Field>

        <Field id="f-slug" label="Adresse de votre page" error={errors.slug ?? (slugStatus === "taken" ? "Cette adresse est déjà prise." : undefined)}
          hint={slugStatus === "free" ? <span className="inline-flex items-center gap-1 text-success"><Check className="size-3.5" aria-hidden />Adresse disponible</span> : undefined}>
          {({ id, describedBy, invalid }) => (
            <div className="flex items-center rounded-xl border border-line-strong bg-surface focus-within:border-gold focus-within:ring-2 focus-within:ring-gold/40">
              <span className="shrink-0 pl-4 text-[15px] text-muted">{PUBLIC_HOST}/prestataires/</span>
              <input id={id} value={draft.slug} onChange={(e) => { setSlugTouched(true); update({ slug: slugify(e.target.value) }); }}
                className="h-12 w-full min-w-0 bg-transparent pr-4 text-[15px] outline-none" aria-describedby={describedBy} aria-invalid={invalid || undefined} />
              {slugStatus === "checking" && <Loader2 className="mr-3 size-4 shrink-0 animate-spin text-muted" aria-label="Vérification" />}
            </div>
          )}
        </Field>

        <Field id="f-tagline" label="Accroche" optional error={errors.tagline} counter={{ value: draft.tagline.length, max: 120 }}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} value={draft.tagline} maxLength={140} onChange={(e) => update({ tagline: e.target.value })}
              placeholder="Des images de mariage comme des couvertures de magazine" aria-describedby={describedBy} aria-invalid={invalid || undefined} />
          )}
        </Field>

        <Field id="f-bio" label="Présentation" error={errors.bio} counter={{ value: draft.bio.length, max: 3000 }}
          hint={bioLen < 200 ? `Encore ${200 - bioLen} caractères pour une bio complète.` : "Parfait, votre bio est assez détaillée."}>
          {({ id, describedBy, invalid }) => (
            <Textarea id={id} rows={5} value={draft.bio} onChange={(e) => update({ bio: e.target.value })} className="min-h-28"
              placeholder="Votre parcours, votre façon de travailler, ce qui vous rend unique…" aria-describedby={describedBy} aria-invalid={invalid || undefined} />
          )}
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="f-city" label="Ville principale" error={errors.city}>
            {({ id, describedBy, invalid }) => (
              <Select id={id} value={draft.city} onChange={(e) => update({ city: e.target.value })} aria-describedby={describedBy} aria-invalid={invalid || undefined}>
                {withCurrent(cities, draft.city).map((c) => <option key={c}>{c}</option>)}
              </Select>
            )}
          </Field>
          <Field id="f-zones" label="Zones d’intervention" error={errors.zones}>
            {({ id, describedBy, invalid }) => (
              <div className="relative">
                <Input id={id} value={zoneInput} onChange={(e) => setZoneInput(e.target.value)} list="zones-list" className="pr-12"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addZone(zoneInput); } }}
                  placeholder="Ex. : Kongo-Central" aria-describedby={describedBy} aria-invalid={invalid || undefined} />
                <datalist id="zones-list">{ZONE_SUGGESTIONS.map((z) => <option key={z} value={z} />)}</datalist>
                <button type="button" onClick={() => addZone(zoneInput)} className="absolute right-1.5 top-1.5 grid size-9 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-text" aria-label="Ajouter la zone">
                  <Plus className="size-4" aria-hidden />
                </button>
              </div>
            )}
          </Field>
        </div>
        <div className="-mt-2 flex flex-wrap gap-1.5">
          {draft.zones.map((z) => (
            <span key={z} className="inline-flex h-8 items-center gap-1 rounded-full bg-surface-2 pl-3 pr-1 text-[13px] font-medium">
              {z}
              <button type="button" onClick={() => update((d) => ({ zones: d.zones.filter((x) => x !== z) }))} className="grid size-6 place-items-center rounded-full hover:bg-line" aria-label={`Retirer ${z}`}>
                <X className="size-3" aria-hidden />
              </button>
            </span>
          ))}
          {draft.zones.length === 0 && ZONE_SUGGESTIONS.slice(0, 3).map((z) => (
            <button key={z} type="button" onClick={() => addZone(z)} className="inline-flex h-8 items-center gap-1 rounded-full border border-dashed border-line-strong px-3 text-[13px] text-muted hover:border-gold hover:text-text">
              <Plus className="size-3" aria-hidden />{z}
            </button>
          ))}
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Langues parlées</legend>
          <div className="flex flex-wrap gap-1.5">
            {LANGUAGES.map((l) => (
              <ToggleChip key={l} on={draft.languages.includes(l)}
                onClick={() => update((d) => ({ languages: d.languages.includes(l) ? d.languages.filter((x) => x !== l) : [...d.languages, l] }))}>
                {l}
              </ToggleChip>
            ))}
          </div>
          {errors.languages && <p role="alert" className="mt-2 text-[13px] font-medium text-danger">{errors.languages}</p>}
        </fieldset>
      </div>
      <StepFooter step="entreprise" disabled={slugStatus === "taken"} />
    </div>
  );
}
