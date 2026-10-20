"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useAnimationControls } from "motion/react";
import { MessageCircle, MessageSquareText, Mail, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DemoBanner } from "@/components/brand";
import { confirmedBySession, getPending, resendOtp, verifyOtp, type Channel, type Pending } from "@/lib/auth";
import { DEMO, EMAIL_CONFIRMATION } from "@/lib/config";
import { cn } from "@/lib/utils";

const LEN = 6;
const mask = (p: Pending) =>
  p.method === "email"
    ? p.email!.replace(/^(.{2}).*(@.*)$/, "$1•••$2")
    : p.phone!.replace(/^(\+\d{3})(\d{2})\d+(\d{2})$/, "$1 $2 ••• •• $3");

export function OtpForm() {
  const router = useRouter();
  const [pending, setPending] = useState<Pending | null>(null);
  const [digits, setDigits] = useState<string[]>(Array(LEN).fill(""));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(30);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const shake = useAnimationControls();

  useEffect(() => {
    const p = getPending();
    if (!p) { router.replace("/inscription"); return; }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture unique du stockage local au montage
    setPending(p);
    refs.current[0]?.focus();
  }, [router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function submit(code: string) {
    setBusy(true);
    setError("");
    const r = await verifyOtp(code);
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      void shake.start({ x: [0, -10, 10, -6, 6, 0], transition: { duration: 0.4 } });
      setDigits(Array(LEN).fill(""));
      // le fieldset est encore désactivé pendant ce rendu : on redonne le focus juste après
      setTimeout(() => refs.current[0]?.focus(), 30);
      return;
    }
    toast.success("Compte vérifié", { description: "Créons maintenant votre vitrine." });
    router.push("/onboarding/activite");
  }

  function setAt(i: number, v: string) {
    const clean = v.replace(/\D/g, "");
    if (!clean) { setDigits((d) => d.map((x, k) => (k === i ? "" : x))); return; }
    // collage d’un code complet
    const next = [...digits];
    clean.slice(0, LEN - i).split("").forEach((c, k) => (next[i + k] = c));
    setDigits(next);
    const pos = Math.min(i + clean.length, LEN - 1);
    refs.current[pos]?.focus();
    if (next.every(Boolean)) void submit(next.join(""));
  }

  async function resend(channel: Channel) {
    const r = await resendOtp(channel);
    if (!r.ok) { toast.error(r.error); return; }
    setPending((p) => (p ? { ...p, channel } : p));
    setCooldown(30);
    toast.success(channel === "whatsapp" ? "Nouveau code envoyé sur WhatsApp" : pending?.method === "email" ? (EMAIL_CONFIRMATION === "lien" && !DEMO ? "Nouvel e-mail envoyé" : "Nouveau code envoyé par e-mail") : "Nouveau code envoyé par SMS");
  }

  if (!pending) return <div className="skeleton h-80 rounded-3xl" aria-label="Chargement" />;
  if (pending.method === "email" && EMAIL_CONFIRMATION === "lien" && !DEMO)
    return <EmailLinkWait pending={pending} cooldown={cooldown} onResend={() => resend("sms")} />;
  const via = pending.method === "email" ? "par e-mail" : pending.channel === "whatsapp" ? "sur WhatsApp" : "par SMS";
  const Icon = pending.method === "email" ? Mail : pending.channel === "whatsapp" ? MessageCircle : MessageSquareText;

  return (
    <div className="grid gap-6">
      <div>
        <span className="mb-5 grid size-14 place-items-center rounded-2xl bg-gold/15 text-gold-ink"><Icon className="size-6" aria-hidden /></span>
        <h1 className="font-display text-[2.4rem] leading-[1.02]">Vérifiez votre <em className="text-gold-ink">{pending.method === "email" ? "adresse" : "numéro"}</em></h1>
        <p className="mt-2 text-[15px] text-muted">
          Saisissez le code à 6 chiffres envoyé {via} au <b className="text-text">{mask(pending)}</b>.
        </p>
      </div>
      <DemoBanner>Code : <b>123456</b>.</DemoBanner>

      <form onSubmit={(e) => { e.preventDefault(); if (digits.every(Boolean)) void submit(digits.join("")); }}>
        <fieldset disabled={busy}>
          <legend className="sr-only">Code de vérification à 6 chiffres</legend>
          <motion.div animate={shake} className="flex justify-between gap-2">
            {digits.map((d, i) => (
              <input key={i} ref={(el) => { refs.current[i] = el; }} value={d} inputMode="numeric" autoComplete={i === 0 ? "one-time-code" : "off"}
                maxLength={LEN} aria-label={`Chiffre ${i + 1} sur ${LEN}`} aria-invalid={!!error || undefined} aria-describedby={error ? "otp-err" : undefined}
                onChange={(e) => setAt(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus();
                  if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
                  if (e.key === "ArrowRight" && i < LEN - 1) refs.current[i + 1]?.focus();
                }}
                onFocus={(e) => e.target.select()}
                className={cn("font-display h-16 w-full min-w-0 rounded-2xl border bg-surface text-center text-3xl tabular-nums transition-colors focus-visible:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40",
                  error ? "border-danger" : d ? "border-gold/70" : "border-line-strong")} />
            ))}
          </motion.div>
        </fieldset>
        <p id="otp-err" role="alert" className="mt-3 min-h-5 text-[13px] font-medium text-danger">{error}</p>
        <Button type="submit" size="lg" className="mt-2 w-full" loading={busy} disabled={!digits.every(Boolean)}>Vérifier</Button>
      </form>

      <div className="grid gap-3 rounded-2xl border border-line p-4 text-sm">
        <p className="text-muted">Vous n’avez rien reçu ?</p>
        {cooldown > 0 ? (
          <p aria-live="polite">Nouvel envoi possible dans <b className="tabular-nums">{cooldown} s</b></p>
        ) : pending.method === "phone" ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => resend("whatsapp")}><MessageCircle aria-hidden />Renvoyer sur WhatsApp</Button>
            <Button variant="outline" size="sm" onClick={() => resend("sms")}><MessageSquareText aria-hidden />Renvoyer par SMS</Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="w-fit" onClick={() => resend("sms")}><Mail aria-hidden />Renvoyer l’e-mail</Button>
        )}
        <Link href="/inscription" className="w-fit font-semibold text-gold-ink underline-offset-4 hover:underline">Modifier mon numéro ou mon e-mail</Link>
      </div>
    </div>
  );
}

/**
 * Inscription par e-mail sans SMTP personnalisé : Supabase envoie un lien de confirmation.
 * Le lien ouvre /auth/callback (session + vitrine) ; cet écran détecte aussi la confirmation
 * faite dans un autre onglet du même navigateur.
 */
function EmailLinkWait({ pending, cooldown, onResend }: { pending: Pending; cooldown: number; onResend: () => void }) {
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [notYet, setNotYet] = useState(false);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      if (alive && (await confirmedBySession())) {
        toast.success("Adresse confirmée", { description: "Créons maintenant votre vitrine." });
        router.push("/onboarding/activite");
      }
    };
    const t = setInterval(check, 5000);
    window.addEventListener("focus", check);
    return () => { alive = false; clearInterval(t); window.removeEventListener("focus", check); };
  }, [router]);

  async function manualCheck() {
    setChecking(true);
    const ok = await confirmedBySession();
    setChecking(false);
    if (ok) router.push("/onboarding/activite");
    else setNotYet(true);
  }

  return (
    <div className="grid gap-6">
      <div>
        <span className="mb-5 grid size-14 place-items-center rounded-2xl bg-gold/15 text-gold-ink"><MailCheck className="size-6" aria-hidden /></span>
        <h1 className="font-display text-[2.4rem] leading-[1.02]">Confirmez votre <em className="text-gold-ink">adresse</em></h1>
        <p className="mt-2 text-[15px] text-muted">
          Nous avons envoyé un e-mail à <b className="text-text">{mask(pending)}</b>. Ouvrez-le et cliquez sur le lien de confirmation.
        </p>
      </div>

      <ol className="grid gap-2 rounded-2xl bg-surface-2 p-4 text-sm">
        <li>1. L’e-mail s’intitule « Confirm your email address » (vérifiez aussi les indésirables).</li>
        <li>2. Ouvrez le lien <b>sur cet appareil, dans ce navigateur</b> : vous arriverez directement sur votre vitrine.</li>
        <li>3. Ouvert ailleurs ? Votre adresse sera quand même confirmée : connectez-vous ensuite.</li>
      </ol>

      <div className="grid gap-2">
        <Button size="lg" className="w-full" loading={checking} onClick={manualCheck}>J’ai confirmé mon adresse</Button>
        <p role="status" className="min-h-5 text-[13px] text-muted">{notYet ? "Pas encore confirmée : cliquez sur le lien reçu, puis réessayez." : ""}</p>
      </div>

      <div className="grid gap-3 rounded-2xl border border-line p-4 text-sm">
        <p className="text-muted">Vous n’avez rien reçu ?</p>
        {cooldown > 0 ? (
          <p aria-live="polite">Nouvel envoi possible dans <b className="tabular-nums">{cooldown} s</b></p>
        ) : (
          <Button variant="outline" size="sm" className="w-fit" onClick={onResend}><Mail aria-hidden />Renvoyer l’e-mail</Button>
        )}
        <Link href="/connexion" className="w-fit font-semibold text-gold-ink underline-offset-4 hover:underline">J’ai déjà confirmé ailleurs : me connecter</Link>
        <Link href="/inscription" className="w-fit font-semibold text-gold-ink underline-offset-4 hover:underline">Modifier mon e-mail</Link>
      </div>
    </div>
  );
}
