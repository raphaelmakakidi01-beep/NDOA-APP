"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowDownRight, ArrowUpRight, BarChart3, Eye, Inbox, Lock, MousePointerClick, Sparkles, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Card, CardHeader, EmptyState, Skeleton } from "@/components/ui/bits";
import { TrendChart } from "@/components/espace/trend-chart";
import { useEspace } from "@/lib/espace/store";
import { OFFERS, SOURCES, type DayStat, type TrafficSource } from "@/lib/espace/types";
import { categoryName } from "@/lib/onboarding/catalog";
import { cn } from "@/lib/utils";

const nf = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n);
const pct = (x: number, digits = 1) => `${(x * 100).toFixed(digits).replace(".", ",")} %`;
const sum = (xs: DayStat[], k: "views" | "whatsapp" | "calls" | "inquiries" | "photoViews") => xs.reduce((s, d) => s + (d[k] ?? 0), 0);
const delta = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 100) : 0);

function Trend({ d, unit = "%", period }: { d: number; unit?: string; period: number }) {
  const up = d >= 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-bold", up ? "text-success" : "text-danger")}>
      {up ? <ArrowUpRight className="size-3.5" aria-hidden /> : <ArrowDownRight className="size-3.5" aria-hidden />}
      {up ? "+" : ""}{String(d).replace(".", ",")} {unit}
      <span className="sr-only"> par rapport aux {period} jours précédents</span>
    </span>
  );
}

/** Contenu réservé aux offres Pro et Prestige : flouté et inerte, avec un appel à l’action */
function Locked({ locked, children, title }: { locked: boolean; children: React.ReactNode; title: string }) {
  if (!locked) return <>{children}</>;
  return (
    <div className="relative">
      <div className="pointer-events-none select-none opacity-60 blur-[6px]" aria-hidden inert>{children}</div>
      <div className="absolute inset-0 flex justify-center p-4 pt-10">
        <div className="sticky top-28 h-fit max-w-sm rounded-3xl border border-gold/50 bg-surface/95 p-6 text-center shadow-2xl backdrop-blur">
          <span className="mx-auto mb-3 grid size-11 place-items-center rounded-2xl bg-gold/15 text-gold-ink"><Lock className="size-5" aria-hidden /></span>
          <p className="font-display text-xl">{title}</p>
          <p className="mt-2 text-sm text-muted">Sources du trafic, photos qui convertissent et comparaison avec votre catégorie : inclus dans les offres Pro et Prestige.</p>
          <Button asChild className="mt-4"><Link href="/espace/abonnement"><Sparkles aria-hidden />Voir les offres</Link></Button>
        </div>
      </div>
    </div>
  );
}

export function Statistiques() {
  const { data, vendor } = useEspace();
  const [period, setPeriod] = useState<"7" | "30" | "90">("30");
  const n = Number(period);
  const locked = !OFFERS[data.plan].advancedStats;

  const m = useMemo(() => {
    const cur = data.stats.slice(-n), prev = data.stats.slice(-2 * n, -n);
    const views = sum(cur, "views"), pViews = sum(prev, "views");
    const contacts = sum(cur, "whatsapp") + sum(cur, "calls"), pContacts = sum(prev, "whatsapp") + sum(prev, "calls");
    const inq = sum(cur, "inquiries"), pInq = sum(prev, "inquiries");
    const ctr = views ? contacts / views : 0, pCtr = pViews ? pContacts / pViews : 0;

    // Conversion des devis : demandes ayant reçu un devis → mariage confirmé
    const quoted = data.inquiries.filter((q) => q.status === "quote_sent" || q.status === "confirmed" || q.status === "lost" || data.quotes.some((x) => x.inquiryId === q.id && x.status !== "draft"));
    const confirmed = data.inquiries.filter((q) => q.status === "confirmed");
    const conversion = quoted.length ? confirmed.length / quoted.length : 0;

    // Délai moyen de première réponse
    const delays = data.inquiries.map((q) => {
      const first = data.messages.find((x) => x.inquiryId === q.id && x.sender === "vendor");
      return first ? (+new Date(first.createdAt) - +new Date(q.createdAt)) / 3600_000 : null;
    }).filter((x): x is number => x !== null && x >= 0);
    const responseHours = delays.length ? delays.reduce((a, b) => a + b, 0) / delays.length : 0;

    const sources = (Object.keys(SOURCES) as TrafficSource[]).map((s) => ({ s, v: cur.reduce((a, d) => a + (d.sources?.[s] ?? 0), 0) })).sort((a, b) => b.v - a.v);
    const sTotal = sources.reduce((a, x) => a + x.v, 0);
    const rating = data.reviews.length ? data.reviews.reduce((a, r) => a + r.rating, 0) / data.reviews.length : 0;

    return { cur, prev, views, pViews, contacts, inq, pInq, ctr, pCtr, conversion, quoted: quoted.length, confirmed: confirmed.length, responseHours, sources, sTotal, rating, photoViews: sum(cur, "photoViews") };
  }, [data, n]);

  const b = data.benchmark;
  const benchViews = Math.round((b.views * n) / 30);
  const hasData = m.views > 0;

  const kpis = [
    { label: "Vues de la vitrine", value: nf(m.views), d: delta(m.views, m.pViews), icon: Eye, cmp: b.views ? `Moyenne catégorie : ${nf(benchViews)}` : undefined, good: m.views >= benchViews },
    { label: "Taux de clic", hint: "Clics WhatsApp et appels ÷ vues", value: pct(m.ctr), d: Math.round((m.ctr - m.pCtr) * 1000) / 10, unit: "pt", icon: MousePointerClick, cmp: b.ctr ? `Moyenne catégorie : ${pct(b.ctr)}` : undefined, good: m.ctr >= b.ctr },
    { label: "Demandes de devis", value: nf(m.inq), d: delta(m.inq, m.pInq), icon: Inbox },
    { label: "Conversion des devis", hint: "Mariages confirmés ÷ devis envoyés", value: m.quoted ? pct(m.conversion, 0) : "—", icon: Target, cmp: b.conversion ? `Moyenne catégorie : ${pct(b.conversion, 0)}` : undefined, good: m.conversion >= b.conversion, extra: `${m.confirmed} sur ${m.quoted} devis` },
  ];

  const funnel = [
    { label: "Vues de la vitrine", v: m.views },
    { label: "Contacts WhatsApp et appels", v: m.contacts },
    { label: "Demandes de devis", v: m.inq },
  ];

  const top = data.topPhotos.map((t) => ({ ...t, media: data.media.find((x) => x.id === t.mediaId) })).filter((t) => t.media);
  const cat = vendor.primaryCategory ? categoryName(vendor.primaryCategory) : "votre catégorie";
  const compare = [
    { label: "Vues sur la période", you: m.views, avg: benchViews, fmt: nf, higher: true },
    { label: "Taux de clic", you: m.ctr, avg: b.ctr, fmt: (x: number) => pct(x), higher: true },
    { label: "Conversion des devis", you: m.conversion, avg: b.conversion, fmt: (x: number) => pct(x, 0), higher: true },
    { label: "Délai de première réponse", you: m.responseHours, avg: b.responseHours, fmt: (x: number) => (x < 1 ? `${Math.max(1, Math.round(x * 60))} min` : `${x.toFixed(1).replace(".", ",")} h`), higher: false },
    { label: "Note moyenne", you: m.rating, avg: b.rating, fmt: (x: number) => (x ? x.toFixed(1).replace(".", ",") : "—"), higher: true },
  ];

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="font-display text-[2.1rem] leading-tight sm:text-5xl"><em className="text-gold-ink">Statistiques</em></h1>
          <p className="mt-1 text-muted">D’où viennent vos visiteurs, ce qui les fait vous contacter, et où vous vous situez.</p>
        </div>
        <Segmented label="Période" layoutId="stats-period" value={period} onChange={setPeriod} options={[{ value: "7", label: "7 jours" }, { value: "30", label: "30 jours" }, { value: "90", label: "90 jours" }]} />
      </div>

      {!hasData ? (
        <EmptyState icon={<BarChart3 />} title="Pas encore de statistiques">Les premières visites apparaissent ici sous 24 à 48 h. Partagez votre vitrine sur WhatsApp et Instagram pour démarrer.</EmptyState>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label={`Indicateurs sur ${n} jours`}>
            {kpis.map((k, i) => (
              <motion.li key={k.label} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }} className="flex flex-col gap-3 rounded-3xl border border-line bg-surface p-4 sm:p-5">
                <div className="flex items-start justify-between gap-2 text-[13px] font-semibold text-muted">
                  <span className="leading-tight">{k.label}{k.hint && <span className="mt-0.5 block text-[11px] font-normal">{k.hint}</span>}</span>
                  <k.icon className="size-4 shrink-0 text-gold" aria-hidden />
                </div>
                <p className="font-display text-3xl leading-none tabular-nums sm:text-4xl">{k.value}</p>
                <div className="grid gap-1">
                  {k.d !== undefined && m.prev.length ? <Trend d={k.d} unit={k.unit ?? "%"} period={n} /> : k.extra && <span className="text-xs text-muted">{k.extra}</span>}
                  {k.cmp && !locked && <span className={cn("text-xs", k.good ? "text-success" : "text-muted")}>{k.cmp}</span>}
                </div>
              </motion.li>
            ))}
          </ul>

          <Card aria-labelledby="trend-h">
            <CardHeader id="trend-h" title="Vues et demandes" sub={`${n} derniers jours`}
              action={<div className="flex gap-4 text-xs text-muted"><span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-gold" aria-hidden />Vues</span><span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-rose" aria-hidden />Demandes</span></div>} />
            <TrendChart data={m.cur} />
          </Card>

          <Locked locked={locked} title="Statistiques avancées">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card aria-labelledby="src-h">
                <CardHeader id="src-h" title="Sources du trafic" sub="D’où arrivent les couples qui visitent votre vitrine." />
                <ul className="grid gap-3.5">
                  {m.sources.map(({ s, v }, i) => {
                    const share = m.sTotal ? v / m.sTotal : 0;
                    return (
                      <li key={s} className="grid gap-1.5">
                        <div className="flex items-baseline justify-between gap-3 text-sm"><span>{SOURCES[s]}</span><span className="tabular-nums text-muted"><strong className="font-semibold text-text">{pct(share, 0)}</strong> · {nf(v)}</span></div>
                        <div className="h-2 overflow-hidden rounded-full bg-line" aria-hidden>
                          <motion.div className={cn("h-full rounded-full", i === 0 ? "bg-gold" : "bg-gold/55")} initial={{ width: 0 }} animate={{ width: `${share * 100}%` }} transition={{ duration: 0.7, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Card>

              <Card aria-labelledby="funnel-h">
                <CardHeader id="funnel-h" title="Du regard à la demande" sub="Chaque étape, et la part de visiteurs qui passe à la suivante." />
                <p className="mb-4 text-sm text-muted">En moyenne, chaque visiteur regarde <strong className="text-text">{m.views ? (m.photoViews / m.views).toFixed(1).replace(".", ",") : "0"} photos</strong>.</p>
                <ol className="grid gap-2">
                  {funnel.map((f, i) => {
                    const max = funnel[0].v || 1;
                    const next = funnel[i + 1];
                    return (
                      <li key={f.label}>
                        <div className="relative overflow-hidden rounded-2xl bg-surface-2 px-4 py-3">
                          <motion.span className="absolute inset-y-0 left-0 bg-gold/15" initial={{ width: 0 }} animate={{ width: `${Math.max(4, Math.min(100, (f.v / max) * 100))}%` }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} aria-hidden />
                          <div className="relative flex items-baseline justify-between gap-3 text-sm"><span>{f.label}</span><span className="font-display text-xl tabular-nums">{nf(f.v)}</span></div>
                        </div>
                        {next && <p className="py-1 pl-4 text-xs text-muted">↓ {f.v ? pct(next.v / f.v) : "—"}</p>}
                      </li>
                    );
                  })}
                </ol>
              </Card>

              <Card aria-labelledby="top-h" className="lg:col-span-2">
                <CardHeader id="top-h" title="Photos qui attirent le plus" sub="Mettez-les en couverture ou en tête de galerie." action={<Button asChild size="sm" variant="outline"><Link href="/espace/galerie">Ma galerie</Link></Button>} />
                {top.length ? (
                  <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {top.slice(0, 8).map((t, i) => (
                      <li key={t.mediaId} className="group relative overflow-hidden rounded-2xl">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={t.media!.kind === "video" ? t.media!.posterUrl : t.media!.url} alt={t.media!.alt || `Photo n° ${i + 1}`} className="aspect-[4/5] w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                        <span className="absolute left-2 top-2 grid size-7 place-items-center rounded-full bg-black/70 text-xs font-bold text-white">{i + 1}</span>
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-8 text-xs text-white">
                          <p><strong className="text-sm">{nf(t.views)}</strong> vues</p>
                          <p className="opacity-85">{nf(t.contacts)} contacts après la photo</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : <p className="text-sm text-muted">Pas encore assez de vues sur vos photos.</p>}
              </Card>

              <Card aria-labelledby="cmp-h" className="lg:col-span-2">
                <CardHeader id="cmp-h" title={`Vous et la catégorie ${cat}`} sub={b.vendors ? `Moyenne anonymisée de ${b.vendors} prestataires sur 30 jours, ramenée à la période choisie.` : "Pas encore assez de prestataires dans votre catégorie pour comparer."} />
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted"><th className="py-2 font-semibold">Indicateur</th><th className="py-2 text-right font-semibold">Vous</th><th className="py-2 text-right font-semibold">Catégorie</th><th className="w-44 py-2 pl-6 font-semibold"><span className="sr-only">Position</span></th></tr></thead>
                    <tbody>
                      {compare.map((c) => {
                        const better = c.avg ? (c.higher ? c.you >= c.avg : c.you <= c.avg) : null;
                        const ratio = c.avg ? Math.min(2, (c.higher ? c.you / c.avg : c.avg / Math.max(c.you, 0.01))) : 1;
                        return (
                          <tr key={c.label} className="border-b border-line/70 last:border-0">
                            <th scope="row" className="py-3 text-left font-normal">{c.label}</th>
                            <td className="py-3 text-right font-semibold tabular-nums">{c.fmt(c.you)}</td>
                            <td className="py-3 text-right tabular-nums text-muted">{c.avg ? c.fmt(c.avg) : "—"}</td>
                            <td className="py-3 pl-6">
                              {better !== null && (
                                <div className="flex items-center gap-2">
                                  <div className="relative h-2 flex-1 rounded-full bg-line" aria-hidden>
                                    <span className="absolute inset-y-[-3px] left-1/2 w-px bg-muted" />
                                    <motion.span className={cn("absolute inset-y-0 left-0 rounded-full", better ? "bg-success" : "bg-rose")} initial={{ width: 0 }} animate={{ width: `${(ratio / 2) * 100}%` }} transition={{ duration: 0.7 }} />
                                  </div>
                                  <span className={cn("w-20 whitespace-nowrap text-xs font-semibold", better ? "text-success" : "text-rose-ink")}>{better ? "au-dessus" : "en dessous"}</span>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </Locked>
        </>
      )}
    </div>
  );
}

export function StatistiquesSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6" aria-busy="true" aria-label="Chargement des statistiques">
      <div className="flex justify-between gap-6"><Skeleton className="h-14 w-64" /><Skeleton className="h-11 w-72 rounded-full" /></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-36 rounded-3xl" />)}</div>
      <Skeleton className="h-80 rounded-3xl" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2"><Skeleton className="h-72 rounded-3xl" /><Skeleton className="h-72 rounded-3xl" /></div>
    </div>
  );
}
