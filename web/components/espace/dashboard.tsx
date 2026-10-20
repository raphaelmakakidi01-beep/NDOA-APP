"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, CalendarHeart, Eye, Heart, ImagePlus, Inbox, Lightbulb, MessageCircle, Percent, Star, Tags, Users, Video } from "lucide-react";
import { Card, CardHeader, EmptyState, Skeleton, StatusTag, Stars, dateFr, timeAgo } from "@/components/ui/bits";
import { Segmented } from "@/components/ui/segmented";
import { Button } from "@/components/ui/button";
import { useEspace } from "@/lib/espace/store";
import { INQUIRY_STATUS, type DayStat } from "@/lib/espace/types";
import { completeness } from "@/lib/onboarding/rules";
import type { StepKey } from "@/lib/onboarding/types";
import { cn } from "@/lib/utils";
import { Sparkline, TrendChart } from "./trend-chart";

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);
const STEP_TO_ROUTE: Record<StepKey, string> = { activite: "/espace/vitrine", entreprise: "/espace/vitrine", photos: "/espace/galerie", tarif: "/espace/tarifs", contacts: "/espace/vitrine", apercu: "/espace/vitrine" };

function delta(cur: number, prev: number) {
  if (!prev) return cur ? 100 : 0;
  return Math.round(((cur - prev) / prev) * 100);
}

export function Dashboard() {
  const { user, vendor, data, isEmpty } = useEspace();
  const [period, setPeriod] = useState<"7" | "30">("30");
  const [now] = useState(() => Date.now()); // horloge figée au montage (rendu pur)
  const n = Number(period);

  const { cur, prev, kpis } = useMemo(() => {
    const cur = data.stats.slice(-n), prev = data.stats.slice(-2 * n, -n);
    const sum = (xs: DayStat[], k: "views" | "whatsapp" | "calls" | "inquiries" | "followers") => xs.reduce((s, d) => s + d[k], 0);
    const views = sum(cur, "views"), pViews = sum(prev, "views");
    const clicks = sum(cur, "whatsapp") + sum(cur, "calls"), pClicks = sum(prev, "whatsapp") + sum(prev, "calls");
    const inq = sum(cur, "inquiries"), pInq = sum(prev, "inquiries");
    const conv = views ? (inq / views) * 100 : 0, pConv = pViews ? (pInq / pViews) * 100 : 0;
    const fol = sum(cur, "followers"), pFol = sum(prev, "followers");
    const rated = data.reviews.length ? data.reviews.reduce((s, r) => s + r.rating, 0) / data.reviews.length : 0;
    const kpis = [
      { label: "Vues du profil", value: fmt(views), d: delta(views, pViews), icon: Eye, spark: cur.map((x) => x.views) },
      { label: "Clics WhatsApp et appel", value: fmt(clicks), d: delta(clicks, pClicks), icon: MessageCircle, spark: cur.map((x) => x.whatsapp + x.calls) },
      { label: "Demandes de devis", value: fmt(inq), d: delta(inq, pInq), icon: Inbox, spark: cur.map((x) => x.inquiries) },
      { label: "Taux de conversion", value: `${conv.toFixed(1).replace(".", ",")} %`, d: Math.round((conv - pConv) * 10) / 10, unit: "pt", icon: Percent, spark: cur.map((x) => (x.views ? x.inquiries / x.views : 0)) },
      { label: "Abonnés", value: fmt(data.followers), d: delta(fol, pFol), extra: fol ? `+${fol} sur la période` : undefined, icon: Users, spark: cur.map((x) => x.followers) },
      { label: "Note moyenne", value: rated ? rated.toFixed(1).replace(".", ",") : "—", extra: `${data.reviews.length} avis`, icon: Star },
    ];
    return { cur, prev, kpis };
  }, [data, n]);

  const score = completeness(vendor);
  const activeStories = data.stories.filter((s) => !s.archived).length;
  const total = Math.min(100, score.score + (activeStories ? 5 : 0));
  const tips = [
    ...score.tips.filter((t) => !t.done).map((t) => ({ label: t.label, gain: t.gain, href: STEP_TO_ROUTE[t.step] })),
    ...(activeStories ? [] : [{ label: "Publier une story", gain: 5, href: "/espace/galerie?onglet=stories" }]),
  ].sort((a, b) => b.gain - a.gain).slice(0, 3);

  const todo = data.inquiries.filter((i) => i.status === "new" || i.status === "discussing").sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 5);
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = data.inquiries.filter((i) => i.status === "confirmed" && i.weddingDate >= today).sort((a, b) => a.weddingDate.localeCompare(b.weddingDate)).slice(0, 4);
  const firstName = (user.fullName || vendor.name).split(" ")[0];

  return (
    <div className="grid grid-cols-1 gap-6">
      {/* En-tête */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm capitalize text-muted">{new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</p>
          <h1 className="font-display mt-1 text-[2.1rem] leading-tight sm:text-5xl">Bonjour <em className="text-gold-ink">{firstName}</em></h1>
          <p className="mt-1 text-muted">{isEmpty ? "Votre vitrine est en ligne. Les premières visites arrivent généralement sous 48 h." : "Voici l’activité de votre vitrine."}</p>
        </div>
        <Segmented label="Période" layoutId="period" value={period} onChange={setPeriod} options={[{ value: "7", label: "7 jours" }, { value: "30", label: "30 jours" }]} />
      </div>

      {/* Score + raccourcis */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card className="flex flex-col gap-5 sm:flex-row sm:items-center" aria-labelledby="score-h">
          <div className="relative size-24 shrink-0">
            <svg viewBox="0 0 96 96" className="-rotate-90" aria-hidden>
              <circle cx="48" cy="48" r="42" fill="none" stroke="var(--line)" strokeWidth="7" />
              <motion.circle cx="48" cy="48" r="42" fill="none" stroke="var(--gold)" strokeWidth="7" strokeLinecap="round" strokeDasharray={264}
                initial={{ strokeDashoffset: 264 }} animate={{ strokeDashoffset: 264 * (1 - total / 100) }} transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }} />
            </svg>
            <span className="font-display absolute inset-0 grid place-items-center text-2xl tabular-nums">{total}<span className="sr-only"> %</span></span>
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="score-h" className="font-display text-xl">Votre profil est complet à <span className="text-gold-ink">{total} %</span></h2>
            {tips.length ? (
              <ul className="mt-3 grid gap-1">
                {tips.map((t) => (
                  <li key={t.label}>
                    <Link href={t.href} className="group flex items-center gap-3 rounded-lg py-1.5 text-sm hover:text-gold-ink">
                      <Lightbulb className="size-4 shrink-0 text-gold" aria-hidden /><span className="flex-1">{t.label}</span>
                      <span className="font-semibold tabular-nums text-gold-ink">+{t.gain} %</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-2 text-sm text-muted">Bravo, votre vitrine est complète. Gardez-la vivante avec des stories régulières.</p>}
          </div>
        </Card>
        <div className="grid grid-cols-3 gap-3">
          {[
            { href: "/espace/galerie?ajouter=1", label: "Ajouter des photos", icon: ImagePlus },
            { href: "/espace/tarifs", label: "Créer un forfait", icon: Tags },
            { href: "/espace/galerie?onglet=stories&nouvelle=1", label: "Publier une story", icon: Video },
          ].map((s) => (
            <Link key={s.href} href={s.href} className="group flex flex-col justify-between gap-6 rounded-3xl border border-line bg-surface p-4 transition-colors hover:border-gold">
              <span className="grid size-10 place-items-center rounded-xl bg-gold/15 text-gold-ink transition-transform group-hover:-translate-y-0.5"><s.icon className="size-5" aria-hidden /></span>
              <span className="text-sm font-semibold leading-tight">{s.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* KPI */}
      <section aria-labelledby="kpi-h">
        <h2 id="kpi-h" className="sr-only">Indicateurs sur {n} jours</h2>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {kpis.map((k, i) => {
            const up = (k.d ?? 0) >= 0;
            return (
              <motion.li key={k.label} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                className="flex flex-col gap-3 rounded-3xl border border-line bg-surface p-4 sm:p-5">
                <div className="flex items-center justify-between gap-2 text-[13px] font-semibold text-muted">
                  <span className="leading-tight">{k.label}</span><k.icon className="size-4 shrink-0 text-gold" aria-hidden />
                </div>
                <p className="font-display text-3xl leading-none tabular-nums sm:text-4xl">{k.value}</p>
                <div className="flex items-end justify-between gap-2">
                  {k.d !== undefined && prev.length ? (
                    <span className={cn("inline-flex items-center gap-0.5 text-xs font-bold", up ? "text-success" : "text-danger")}>
                      {up ? <ArrowUpRight className="size-3.5" aria-hidden /> : <ArrowDownRight className="size-3.5" aria-hidden />}
                      {up ? "+" : ""}{String(k.d).replace(".", ",")}{k.unit === "pt" ? " pt" : " %"}
                      <span className="sr-only"> par rapport aux {n} jours précédents</span>
                    </span>
                  ) : <span className="text-xs text-muted">{k.extra}</span>}
                  {k.spark && <Sparkline values={k.spark} className="h-7 w-20" />}
                </div>
              </motion.li>
            );
          })}
        </ul>
      </section>

      {/* Graphique + événements */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.7fr_1fr]">
        <Card aria-labelledby="chart-h">
          <CardHeader id="chart-h" title="Vues et demandes" sub={`${n} derniers jours`}
            action={<div className="flex gap-4 text-xs text-muted"><span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-gold" aria-hidden />Vues</span><span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-rose" aria-hidden />Demandes</span></div>} />
          {cur.some((d) => d.views) ? <TrendChart data={cur} /> : (
            <EmptyState icon={<Eye />} title="Pas encore de visites">Partagez le lien de votre page sur WhatsApp et Instagram pour attirer vos premiers visiteurs.</EmptyState>
          )}
        </Card>
        <Card aria-labelledby="up-h">
          <CardHeader id="up-h" title="Prochains mariages" />
          {upcoming.length ? (
            <ul className="grid grid-cols-1 gap-3">
              {upcoming.map((u) => {
                const days = Math.round((+new Date(`${u.weddingDate}T12:00`) - now) / 86400_000);
                return (
                  <li key={u.id} className="flex items-center gap-4">
                    <span className="grid w-14 shrink-0 justify-items-center rounded-2xl bg-surface-2 py-2 leading-none">
                      <span className="font-display text-2xl">{new Date(`${u.weddingDate}T12:00`).getDate()}</span>
                      <span className="mt-1 text-[11px] font-bold uppercase tracking-wider text-muted">{dateFr(u.weddingDate, { month: "short" }).replace(".", "")}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{u.couple}</span>
                      <span className="text-[13px] text-muted">{u.city}{u.guests ? ` · ${u.guests} invités` : ""}</span>
                    </span>
                    <span className="text-xs font-bold text-gold-ink">J-{days}</span>
                  </li>
                );
              })}
            </ul>
          ) : <EmptyState icon={<CalendarHeart />} title="Aucun mariage confirmé">Les demandes confirmées apparaîtront ici avec un compte à rebours.</EmptyState>}
        </Card>
      </div>

      {/* Demandes + avis */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card aria-labelledby="todo-h">
          <CardHeader id="todo-h" title="Demandes à traiter" action={<Button asChild variant="link" size="sm"><Link href="/espace/demandes">Tout voir <ArrowRight aria-hidden /></Link></Button>} />
          {todo.length ? (
            <ul className="-mx-2 grid grid-cols-1">
              {todo.map((q) => (
                <li key={q.id}>
                  <Link href="/espace/demandes" className="flex items-start gap-3 rounded-2xl px-2 py-3 hover:bg-surface-2">
                    <span className={cn("mt-2 size-2 shrink-0 rounded-full", q.unread ? "bg-rose" : "bg-transparent")} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-semibold">{q.couple}</span>
                        <StatusTag tone={INQUIRY_STATUS[q.status].tone}>{INQUIRY_STATUS[q.status].label}</StatusTag>
                        {q.unread && <span className="sr-only">non lue</span>}
                      </span>
                      <span className="mt-0.5 block truncate text-[13px] text-muted">{q.message}</span>
                      <span className="mt-1 block text-xs text-muted">Mariage le {dateFr(q.weddingDate)} · {q.city}{q.packageName ? ` · ${q.packageName}` : ""}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted">{timeAgo(q.createdAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <EmptyState icon={<Inbox />} title="Aucune demande en attente">Vous êtes à jour. Les nouvelles demandes apparaîtront ici en temps réel.</EmptyState>}
        </Card>
        <Card aria-labelledby="rev-h">
          <CardHeader id="rev-h" title="Derniers avis" action={<Button asChild variant="link" size="sm"><Link href="/espace/avis">Tout voir <ArrowRight aria-hidden /></Link></Button>} />
          {data.reviews.length ? (
            <ul className="grid grid-cols-1 gap-4">
              {data.reviews.slice(0, 3).map((r) => (
                <li key={r.id} className="flex gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.photo} alt="" className="size-11 shrink-0 rounded-xl object-cover" loading="lazy" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{r.names}</span><Stars value={r.rating} /><span className="text-xs text-muted">{timeAgo(r.createdAt)}</span></div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted">{r.text}</p>
                    {!r.reply && <Link href="/espace/avis" className="mt-1 inline-block text-sm font-semibold text-gold-ink hover:underline">Répondre</Link>}
                  </div>
                </li>
              ))}
            </ul>
          ) : <EmptyState icon={<Heart />} title="Pas encore d’avis">Après chaque mariage, envoyez votre lien d’avis à vos mariés : 3 avis suffisent pour rassurer.</EmptyState>}
        </Card>
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6" aria-busy="true" aria-label="Chargement du tableau de bord">
      <div><Skeleton className="h-4 w-40" /><Skeleton className="mt-3 h-12 w-72" /></div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr]"><Skeleton className="h-36 rounded-3xl" /><Skeleton className="h-36 rounded-3xl" /></div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-36 rounded-3xl" />)}</div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.7fr_1fr]"><Skeleton className="h-80 rounded-3xl" /><Skeleton className="h-80 rounded-3xl" /></div>
    </div>
  );
}
