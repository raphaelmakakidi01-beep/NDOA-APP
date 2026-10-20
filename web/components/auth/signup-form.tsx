"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { DemoBanner } from "@/components/brand";
import { PUBLIC_SITE_URL } from "@/lib/config";
import { GoogleButton, OrSeparator } from "./google-button";
import { PhoneInput } from "./phone-input";
import { signUp, type Channel } from "@/lib/auth";
import { passwordRules, signupSchema, toE164, toFieldErrors, type FieldErrors } from "@/lib/validation";
import { cn } from "@/lib/utils";

const linkCls = "font-semibold text-gold-ink underline-offset-4 hover:underline";

export function SignupForm() {
  const router = useRouter();
  const [method, setMethod] = useState<"email" | "phone">("phone");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("+243");
  const [phone, setPhone] = useState("");
  const [channel, setChannel] = useState<Channel>("whatsapp");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  const missing = passwordRules.filter((r) => !r.test(password));
  const strength = passwordRules.length - missing.length;

  const switchMethod = (m: "email" | "phone") => {
    setMethod(m);
    setErrors((e) => ({ ...e, email: undefined, phone: undefined }));
    setTimeout(() => document.getElementById(m === "email" ? "f-email" : "f-phone")?.focus(), 0);
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = signupSchema.safeParse({ fullName, method, email, country, phone, password, terms });
    if (!parsed.success) {
      const errs = toFieldErrors(parsed.error);
      setErrors(errs);
      document.getElementById(`f-${Object.keys(errs)[0]}`)?.focus();
      return;
    }
    setErrors({});
    setBusy(true);
    const r = await signUp({
      method, fullName: fullName.trim(), password, channel,
      email: method === "email" ? email.trim().toLowerCase() : undefined,
      phone: method === "phone" ? toE164(country, phone) : undefined,
    });
    setBusy(false);
    if (!r.ok) { toast.error(r.error); return; }
    router.push("/verification");
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <div className="mb-1">
        <h1 className="font-display text-[2rem] leading-[1.05] sm:text-[2.25rem]">Créez votre <em className="text-gold-ink">vitrine</em></h1>
        <p className="mt-1.5 text-[15px] text-muted">Gratuit et sans engagement.</p>
      </div>

      <GoogleButton />
      <OrSeparator />

      <Field id="f-fullName" label="Nom complet" error={errors.fullName}>
        {({ describedBy, invalid }) => (
          <Input id="f-fullName" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)}
            placeholder="Daniel Mbala" aria-describedby={describedBy} aria-invalid={invalid || undefined} />
        )}
      </Field>

      {method === "phone" ? (
        <div className="grid gap-1.5">
          <Field id="f-phone" label="Téléphone" error={errors.phone}>
            {({ describedBy, invalid }) => (
              <PhoneInput id="f-phone" country={country} onCountry={setCountry} value={phone} onChange={setPhone} describedBy={describedBy} invalid={invalid} />
            )}
          </Field>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[13px] text-muted">
            <span role="radiogroup" aria-label="Recevoir le code par" className="inline-flex items-center gap-1">
              Code par
              {(["whatsapp", "sms"] as const).map((c) => (
                <button key={c} type="button" role="radio" aria-checked={channel === c} onClick={() => setChannel(c)}
                  className={cn("rounded-full px-2.5 py-1 font-semibold transition-colors", channel === c ? "bg-gold/15 text-gold-ink" : "hover:text-text")}>
                  {c === "whatsapp" ? "WhatsApp" : "SMS"}
                </button>
              ))}
            </span>
            <button type="button" onClick={() => switchMethod("email")} className={linkCls}>Utiliser un e-mail</button>
          </div>
        </div>
      ) : (
        <div className="grid gap-1.5">
          <Field id="f-email" label="E-mail" error={errors.email}>
            {({ describedBy, invalid }) => (
              <Input id="f-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@studio.cd" aria-describedby={describedBy} aria-invalid={invalid || undefined} />
            )}
          </Field>
          <button type="button" onClick={() => switchMethod("phone")} className={cn(linkCls, "justify-self-end text-[13px]")}>Utiliser un téléphone</button>
        </div>
      )}

      <Field id="f-password" label="Mot de passe" error={errors.password}>
        {({ describedBy, invalid }) => (
          <div className="grid gap-2">
            <div className="relative">
              <Input id="f-password" type={show ? "text" : "password"} autoComplete="new-password" value={password}
                onChange={(e) => setPassword(e.target.value)} className="pr-12"
                aria-describedby={describedBy ? `${describedBy} pw-hint` : "pw-hint"} aria-invalid={invalid || undefined} />
              <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-1.5 top-1.5 grid size-9 place-items-center rounded-full text-muted hover:text-text"
                aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"} aria-pressed={show}>
                {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
              </button>
            </div>
            {password && (
              <div className="flex gap-1" aria-hidden>
                {passwordRules.map((_, i) => (
                  <span key={i} className={cn("h-1 flex-1 rounded-full transition-colors duration-300",
                    i < strength ? (strength <= 1 ? "bg-danger" : strength < 4 ? "bg-gold" : "bg-success") : "bg-line")} />
                ))}
              </div>
            )}
            {!errors.password && (
              <p id="pw-hint" className={cn("text-[13px]", password && !missing.length ? "text-success" : "text-muted")} aria-live="polite">
                {!password ? "8 caractères, une majuscule, un chiffre, un symbole."
                  : missing.length ? `Il manque : ${missing.map((r) => r.label.toLowerCase()).join(", ")}.` : "Mot de passe solide."}
              </p>
            )}
          </div>
        )}
      </Field>

      <div className="grid gap-1">
        <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-relaxed text-muted">
          <input id="f-terms" type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-[#C4975A]" aria-invalid={!!errors.terms || undefined} aria-describedby={errors.terms ? "terms-err" : undefined} />
          <span>J’accepte les <a href={`${PUBLIC_SITE_URL}/cgu.html`} target="_blank" rel="noopener" className={linkCls}>conditions</a> et la <a href={`${PUBLIC_SITE_URL}/confidentialite.html`} target="_blank" rel="noopener" className={linkCls}>politique de confidentialité</a>.</span>
        </label>
        {errors.terms && <p id="terms-err" role="alert" className="text-[13px] font-medium text-danger">{errors.terms}</p>}
      </div>

      <Button type="submit" size="lg" loading={busy} className="mt-1 w-full">Créer mon compte</Button>
      <p className="text-center text-sm text-muted">
        Déjà inscrit ? <Link href="/connexion" className={linkCls}>Se connecter</Link>
      </p>
      <DemoBanner className="justify-center">Code de vérification : <b>123456</b>.</DemoBanner>
    </form>
  );
}
