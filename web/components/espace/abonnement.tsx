"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { AlertTriangle, BadgeCheck, Check, CreditCard, Download, ExternalLink, Loader2, Minus, Receipt, ShieldCheck, Smartphone, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, inputClass } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { Card, CardHeader, EmptyState, Skeleton, StatusTag, dateFr } from "@/components/ui/bits";
import { useEspace } from "@/lib/espace/store";
import { useAccount } from "@/lib/espace/business5";
import { downloadBlob } from "@/lib/espace/quote-pdf";
import { invoicePdf } from "@/lib/espace/invoice-pdf";
import { remote5 } from "@/lib/espace/remote-step5";
import { mobileMoneyError, payments } from "@/lib/espace/payments";
import { goldConfetti } from "@/lib/confetti";
import { getSupabase } from "@/lib/supabase/client";
import { OFFERS, PAYMENT_METHODS, PLANS, PLAN_MAX_PACKAGES, offerPrice, type Currency, type Invoice, type PaymentMethod, type PlanId } from "@/lib/espace/types";
import { cn, formatBytes, formatPrice } from "@/lib/utils";

const ORDER: PlanId[] = ["free", "pro", "prestige"];
const STATUS = {
  trialing: { label: "Essai gratuit", tone: "gold" as const },
  active: { label: "Actif", tone: "success" as const },
  past_due: { label: "Paiement en retard", tone: "danger" as const },
  canceled: { label: "Résilié", tone: "muted" as const },
};
const INVOICE_STATUS: Record<Invoice["status"], { label: string; tone: "success" | "danger" | "gold" | "muted" }> = {
  paid: { label: "Payée", tone: "success" }, failed: { label: "Échec", tone: "danger" }, pending: { label: "En attente", tone: "gold" }, refunded: { label: "Remboursée", tone: "muted" },
};

function features(p: PlanId) {
  const L = PLANS[p], O = OFFERS[p];
  return [
    { label: `${L.maxPhotos} photos`, on: true },
    { label: L.maxVideos ? `${L.maxVideos} vidéos (jusqu’à ${L.maxVideoMb} Mo)` : "Vidéos", on: L.maxVideos > 0 },
    { label: `${PLAN_MAX_PACKAGES[p] >= 99 ? "Forfaits illimités" : `${PLAN_MAX_PACKAGES[p]} forfait${PLAN_MAX_PACKAGES[p] > 1 ? "s" : ""}`}`, on: true },
    { label: "Stories et à la une", on: L.stories },
    { label: "Statistiques avancées", on: O.advancedStats },
    { label: "Badge « Vérifié »", on: O.verified },
    { label: "Mise en avant dans « Nos recommandations »", on: O.recommended },
    { label: `${O.seats} place${O.seats > 1 ? "s" : ""} dans l’équipe`, on: true },
  ];
}

/* ---------------------------------------------------------
   Paiement : choix du moyen → confirmation → résultat
   --------------------------------------------------------- */
type Step = { kind: "form" } | { kind: "phone"; ref: string } | { kind: "card"; ref: string; url: string } | { kind: "done"; invoice?: Invoice } | { kind: "failed"; reason: string };

function Checkout({ plan, months, currency, onClose }: { plan: PlanId; months: 1 | 12; currency: Currency; onClose: () => void }) {
  const { data, vendor } = useEspace();
  const acc = useAccount();
  const [method, setMethod] = useState<PaymentMethod>(data.subscription.method && data.subscription.method !== "card" ? data.subscription.method : "mpesa");
  const [phone, setPhone] = useState("");
  const [err, setErr] = useState("");
  const [step, setStep] = useState<Step>({ kind: "form" });
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(120);
  const amount = offerPrice(plan, currency, months);
  const mm = method !== "card";
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  // Valeurs lues pendant l’attente sans relancer le minuteur à chaque mise à jour des données
  const live = useRef({ acc, method, phone });
  useLayoutEffect(() => { live.current = { acc, method, phone }; });

  // Attente de la confirmation (push USSD) : interrogation du statut toutes les 1,5 s, 2 minutes maximum
  useEffect(() => {
    if (step.kind !== "phone" && step.kind !== "card") return;
    const started = Date.now();
    timer.current = setInterval(async () => {
      const left = 120 - Math.round((Date.now() - started) / 1000);
      setSeconds(left);
      const st = await payments().status(step.ref);
      if (st === "paid") {
        clearInterval(timer.current!);
        const { acc, method, phone } = live.current;
        const account = method !== "card" ? `•••• ${phone.replace(/\D/g, "").slice(-4).replace(/(\d{2})(\d{2})/, "$1 $2")}` : undefined;
        const invoice = getSupabase() ? undefined : acc.activate(plan, months, currency, method, account);
        setStep({ kind: "done", invoice });
        goldConfetti();
      } else if (st === "failed" || st === "expired" || left <= 0) {
        clearInterval(timer.current!);
        setStep({ kind: "failed", reason: st === "failed" ? "Le paiement a été refusé ou annulé sur le téléphone." : "Aucune confirmation reçue à temps." });
      }
    }, 1500);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [step, plan, months, currency]);

  const pay = async () => {
    const local = phone.replace(/\D/g, "").replace(/^0/, "");
    if (mm) { const e = mobileMoneyError(method, local, PAYMENT_METHODS[method].prefix); if (e) { setErr(e); document.getElementById("mm-phone")?.focus(); return; } }
    setBusy(true);
    const r = await payments().start({ plan, months, currency, method, phone: mm ? `+243${local}` : undefined });
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    setSeconds(120);
    if (r.next === "redirect") {
      if (r.url.startsWith("http")) { location.href = r.url; return; }
      setStep({ kind: "card", ref: r.ref, url: r.url });
    } else setStep({ kind: "phone", ref: r.ref });
  };

  const download = async (inv: Invoice) => downloadBlob(await invoicePdf(inv, vendor), `Facture-${inv.number}.pdf`);
  const closable = step.kind !== "phone" && step.kind !== "card";

  return (
    <Dialog open onOpenChange={(o) => { if (!o && closable) onClose(); }}
      title={step.kind === "done" ? `Bienvenue dans l’offre ${PLANS[plan].name}` : step.kind === "failed" ? "Paiement non abouti" : `Passer à l’offre ${PLANS[plan].name}`}
      description={step.kind === "form" ? `${months === 12 ? "12 mois, dont 2 offerts" : "1 mois, sans engagement"} · ${formatPrice(amount, currency)}` : undefined}
      footer={
        step.kind === "form" ? <><Button variant="ghost" onClick={onClose}>Annuler</Button><Button onClick={pay} loading={busy}>{mm ? <Smartphone aria-hidden /> : <CreditCard aria-hidden />}Payer {formatPrice(amount, currency)}</Button></>
        : step.kind === "failed" ? <><Button variant="ghost" onClick={onClose}>Fermer</Button><Button onClick={() => setStep({ kind: "form" })}>Réessayer</Button></>
        : step.kind === "done" ? <Button onClick={onClose}>Continuer</Button>
        : <Button variant="ghost" onClick={() => { if (timer.current) clearInterval(timer.current); setStep({ kind: "form" }); }}>Annuler le paiement</Button>
      }>
      {step.kind === "form" && (
        <div className="grid gap-5">
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Moyen de paiement</legend>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(PAYMENT_METHODS) as PaymentMethod[]).map((m) => (
                <label key={m} className="flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border border-line px-3.5 py-2.5 text-sm font-semibold has-[:checked]:border-gold has-[:checked]:bg-gold/8 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold/40">
                  <input type="radio" name="method" className="sr-only" checked={method === m} onChange={() => { setMethod(m); setErr(""); }} />
                  <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg text-[11px] font-black", m === "mpesa" ? "bg-[#e60000] text-white" : m === "orange_money" ? "bg-[#ff7900] text-black" : m === "airtel_money" ? "bg-[#ed1c24] text-white" : "bg-surface-2 text-text")} aria-hidden>
                    {m === "card" ? <CreditCard className="size-4" /> : m === "mpesa" ? "M" : m === "orange_money" ? "OM" : "A"}
                  </span>
                  <span className="leading-tight">{PAYMENT_METHODS[m].short}</span>
                  {method === m && <Check className="ml-auto size-4 text-gold-ink" aria-hidden />}
                </label>
              ))}
            </div>
          </fieldset>
          {mm ? (
            <Field id="mm-phone" label={`Numéro ${PAYMENT_METHODS[method].short}`} error={err} hint="Vous recevrez une demande de confirmation sur ce téléphone.">
              {(a) => (
                <div className="flex gap-2">
                  <span className={cn(inputClass, "grid w-20 shrink-0 place-items-center px-0 font-semibold text-muted")} aria-hidden>+243</span>
                  <input id={a.id} aria-describedby={a.describedBy} aria-invalid={a.invalid} inputMode="tel" autoComplete="tel-national" value={phone} maxLength={13} placeholder={`${PAYMENT_METHODS[method].prefix?.[0]} 123 4567`}
                    onChange={(e) => { setPhone(e.target.value.replace(/[^\d\s]/g, "")); setErr(""); }} className={inputClass} />
                </div>
              )}
            </Field>
          ) : (
            <p className="flex gap-3 rounded-2xl bg-surface-2 p-4 text-sm"><ShieldCheck className="size-5 shrink-0 text-gold-ink" aria-hidden />Vous allez être redirigé vers la page sécurisée de notre partenaire de paiement. NDOA ne voit ni ne stocke jamais vos données de carte.</p>
          )}
          {!mm && err && <p role="alert" className="text-sm font-medium text-danger">{err}</p>}
          <dl className="grid gap-2 rounded-2xl border border-line p-4 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Offre</dt><dd className="font-semibold">{PLANS[plan].name}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Durée</dt><dd>{months === 12 ? "12 mois (2 offerts)" : "1 mois"}</dd></div>
            <div className="flex justify-between border-t border-line pt-2"><dt className="font-semibold">Total</dt><dd className="font-display text-xl tabular-nums text-gold-ink">{formatPrice(amount, currency)}</dd></div>
          </dl>
          {!getSupabase() && <p className="text-[13px] text-muted">Mode démo : aucun débit. Un numéro finissant par 00 simule un refus.</p>}
        </div>
      )}

      {(step.kind === "phone" || step.kind === "card") && (
        <div className="grid justify-items-center gap-4 py-4 text-center" role="status" aria-live="polite">
          <motion.span className="grid size-20 place-items-center rounded-3xl bg-gold/15 text-gold-ink" animate={{ y: [0, -6, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}>
            {step.kind === "phone" ? <Smartphone className="size-9" aria-hidden /> : <ExternalLink className="size-9" aria-hidden />}
          </motion.span>
          <p className="font-display text-2xl">{step.kind === "phone" ? "Confirmez sur votre téléphone" : "Finalisez sur la page sécurisée"}</p>
          <p className="max-w-sm text-sm text-muted">
            {step.kind === "phone" ? `Un message ${PAYMENT_METHODS[method].short} vient d’arriver sur le +243 ${phone}. Saisissez votre code secret pour valider ${formatPrice(amount, currency)}.` : "Une fois le paiement validé chez notre partenaire, votre offre s’active automatiquement."}
          </p>
          <p className="inline-flex items-center gap-2 text-sm font-semibold tabular-nums"><Loader2 className="size-4 animate-spin" aria-hidden />En attente · {Math.floor(Math.max(0, seconds) / 60)}:{String(Math.max(0, seconds) % 60).padStart(2, "0")}</p>
        </div>
      )}

      {step.kind === "done" && (
        <div className="grid justify-items-center gap-4 py-4 text-center" role="status">
          <span className="grid size-16 place-items-center rounded-full bg-gold text-on-gold"><Check className="size-8" aria-hidden /></span>
          <p className="max-w-sm text-muted">Paiement confirmé. Vos nouvelles limites s’appliquent dès maintenant{OFFERS[plan].verified ? ", et le badge « Vérifié » apparaît sur votre vitrine" : ""}.</p>
          {step.invoice && <Button variant="outline" size="sm" onClick={() => download(step.invoice!)}><Download aria-hidden />Facture {step.invoice.number}</Button>}
        </div>
      )}

      {step.kind === "failed" && (
        <div className="grid justify-items-center gap-3 py-4 text-center" role="alert">
          <span className="grid size-16 place-items-center rounded-full bg-danger/12 text-danger"><X className="size-8" aria-hidden /></span>
          <p className="max-w-sm text-muted">{step.reason} Aucun montant n’a été prélevé. Vérifiez votre solde et réessayez.</p>
        </div>
      )}
    </Dialog>
  );
}

/* ---------------------------------------------------------
   Page
   --------------------------------------------------------- */
export function Abonnement() {
  const { data, vendor, usage } = useEspace();
  const acc = useAccount();
  const sub = data.subscription;
  const [months, setMonths] = useState<"1" | "12">("1");
  const [currency, setCurrency] = useState<Currency>(sub.currency);
  const [checkout, setCheckout] = useState<PlanId | null>(null);
  const [confirmDown, setConfirmDown] = useState(false);
  const plan = PLANS[data.plan];
  const lastFailed = data.invoices.find((i) => i.status === "failed");
  const failedRecent = lastFailed && !data.invoices.some((i) => i.status === "paid" && i.createdAt > lastFailed.createdAt);

  const gauges = [
    { label: "Photos", used: usage.photos, max: plan.maxPhotos, fmt: String },
    { label: "Vidéos", used: usage.videos, max: plan.maxVideos, fmt: String },
    { label: "Stockage", used: usage.bytes, max: plan.storageMb * 1024 * 1024, fmt: formatBytes },
    { label: "Forfaits", used: data.packages.length, max: PLAN_MAX_PACKAGES[data.plan], fmt: String },
    { label: "Équipe", used: acc.activeMembers, max: acc.seats, fmt: String },
  ];
  const overFree = usage.photos > PLANS.free.maxPhotos || usage.videos > 0 || data.packages.length > 1;

  const download = async (inv: Invoice) => {
    const url = await remote5.invoiceUrl(vendor.vendorId, inv.id);
    if (url) { window.open(url, "_blank", "noopener"); return; }
    try { downloadBlob(await invoicePdf(inv, vendor), `Facture-${inv.number}.pdf`); } catch { toast.error("La facture n’a pas pu être générée."); }
  };

  return (
    <div className="grid grid-cols-1 gap-8">
      <div>
        <h1 className="font-display text-[2.1rem] leading-tight sm:text-5xl"><em className="text-gold-ink">Abonnement</em></h1>
        <p className="mt-1 text-muted">Votre offre, vos limites, vos factures. Paiement par Mobile Money ou par carte.</p>
      </div>

      {failedRecent && (
        <p role="alert" className="flex flex-wrap items-center gap-3 rounded-2xl border border-danger/40 bg-danger/8 px-4 py-3 text-sm">
          <AlertTriangle className="size-4 text-danger" aria-hidden />Le paiement du {dateFr(lastFailed!.createdAt)} a échoué. Mettez à jour votre moyen de paiement pour garder vos avantages.
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => setCheckout(data.plan === "free" ? "pro" : data.plan)}>Régler maintenant</Button>
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card aria-labelledby="cur-h">
          <p className="text-sm text-muted">Offre actuelle</p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h2 id="cur-h" className="font-display text-4xl">{plan.name}</h2>
            <StatusTag tone={STATUS[sub.status].tone}>{STATUS[sub.status].label}</StatusTag>
            {OFFERS[data.plan].verified && <span className="inline-flex items-center gap-1 text-sm font-semibold text-gold-ink"><BadgeCheck className="size-4" aria-hidden />Vérifié</span>}
          </div>
          {data.plan === "free" ? (
            <p className="mt-3 text-sm text-muted">Gratuit, pour toujours. Passez à Pro pour les vidéos, les stories et les statistiques avancées.</p>
          ) : (
            <p className="mt-3 text-sm text-muted">
              {sub.cancelAtPeriodEnd ? <>Se termine le <strong className="text-text">{dateFr(sub.periodEnd!, { day: "numeric", month: "long", year: "numeric" })}</strong>, puis passage à l’offre Gratuit.</>
                : <>Renouvellement le <strong className="text-text">{sub.periodEnd ? dateFr(sub.periodEnd, { day: "numeric", month: "long", year: "numeric" }) : "—"}</strong> · {formatPrice(OFFERS[data.plan].price[sub.currency], sub.currency)}{sub.method && <> par <span className="whitespace-nowrap">{PAYMENT_METHODS[sub.method].short}{sub.account ? ` ${sub.account}` : ""}</span></>}</>}
            </p>
          )}
          {data.plan !== "free" && (
            <div className="mt-5 flex flex-wrap gap-2">
              {sub.cancelAtPeriodEnd
                ? <Button size="sm" onClick={() => acc.setCancel(false)}>Réactiver le renouvellement</Button>
                : <Button size="sm" variant="ghost" className="text-muted" onClick={() => setConfirmDown(true)}>Arrêter le renouvellement</Button>}
            </div>
          )}
        </Card>

        <Card aria-labelledby="use-h">
          <CardHeader id="use-h" title="Utilisation" sub={`Limites de l’offre ${plan.name}`} />
          <ul className="grid gap-4 sm:grid-cols-2">
            {gauges.map((g) => {
              const p = g.max ? Math.min(100, (g.used / g.max) * 100) : 100;
              return (
                <li key={g.label}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[13px]"><span className="text-muted">{g.label}</span><span className="font-semibold tabular-nums">{g.max ? `${g.fmt(g.used)} / ${g.max >= 99 && g.label === "Forfaits" ? "∞" : g.fmt(g.max)}` : "Non inclus"}</span></div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-label={g.label} aria-valuenow={Math.round(p)} aria-valuemin={0} aria-valuemax={100}>
                    <motion.div className={cn("h-full rounded-full", !g.max ? "bg-line-strong" : p >= 90 ? "bg-danger" : p >= 75 ? "bg-rose" : "bg-gold")} initial={{ width: 0 }} animate={{ width: `${p}%` }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <section aria-labelledby="offers-h" className="grid grid-cols-1 gap-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="offers-h" className="font-display text-3xl">Les offres</h2>
            <p className="mt-1 text-sm text-muted">Changez quand vous voulez. Le passage à une offre supérieure est immédiat.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Segmented layoutId="bill-months" label="Durée" value={months} onChange={setMonths} options={[{ value: "1", label: "Mensuel" }, { value: "12", label: <>Annuel <span className="text-xs opacity-80">−2 mois</span></> }]} />
            <Segmented layoutId="bill-cur" label="Devise" value={currency} onChange={setCurrency} options={[{ value: "USD", label: "USD" }, { value: "CDF", label: "CDF" }]} />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {ORDER.map((p) => {
            const current = p === data.plan;
            const higher = ORDER.indexOf(p) > ORDER.indexOf(data.plan);
            const price = offerPrice(p, currency, Number(months) as 1 | 12);
            const featured = p === "pro";
            return (
              <article key={p} className={cn("relative flex flex-col rounded-3xl border bg-surface p-6", featured ? "border-gold shadow-[0_0_0_1px_var(--color-gold)]" : "border-line")}>
                {featured && <StatusTag tone="gold" className="absolute -top-3 left-6 bg-gold text-on-gold">Le plus choisi</StatusTag>}
                <h3 className="font-display text-2xl">{PLANS[p].name}</h3>
                <p className="mt-1 min-h-10 text-sm text-muted">{OFFERS[p].pitch}</p>
                <p className="mt-4 flex items-baseline gap-1.5">
                  <span className="font-display text-4xl tabular-nums">{price ? formatPrice(price, currency) : "0"}</span>
                  <span className="text-sm text-muted">{p === "free" ? "pour toujours" : months === "12" ? "/ an" : "/ mois"}</span>
                </p>
                {months === "12" && price > 0 && <p className="text-[13px] text-success">soit {formatPrice(Math.round(price / 12), currency)} / mois</p>}
                <ul className="mt-5 grid gap-2.5 text-sm">
                  {features(p).map((f) => (
                    <li key={f.label} className={cn("flex gap-2.5", !f.on && "text-muted")}>
                      {f.on ? <Check className="mt-0.5 size-4 shrink-0 text-gold-ink" aria-hidden /> : <Minus className="mt-0.5 size-4 shrink-0" aria-hidden />}
                      <span>{!f.on && <span className="sr-only">Non inclus : </span>}{f.label}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-6">
                  {current ? <Button variant="subtle" className="w-full" disabled>Offre actuelle</Button>
                    : p === "free" ? <Button variant="outline" className="w-full" onClick={() => setConfirmDown(true)} disabled={sub.cancelAtPeriodEnd}>{sub.cancelAtPeriodEnd ? "Prévu en fin de période" : "Revenir à Gratuit"}</Button>
                    : <Button variant={higher ? "gold" : "outline"} className="w-full" onClick={() => setCheckout(p)}>{higher ? <><Sparkles aria-hidden />Passer à {PLANS[p].name}</> : `Passer à ${PLANS[p].name}`}</Button>}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <Card aria-labelledby="inv-h">
        <CardHeader id="inv-h" title="Factures" sub="Téléchargez-les en PDF pour votre comptabilité." />
        {data.invoices.length === 0 ? (
          <EmptyState icon={<Receipt />} title="Aucune facture" className="py-8">Vos factures apparaîtront ici après votre premier paiement.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted"><th className="py-2 font-semibold">Facture</th><th className="py-2 font-semibold">Offre</th><th className="py-2 font-semibold">Moyen</th><th className="py-2 text-right font-semibold">Montant</th><th className="py-2 pl-4 font-semibold">Statut</th><th className="py-2"><span className="sr-only">Télécharger</span></th></tr></thead>
              <tbody>
                {data.invoices.map((i) => (
                  <tr key={i.id} className="border-b border-line/70 last:border-0">
                    <td className="py-3"><span className="font-semibold">{i.number}</span><span className="block text-[13px] text-muted">{dateFr(i.createdAt, { day: "numeric", month: "short", year: "numeric" })}</span></td>
                    <td className="py-3">{PLANS[i.plan].name}<span className="block text-[13px] text-muted">{dateFr(i.periodStart, { day: "numeric", month: "short" })} – {dateFr(i.periodEnd, { day: "numeric", month: "short", year: "numeric" })}</span></td>
                    <td className="py-3">{PAYMENT_METHODS[i.method].short}</td>
                    <td className="py-3 text-right font-semibold tabular-nums">{formatPrice(i.amount, i.currency)}</td>
                    <td className="py-3 pl-4"><StatusTag tone={INVOICE_STATUS[i.status].tone}>{INVOICE_STATUS[i.status].label}</StatusTag></td>
                    <td className="py-3 text-right">{i.status !== "failed" && <button type="button" onClick={() => download(i)} className="inline-grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-text" aria-label={`Télécharger la facture ${i.number}`}><Download className="size-4" aria-hidden /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {checkout && <Checkout key={checkout} plan={checkout} months={Number(months) as 1 | 12} currency={currency} onClose={() => setCheckout(null)} />}
      <Dialog open={confirmDown} onOpenChange={setConfirmDown} title="Arrêter le renouvellement ?"
        description={sub.periodEnd ? `Vous gardez l’offre ${plan.name} jusqu’au ${dateFr(sub.periodEnd, { day: "numeric", month: "long" })}. Ensuite, votre vitrine passe à l’offre Gratuit.` : undefined}
        footer={<><Button variant="ghost" onClick={() => setConfirmDown(false)}>Garder mon offre</Button><Button variant="danger" onClick={() => { void acc.setCancel(true); setConfirmDown(false); }}>Arrêter le renouvellement</Button></>}>
        <ul className="grid gap-2 text-sm">
          <li className="flex gap-2.5"><X className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />Badge « Vérifié » et statistiques avancées retirés</li>
          {overFree && <li className="flex gap-2.5"><X className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />Seuls vos {PLANS.free.maxPhotos} premières photos et votre premier forfait resteront visibles ; les vidéos seront masquées (rien n’est supprimé)</li>}
          <li className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />Vos demandes, avis et contenus sont conservés</li>
        </ul>
      </Dialog>
    </div>
  );
}

export function AbonnementSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-8" aria-busy="true" aria-label="Chargement de l’abonnement">
      <Skeleton className="h-14 w-60" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2"><Skeleton className="h-52 rounded-3xl" /><Skeleton className="h-52 rounded-3xl" /></div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-[30rem] rounded-3xl" />)}</div>
    </div>
  );
}
