"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { DemoBanner } from "@/components/brand";
import { GoogleButton, OrSeparator } from "./google-button";
import { requestPasswordReset, signIn } from "@/lib/auth";
import { safeNext } from "@/lib/safe-redirect";

/** Accepte un e-mail ou un numéro (local RDC ou international) */
function normalizeIdentifier(v: string) {
  const t = v.trim();
  if (t.includes("@")) return t.toLowerCase();
  const d = t.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) return d;
  return `+243${d.replace(/^0+/, "")}`;
}

/** Bandeau d’erreur OAuth : seul composant qui lit l’URL, pour que le formulaire reste pré-rendu en HTML */
function OAuthError() {
  const params = useSearchParams();
  return params.get("erreur") === "oauth" ? (
    <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">La connexion Google a échoué. Réessayez ou utilisez votre mot de passe.</p>
  ) : null;
}

const nextFromUrl = () => safeNext(new URLSearchParams(location.search).get("suite"));

export function LoginForm() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!identifier.trim() || !password) { setError("Renseignez votre identifiant et votre mot de passe."); return; }
    setBusy(true);
    const r = await signIn({ identifier: normalizeIdentifier(identifier), password });
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    router.push(nextFromUrl());
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <div className="mb-1">
        <h1 className="font-display text-[2rem] leading-[1.05] sm:text-[2.25rem]">Bon retour <em className="text-gold-ink">parmi nous</em></h1>
        <p className="mt-1.5 text-[15px] text-muted">Retrouvez votre vitrine et vos demandes.</p>
      </div>
      <Suspense fallback={null}><OAuthError /></Suspense>
      <GoogleButton next={nextFromUrl} />
      <OrSeparator />
      <Field id="f-id" label="E-mail ou téléphone" error={error && !password ? error : undefined}>
        {({ id, describedBy, invalid }) => (
          <Input id={id} autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)}
            placeholder="vous@studio.cd ou 81 234 5678" aria-describedby={describedBy} aria-invalid={invalid || undefined} />
        )}
      </Field>
      <Field id="f-pw" label="Mot de passe">
        {({ id }) => (
          <div className="relative">
            <Input id={id} type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="pr-12" />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-1.5 top-1.5 grid size-9 place-items-center rounded-full text-muted hover:text-text"
              aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"} aria-pressed={show}>
              {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
            </button>
          </div>
        )}
      </Field>
      {error && password && <p role="alert" className="-mt-2 text-[13px] font-medium text-danger">{error}</p>}
      <div className="-mt-2 flex justify-end">
        <button type="button" className="text-sm font-semibold text-gold-ink underline-offset-4 hover:underline"
          onClick={async () => {
            if (!identifier.trim()) { setError("Saisissez d’abord votre e-mail ou votre téléphone."); return; }
            const r = await requestPasswordReset(normalizeIdentifier(identifier));
            if (r.ok) toast.success("Instructions envoyées", { description: "Consultez vos e-mails ou vos SMS." });
            else toast.error(r.error);
          }}>
          Mot de passe oublié ?
        </button>
      </div>
      <Button type="submit" size="lg" loading={busy} className="mt-1 w-full">Se connecter</Button>
      <p className="text-center text-sm text-muted">
        Pas encore de compte ? <Link href="/inscription" className="font-semibold text-gold-ink underline-offset-4 hover:underline">Créer ma vitrine</Link>
      </p>
      <DemoBanner className="justify-center">Utilisez l’identifiant choisi à l’inscription.</DemoBanner>
    </form>
  );
}
