"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, BellRing, Download, Inbox, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/bits";
import { Segmented } from "@/components/ui/segmented";
import { getInquiries, nudgeVendor, type InquiryOverview, type UnansweredInquiry, type VendorInquiryStat } from "@/lib/admin/manage";
import { cn } from "@/lib/utils";
import { Kpi, PageHeader, Panel, SortTh, downloadCsv, fmtDate, fmtInt, waited } from "./ui";

const STATUS = [
  { k: "new", label: "Nouvelles", color: "bg-rose" }, { k: "discussing", label: "En discussion", color: "bg-gold/60" },
  { k: "quote_sent", label: "Devis envoyé", color: "bg-gold" }, { k: "confirmed", label: "Confirmées", color: "bg-success" }, { k: "lost", label: "Perdues", color: "bg-line-strong" },
];
const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)} %`);
type SortKey = "unanswered48h" | "responseRate" | "total" | "avgResponseHours";

export function Inquiries() {
  const [days, setDays] = React.useState<"7" | "30" | "90">("30");
  const [data, setData] = React.useState<{ overview: InquiryOverview; byVendor: VendorInquiryStat[]; unanswered: UnansweredInquiry[] } | null>(null);
  const [error, setError] = React.useState("");
  const [sort, setSort] = React.useState<{ k: SortKey; dir: "asc" | "desc" }>({ k: "unanswered48h", dir: "desc" });
  const [nudged, setNudged] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState("");

  const load = React.useCallback(() => {
    getInquiries(Number(days)).then((d) => { setData(d); setError(""); }).catch((e: Error) => setError(e.message));
  }, [days]);
  React.useEffect(load, [load]);

  async function nudge(i: UnansweredInquiry) {
    setBusy(i.id);
    try { await nudgeVendor(i.id); setNudged((s) => new Set(s).add(i.id)); toast.success(`${i.vendor.name} a été relancé`, { description: "Notification et e-mail envoyés." }); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(""); }
  }

  const rows = React.useMemo(() => [...(data?.byVendor ?? [])].sort((a, b) => ((a[sort.k] ?? -1) - (b[sort.k] ?? -1)) * (sort.dir === "asc" ? 1 : -1)), [data, sort]);
  const o = data?.overview;
  const statusTotal = o ? Object.values(o.by_status).reduce((s, n) => s + n, 0) : 0;

  return (
    <>
      <PageHeader title="Demandes de devis" sub="Réactivité des prestataires et demandes en attente"
        actions={<Segmented label="Période" layoutId="inq-period" value={days} onChange={(v) => { setData(null); setDays(v); }} options={[{ value: "7", label: "7 j" }, { value: "30", label: "30 j" }, { value: "90", label: "90 j" }]} />} />
      {error ? (
        <EmptyState icon={<AlertTriangle />} title="Chargement impossible" action={<Button variant="outline" size="sm" onClick={load}><RefreshCw aria-hidden />Réessayer</Button>}>{error}</EmptyState>
      ) : (
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5" aria-busy={!o}>
            {!o ? Array.from({ length: 5 }, (_, i) => <div key={i} className="skeleton h-[104px] rounded-2xl" />) : (
              <>
                <Kpi label="Demandes" value={fmtInt(o.total)} hint={`sur ${days} jours`} />
                <Kpi label="Taux de réponse" value={pct(o.response_rate)} hint={`${fmtInt(o.answered)} avec réponse`} />
                <Kpi label="Délai moyen" value={o.avg_response_hours === null ? "—" : `${String(o.avg_response_hours).replace(".", ",")} h`} hint="avant la 1re réponse" />
                <Kpi label="Sans réponse" value={fmtInt(o.unanswered_48h)} hint="depuis plus de 48 h" accent={o.unanswered_48h > 0} />
                <Kpi label="Confirmées" value={fmtInt(o.confirmed)} hint={o.total ? `${pct(o.confirmed / o.total)} des demandes` : "—"} />
              </>
            )}
          </div>

          {o && statusTotal > 0 && (
            <Panel title="Où en sont les demandes" id="inq-status">
              <div className="p-4">
                <div className="flex h-3 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={STATUS.map((s) => `${s.label} : ${o.by_status[s.k] ?? 0}`).join(", ")}>
                  {STATUS.map((s) => <span key={s.k} className={s.color} style={{ width: `${((o.by_status[s.k] ?? 0) / statusTotal) * 100}%` }} />)}
                </div>
                <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px]">
                  {STATUS.map((s) => <li key={s.k} className="inline-flex items-center gap-1.5"><span className={cn("size-2.5 rounded-full", s.color)} aria-hidden />{s.label} <b className="tabular">{o.by_status[s.k] ?? 0}</b></li>)}
                </ul>
              </div>
            </Panel>
          )}

          <div className="grid gap-4 xl:grid-cols-[400px_minmax(0,1fr)]">
            <Panel title={`Sans réponse depuis plus de 48 h (${data?.unanswered.length ?? "…"})`} id="inq-late">
              {!data ? <div className="grid gap-2 p-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-14 rounded-lg" />)}</div> : !data.unanswered.length ? (
                <EmptyState className="m-3" icon={<Inbox />} title="Tout le monde a répondu">Aucune demande n’attend depuis plus de 48 h.</EmptyState>
              ) : (
                <ul className="max-h-[560px] divide-y divide-line overflow-y-auto">
                  {data.unanswered.map((i) => (
                    <li key={i.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="min-w-0 flex-1 text-[13.5px]">
                        <Link href={`/admin/prestataires/${i.vendor.id}`} className="block truncate font-semibold hover:text-gold-ink">{i.vendor.name}</Link>
                        <p className="truncate text-[12px] text-muted">{i.couple}{i.weddingDate && ` · mariage le ${fmtDate(i.weddingDate)}`}</p>
                        <p className="text-[12px] font-semibold text-danger">En attente depuis {waited(i.createdAt)}</p>
                      </div>
                      <Button size="sm" variant="outline" disabled={nudged.has(i.id)} loading={busy === i.id} onClick={() => nudge(i)}>
                        <BellRing aria-hidden />{nudged.has(i.id) ? "Relancé" : "Relancer"}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Réactivité par prestataire" id="inq-vendors"
              action={data?.byVendor.length ? <Button size="sm" variant="ghost" onClick={() => downloadCsv(`reactivite-${new Date().toISOString().slice(0, 10)}.csv`, rows, [
                { label: "Prestataire", value: (r) => r.vendorName }, { label: "Demandes", value: (r) => r.total }, { label: "Avec réponse", value: (r) => r.answered },
                { label: "Taux de réponse", value: (r) => (r.responseRate === null ? "" : Math.round(r.responseRate * 100)) }, { label: "Délai moyen (h)", value: (r) => r.avgResponseHours ?? "" },
                { label: "Sans réponse > 48 h", value: (r) => r.unanswered48h },
              ])}><Download aria-hidden />CSV</Button> : undefined}>
              {!data ? <div className="grid gap-2 p-3">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-9 rounded-lg" />)}</div> : !rows.length ? (
                <p className="px-4 py-8 text-center text-sm text-muted">Aucune demande sur la période.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[13.5px]">
                    <caption className="sr-only">Réactivité des prestataires</caption>
                    <thead className="border-b border-line text-[12px] uppercase tracking-[.06em] text-muted">
                      <tr>
                        <th scope="col" className="px-3 py-2 text-left font-semibold">Prestataire</th>
                        {([["total", "Demandes"], ["responseRate", "Réponse"], ["avgResponseHours", "Délai"], ["unanswered48h", "En retard"]] as [SortKey, string][]).map(([k, l]) => (
                          <SortTh key={k} label={l} k={k} sort={sort.k} dir={sort.dir} onSort={(x) => setSort((s) => ({ k: x, dir: s.k === x && s.dir === "desc" ? "asc" : "desc" }))} />
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {rows.map((r) => (
                        <tr key={r.vendorId} className="hover:bg-surface-2/60">
                          <td className="px-3 py-2"><Link href={`/admin/prestataires/${r.vendorId}`} className="font-semibold hover:text-gold-ink">{r.vendorName}</Link></td>
                          <td className="px-3 py-2 tabular">{r.total}</td>
                          <td className="px-3 py-2">
                            <span className="flex items-center gap-2">
                              <span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-2" aria-hidden><span className={cn("block h-full", (r.responseRate ?? 0) >= 0.8 ? "bg-success" : (r.responseRate ?? 0) >= 0.5 ? "bg-gold" : "bg-danger")} style={{ width: `${(r.responseRate ?? 0) * 100}%` }} /></span>
                              <span className="tabular">{pct(r.responseRate)}</span>
                            </span>
                          </td>
                          <td className="px-3 py-2 tabular text-muted">{r.avgResponseHours === null ? "—" : `${String(r.avgResponseHours).replace(".", ",")} h`}</td>
                          <td className={cn("px-3 py-2 tabular", r.unanswered48h > 0 && "font-semibold text-danger")}>{r.unanswered48h}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </div>
        </div>
      )}
    </>
  );
}
