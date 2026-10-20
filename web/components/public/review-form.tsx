"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { BadgeCheck, Check, Clock, Star } from "lucide-react";
import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/bits";
import { getSupabase } from "@/lib/supabase/client";
import { goldConfetti } from "@/lib/confetti";
import { uid, cn } from "@/lib/utils";
import type { EspaceData } from "@/lib/espace/types";

/* =========================================================
   Formulaire public de dépôt d’avis (lien unique, 60 jours)
   Démo : le lien est retrouvé dans les données locales du prestataire.
   ========================================================= */

type Info = { vendor: string; couple: string; weddingDate?: string; verified: boolean };
type State = { kind: "loading" } | { kind: "invalid" | "expired" | "used" } | { kind: "form"; info: Info } | { kind: "done"; info: Info };

function findDemo(token: string) {
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)!;
    if (!k.startsWith("eclat.espace.")) continue;
    try {
      const d = JSON.parse(localStorage.getItem(k)!) as EspaceData;
      const rq = d.reviewRequests?.find((r) => r.token === token);
      if (!rq) continue;
      const draft = JSON.parse(localStorage.getItem(k.replace("eclat.espace.", "eclat.onboarding.")) ?? "{}") as { name?: string };
      return { key: k, data: d, rq, vendor: draft.name ?? "votre prestataire" };
    } catch { /* données illisibles */ }
  }
  return null;
}

const LABELS = ["", "Décevant", "Moyen", "Bien", "Très bien", "Exceptionnel"];

export function ReviewForm({ token }: { token: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [names, setNames] = useState("");
  const [city, setCity] = useState("");
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const sb = getSupabase();
      let next: State;
      if (sb) {
        const { data } = await sb.rpc("review_request_info", { p_token: token });
        const r = (data as { vendor_name: string; couple: string; wedding_date: string | null; expired: boolean; used: boolean }[] | null)?.[0];
        next = !r ? { kind: "invalid" } : r.used ? { kind: "used" } : r.expired ? { kind: "expired" } : { kind: "form", info: { vendor: r.vendor_name, couple: r.couple, weddingDate: r.wedding_date ?? undefined, verified: !!r.wedding_date } };
      } else {
        await new Promise((res) => setTimeout(res, 400));
        const f = findDemo(token);
        const q = f?.rq.inquiryId ? f.data.inquiries.find((x) => x.id === f.rq.inquiryId) : undefined;
        next = !f ? { kind: "invalid" } : f.rq.usedAt ? { kind: "used" } : new Date(f.rq.expiresAt) < new Date() ? { kind: "expired" }
          : { kind: "form", info: { vendor: f.vendor, couple: f.rq.couple, weddingDate: q?.weddingDate, verified: q?.status === "confirmed" } };
      }
      if (!alive) return;
      setState(next);
      if (next.kind === "form") setNames(next.info.couple);
    })();
    return () => { alive = false; };
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state.kind !== "form") return;
    const err: Record<string, string> = {};
    if (!rating) err.rating = "Choisissez une note de 1 à 5 étoiles.";
    if (names.trim().length < 3) err.names = "Indiquez vos prénoms.";
    if (text.trim().length < 20) err.text = `Encore ${20 - text.trim().length} caractères minimum : racontez-nous un moment.`;
    setErrors(err);
    if (Object.keys(err).length) { document.getElementById(`rv-${Object.keys(err)[0]}`)?.focus(); return; }
    setBusy(true);
    const sb = getSupabase();
    if (sb) {
      const { error } = await sb.rpc("submit_review", { p_token: token, p_names: names.trim(), p_rating: rating, p_body: text.trim(), p_city: city.trim() || null });
      if (error) { setBusy(false); setErrors({ text: error.message.includes("USED") ? "Ce lien a déjà été utilisé." : "L’envoi a échoué. Vérifiez votre connexion et réessayez." }); return; }
    } else {
      await new Promise((res) => setTimeout(res, 700));
      const f = findDemo(token);
      if (f) {
        const q = f.rq.inquiryId ? f.data.inquiries.find((x) => x.id === f.rq.inquiryId) : undefined;
        const now = new Date().toISOString();
        const d: EspaceData = {
          ...f.data,
          reviews: [{ id: uid(), names: names.trim(), photo: "", rating, text: text.trim(), weddingDate: q?.weddingDate ?? "", city: city.trim() || q?.city, createdAt: now, status: "published", verified: q?.status === "confirmed", inquiryId: q?.id }, ...f.data.reviews],
          reviewRequests: f.data.reviewRequests.map((r) => (r.token === token ? { ...r, usedAt: now } : r)),
          notifications: [{ id: uid(), type: "new_review", title: `Nouvel avis ${rating} étoile${rating > 1 ? "s" : ""}`, body: `${names.trim()} vous ont laissé un avis`, link: "/espace/avis", read: false, createdAt: now }, ...f.data.notifications],
        };
        localStorage.setItem(f.key, JSON.stringify(d));
      }
    }
    setBusy(false);
    setState({ kind: "done", info: state.info });
    if (rating >= 4) goldConfetti();
  };

  const shown = hover || rating;

  return (
    <div className="min-h-dvh bg-bg">
      <header className="mx-auto flex max-w-xl items-center px-4 py-6"><Logo href="/" /></header>
      <main id="contenu" className="mx-auto max-w-xl px-4 pb-16">
        {state.kind === "loading" && (
          <div className="grid gap-4" aria-busy="true" aria-label="Chargement"><Skeleton className="h-12 w-3/4" /><Skeleton className="h-6 w-1/2" /><Skeleton className="h-80 rounded-3xl" /></div>
        )}
        {(state.kind === "invalid" || state.kind === "expired" || state.kind === "used") && (
          <div className="rounded-3xl border border-line bg-surface p-8 text-center">
            <span className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-gold/12 text-gold-ink">{state.kind === "used" ? <Check className="size-6" aria-hidden /> : <Clock className="size-6" aria-hidden />}</span>
            <h1 className="font-display text-3xl">{state.kind === "used" ? "Merci, votre avis est déjà publié" : state.kind === "expired" ? "Ce lien a expiré" : "Lien introuvable"}</h1>
            <p className="mt-3 text-muted">{state.kind === "used" ? "Chaque lien ne peut servir qu’une fois." : "Demandez un nouveau lien à votre prestataire : il le crée en un clic depuis son espace."}</p>
          </div>
        )}
        {state.kind === "done" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-3xl border border-line bg-surface p-8 text-center" role="status">
            <span className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-gold text-on-gold"><Check className="size-7" aria-hidden /></span>
            <h1 className="font-display text-3xl">Merci {state.info.couple.split(/\s*&\s*/)[0]} !</h1>
            <p className="mt-3 text-muted">Votre avis est publié sur la vitrine de {state.info.vendor}. Il aidera d’autres couples à préparer leur grand jour.</p>
            <Button asChild variant="outline" className="mt-6"><Link href="/">Découvrir NDOA Wedding</Link></Button>
          </motion.div>
        )}
        {state.kind === "form" && (
          <>
            <h1 className="font-display text-[2.2rem] leading-tight">Comment s’est passé votre mariage avec <em className="text-gold-ink">{state.info.vendor}</em> ?</h1>
            <p className="mt-3 flex flex-wrap items-center gap-2 text-muted">
              Deux minutes, et votre expérience guidera d’autres mariés.
              {state.info.verified && <span className="inline-flex items-center gap-1 text-sm font-semibold text-gold-ink"><BadgeCheck className="size-4" aria-hidden />Avis vérifié</span>}
            </p>
            <form onSubmit={submit} noValidate className="mt-8 grid gap-6 rounded-3xl border border-line bg-surface p-5 sm:p-7">
              <fieldset>
                <legend className="mb-3 text-sm font-semibold">Votre note</legend>
                <div id="rv-rating" tabIndex={-1} className="flex flex-wrap items-center gap-1 outline-none" onMouseLeave={() => setHover(0)}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <label key={n} className="cursor-pointer rounded-xl p-1 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold/60" onMouseEnter={() => setHover(n)}>
                      <input type="radio" name="rating" value={n} checked={rating === n} onChange={() => { setRating(n); setErrors((x) => ({ ...x, rating: "" })); }} className="sr-only" aria-label={`${n} étoile${n > 1 ? "s" : ""} : ${LABELS[n]}`} />
                      <Star className={cn("size-10 transition-transform", n <= shown ? "fill-gold text-gold" : "text-line-strong", n === hover && "scale-110")} aria-hidden />
                    </label>
                  ))}
                  <span className="ml-2 text-sm font-semibold text-gold-ink" aria-live="polite">{LABELS[shown]}</span>
                </div>
                {errors.rating && <p role="alert" className="mt-2 text-[13px] font-medium text-danger">{errors.rating}</p>}
              </fieldset>
              <Field id="rv-names" label="Vos prénoms" error={errors.names}>
                {(a) => <Input id={a.id} aria-invalid={a.invalid} aria-describedby={a.describedBy} value={names} maxLength={80} onChange={(e) => setNames(e.target.value)} autoComplete="name" />}
              </Field>
              <Field id="rv-text" label="Votre avis" error={errors.text} counter={{ value: text.length, max: 2000 }} hint="Ce qui vous a marqués, l’équipe, le résultat. Restez bienveillants, même pour une critique.">
                {(a) => <Textarea id={a.id} aria-invalid={a.invalid} aria-describedby={a.describedBy} value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} className="min-h-40" />}
              </Field>
              <Field id="rv-city" label="Ville du mariage" optional>
                {(a) => <Input id={a.id} value={city} maxLength={60} onChange={(e) => setCity(e.target.value)} placeholder="Ex. Kinshasa" />}
              </Field>
              <p className="text-[13px] text-muted">Votre avis sera public, avec vos prénoms. Il ne pourra plus être modifié ; le prestataire pourra y répondre.</p>
              <Button type="submit" size="lg" loading={busy}>Publier mon avis</Button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
