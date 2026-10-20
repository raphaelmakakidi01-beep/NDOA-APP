"use client";

import { useEffect } from "react";
import { Field, Input } from "@/components/ui/field";
import { PhoneInput } from "@/components/auth/phone-input";
import { useOnboarding } from "@/lib/onboarding/store";
import { COUNTRY_CODES } from "@/lib/validation";
import { StepFooter, StepHeader } from "./step-ui";

const SOCIALS = [
  { key: "instagram", label: "Instagram", prefix: "@", placeholder: "studiolumiere" },
  { key: "tiktok", label: "TikTok", prefix: "@", placeholder: "studiolumiere" },
  { key: "facebook", label: "Facebook", prefix: "facebook.com/", placeholder: "studiolumiere" },
  { key: "youtube", label: "YouTube", prefix: "youtube.com/@", placeholder: "studiolumiere" },
] as const;

export function StepContacts() {
  const { draft, update, errors, user } = useOnboarding();
  const c = draft.contacts;
  const set = (patch: Partial<typeof c>) => update((d) => ({ contacts: { ...d.contacts, ...patch } }));

  // Préremplissage depuis le compte (téléphone ou e-mail d’inscription)
  useEffect(() => {
    const patch: Partial<typeof c> = {};
    if (!c.phone && user.phone) {
      const cc = COUNTRY_CODES.find((x) => user.phone!.startsWith(x.code));
      if (cc) { patch.country = cc.code; patch.phone = user.phone.slice(cc.code.length); }
    }
    if (!c.email && user.email && !user.email.endsWith("@gmail.com")) patch.email = user.email;
    if (Object.keys(patch).length) set(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-2xl">
      <StepHeader title={<>Comment vous <em className="text-gold-ink">joindre</em></>}
        lead="Les mariés écrivent surtout sur WhatsApp : vérifiez bien votre numéro." />

      <div className="grid gap-5">
        <Field id="f-phone" label="Téléphone professionnel" error={errors.phone}>
          {({ id, describedBy, invalid }) => (
            <PhoneInput id={id} country={c.country} onCountry={(v) => set({ country: v })} value={c.phone} onChange={(v) => set({ phone: v })} describedBy={describedBy} invalid={invalid} />
          )}
        </Field>

        <label className="-mt-2 flex cursor-pointer items-center gap-2.5 text-sm">
          <input type="checkbox" checked={c.whatsappSame} onChange={(e) => set({ whatsappSame: e.target.checked })} className="size-4 accent-[#C4975A]" />
          Ce numéro est aussi sur WhatsApp
        </label>

        {!c.whatsappSame && (
          <Field id="f-wa" label="Numéro WhatsApp" error={errors.whatsapp}>
            {({ id, describedBy, invalid }) => (
              <PhoneInput id={id} country={c.country} onCountry={(v) => set({ country: v })} value={c.whatsapp} onChange={(v) => set({ whatsapp: v })} describedBy={describedBy} invalid={invalid} />
            )}
          </Field>
        )}

        <Field id="f-email" label="E-mail de contact" optional error={errors.email}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} type="email" autoComplete="email" value={c.email} onChange={(e) => set({ email: e.target.value })} placeholder="contact@studio.cd" aria-describedby={describedBy} aria-invalid={invalid || undefined} />
          )}
        </Field>

        <fieldset className="mt-2 grid gap-4 border-t border-line pt-5 sm:grid-cols-2">
          <legend className="float-left mb-1 w-full text-sm font-semibold sm:col-span-2">Réseaux sociaux <span className="font-normal text-muted">(facultatif)</span></legend>
          {SOCIALS.map((s) => (
            <Field key={s.key} id={`f-${s.key}`} label={s.label} error={errors[s.key]}>
              {({ id, describedBy, invalid }) => (
                <div className="flex items-center rounded-xl border border-line-strong bg-surface focus-within:border-gold focus-within:ring-2 focus-within:ring-gold/40">
                  <span className="shrink-0 pl-4 text-[15px] text-muted">{s.prefix}</span>
                  <input id={id} value={c[s.key]} onChange={(e) => set({ [s.key]: e.target.value.trim() } as Partial<typeof c>)} placeholder={s.placeholder}
                    className="h-12 w-full min-w-0 bg-transparent pr-4 text-[15px] outline-none" aria-describedby={describedBy} aria-invalid={invalid || undefined} />
                </div>
              )}
            </Field>
          ))}
          <Field id="f-website" label="Site web" error={errors.website}>
            {({ id, describedBy, invalid }) => (
              <Input id={id} type="url" value={c.website} onChange={(e) => set({ website: e.target.value.trim() })} placeholder="https://www.studio.cd" aria-describedby={describedBy} aria-invalid={invalid || undefined} />
            )}
          </Field>
        </fieldset>
      </div>
      <StepFooter step="contacts" nextLabel="Voir l’aperçu" />
    </div>
  );
}
