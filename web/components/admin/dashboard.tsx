"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight, ClipboardCheck, Flag, Image as ImageIcon, MessageSquareWarning, RefreshCw, Star } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import { Button } from "@/components/ui/button";
import { getDashboard } from "@/lib/admin/api";
import type { Dashboard } from "@/lib/admin/types";
import { cn } from "@/lib/utils";
import { useAdmin } from "./context";
import { DailyBars } from "./chart";
import { Kpi, PageHeader, Panel, fmtInt } from "./ui";

type Metric = "visites" | "demandes" | "inscrits" | "prestataires";
const METRICS: { value: Metric; label: string }[] = [
  { value: "visites", label: "Visites" }, { value: "demandes", label: "Demandes" },
  { value: "inscrits", label: "Inscrits" }, { value: "prestataires", label: "Prestataires" },
];

const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);

/** Montants : centimes pour l'USD, francs pour le CDF */
const money = (cur: string, amount: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(cur === "USD" ? amount / 100 : amount) + ` ${cur}`;

export function AdminDashboard() {
  const { isAdmin, refreshPending } = useAdmin();
  const [days, setDays] = React.useState<"7" | "30" | "90">("30");
  const [metric, setMetric] = React.useState<Metric>("visites");
  const [data, setData] = React.useState<Dashboard | null>(null);
  const [error, setError] = React.useState("");
  const [reload, setReload] = React.useState(0);

  React.useEffect(() => {
    let alive = true;
    getDashboard(Number(days))
      .then((d) => { if (alive) { setData(d); setError(""); } })
      .catch((e: Error) => alive && setError(e.message));
    refreshPending();
    return () => { alive = false; };
  }, [days, reload, refreshPending]);

  const period = `sur ${days} jours`;
  const alerts = data ? [
    { n: data.alertes.prestataires_en_attente, label: plural(data.alertes.prestataires_en_attente, "vitrine à valider", "vitrines à valider"), icon: ClipboardCheck, href: "/admin/validation", urgent: true },
    { n: data.alertes.medias_signales, label: plural(data.alertes.medias_signales, "photo ou vidéo signalée", "photos ou vidéos signalées"), icon: ImageIcon },
    { n: data.alertes.avis_signales, label: plural(data.alertes.avis_signales, "avis signalé", "avis signalés"), icon: MessageSquareWarning },
    { n: data.alertes.vitrines_signalees, label: plural(data.alertes.vitrines_signalees, "vitrine signalée", "vitrines signalées"), icon: Flag },
    { n: data.alertes.avis_en_attente, label: "avis en attente de publication", icon: Star },
  ] : [];

  return (
    <>
      <PageHeader title="Tableau de bord" sub="Activité de la plateforme NDOA"
        actions={<Segmented label="Période" layoutId="dash-period" value={days} onChange={(v) => { setData(null); setDays(v); }}
          options={[{ value: "7", label: "7 j" }, { value: "30", label: "30 j" }, { value: "90", label: "90 j" }]} />} />

      {error ? (
        <Panel className="grid justify-items-center gap-3 px-6 py-10 text-center">
          <AlertTriangle className="size-6 text-danger" aria-hidden />
          <p className="text-sm">{error}</p>
          <Button variant="outline" size="sm" onClick={() => { setError(""); setReload((r) => r + 1); }}><RefreshCw aria-hidden />Réessayer</Button>
        </Panel>
      ) : (
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" aria-busy={!data}>
            {!data ? Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton h-[104px] rounded-2xl" />) : (
              <>
                <Kpi label="Inscrits" value={fmtInt(data.inscrits)} hint={`+${fmtInt(data.inscrits_periode)} ${period}`} />
                <Kpi label="Prestataires actifs" value={fmtInt(data.prestataires_actifs)} hint="vitrines en ligne" href="/admin/prestataires" />
                <Kpi label="En attente" value={fmtInt(data.en_attente)} hint="à valider" href="/admin/validation" accent={data.en_attente > 0} />
                <Kpi label="Demandes de devis" value={fmtInt(data.demandes_periode)} hint={period} />
                <Kpi label="Visites des profils" value={fmtInt(data.visites_periode)} hint={period} />
                {isAdmin && data.revenus_mois ? (
                  <Kpi label="Revenus du mois" value={Object.keys(data.revenus_mois).length ? money("USD", data.revenus_mois.USD ?? 0) : "0 USD"}
                    hint={data.revenus_mois.CDF ? `+ ${money("CDF", data.revenus_mois.CDF)}` : "paiements encaissés"} />
                ) : <Kpi label="Revenus du mois" value="—" hint="réservé aux admins" />}
              </>
            )}
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <Panel title="Évolution" id="dash-chart"
              action={<Segmented label="Indicateur" layoutId="dash-metric" value={metric} onChange={setMetric} options={METRICS} className="max-w-full overflow-x-auto [&_button]:px-3 [&_button]:py-1.5 [&_button]:text-[12.5px]" />}>
              <div className="p-3 sm:p-4">
                {data ? <DailyBars label={METRICS.find((m) => m.value === metric)!.label} data={data.series.map((p) => ({ day: p.jour, value: p[metric] }))} />
                  : <div className="skeleton h-[230px] rounded-xl" />}
              </div>
            </Panel>

            <Panel title="Alertes" id="dash-alerts">
              {!data ? <div className="grid gap-2 p-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-12 rounded-lg" />)}</div> : (
                alerts.every((a) => !a.n) ? (
                  <p className="px-4 py-8 text-center text-sm text-muted">Rien à traiter pour le moment.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {alerts.filter((a) => a.n > 0).map((a) => {
                      const inner = (
                        <>
                          <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", a.urgent ? "bg-gold/15 text-gold-ink" : "bg-surface-2 text-muted")}><a.icon className="size-4" aria-hidden /></span>
                          <span className="min-w-0 flex-1 text-sm"><b className="tabular">{a.n}</b> {a.label}</span>
                          {a.href ? <ChevronRight className="size-4 text-muted" aria-hidden /> : <span className="text-[11px] font-semibold uppercase tracking-wide text-muted/70">bientôt</span>}
                        </>
                      );
                      return (
                        <li key={a.label}>
                          {a.href ? <Link href={a.href} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">{inner}</Link>
                            : <div className="flex items-center gap-3 px-4 py-3">{inner}</div>}
                        </li>
                      );
                    })}
                  </ul>
                )
              )}
            </Panel>
          </div>
        </div>
      )}
    </>
  );
}
