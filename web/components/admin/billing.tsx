"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Download, FileText, RefreshCw, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, StatusTag } from "@/components/ui/bits";
import { Segmented } from "@/components/ui/segmented";
import { getBilling, invoiceUrl, refundInvoice, savePlan, setSubscription, type AdminInvoice, type AdminPlan, type Subscriber } from "@/lib/admin/manage";
import { PLAN_LABEL, type PlanId } from "@/lib/admin/types";
import { cn } from "@/lib/utils";
import { dateInputClass, fromLocalInput, toLocalInput } from "./pickers";
import { FilterSelect, Kpi, PageHeader, Panel, downloadCsv, fmtDate } from "./ui";

/** Montants : centimes pour l'USD, francs pour le CDF */
export const money = (amount: number, cur: string) => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: cur === "USD" ? 2 : 0, minimumFractionDigits: 0 }).format(cur === "USD" ? amount / 100 : amount)} ${cur}`;
const METHOD: Record<string, string> = { mpesa: "M-Pesa", orange_money: "Orange Money", airtel_money: "Airtel Money", card: "Carte" };
const SUB_STATUS: Record<string, { label: string; tone: "success" | "gold" | "danger" | "muted" }> = {
  active: { label: "Actif", tone: "success" }, trialing: { label: "Essai", tone: "gold" }, past_due: { label: "Impayé", tone: "danger" }, canceled: { label: "Résilié", tone: "muted" },
};
const INV_STATUS: Record<AdminInvoice["status"], { label: string; tone: "success" | "gold" | "danger" | "muted" }> = {
  paid: { label: "Payée", tone: "success" }, pending: { label: "En attente", tone: "gold" }, failed: { label: "Échec", tone: "danger" }, refunded: { label: "Remboursée", tone: "muted" },
};
type Tab = "plans" | "subs" | "invoices";

export function Billing() {
  const [tab, setTab] = React.useState<Tab>("plans");
  const [data, setData] = React.useState<{ plans: AdminPlan[]; subscribers: Subscriber[]; invoices: AdminInvoice[] } | null>(null);
  const [error, setError] = React.useState("");
  const load = React.useCallback(() => { getBilling().then((d) => { setData(d); setError(""); }).catch((e: Error) => setError(e.message)); }, []);
  React.useEffect(load, [load]);

  return (
    <>
      <PageHeader title="Abonnements et paiements" sub="Offres Gratuit, Pro et Prestige, abonnés et paiements Mobile Money / carte" />
      <Segmented label="Rubrique" layoutId="billing-tab" value={tab} onChange={setTab} className="mb-4 max-w-full overflow-x-auto"
        options={[{ value: "plans", label: "Offres" }, { value: "subs", label: <>Abonnés{data ? ` (${data.subscribers.filter((s) => s.plan !== "free").length})` : ""}</> }, { value: "invoices", label: "Paiements" }]} />
      {error ? (
        <EmptyState icon={<AlertTriangle />} title="Chargement impossible" action={<Button variant="outline" size="sm" onClick={load}><RefreshCw aria-hidden />Réessayer</Button>}>{error}</EmptyState>
      ) : !data ? <div className="grid gap-3 md:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-96 rounded-2xl" />)}</div>
        : tab === "plans" ? <Plans plans={data.plans} onSaved={load} />
          : tab === "subs" ? <Subscribers subs={data.subscribers} onChanged={load} />
            : <Invoices invoices={data.invoices} onChanged={load} />}
    </>
  );
}

/* ------------------------------------------------------------------ */
function Plans({ plans, onSaved }: { plans: AdminPlan[]; onSaved: () => void }) {
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      {plans.map((p) => <PlanCard key={p.id} plan={p} onSaved={onSaved} />)}
    </div>
  );
}

function PlanCard({ plan, onSaved }: { plan: AdminPlan; onSaved: () => void }) {
  const [p, setP] = React.useState(plan);
  const [features, setFeatures] = React.useState(plan.features.join("\n"));
  const [busy, setBusy] = React.useState(false);
  const dirty = JSON.stringify({ ...p, features: features.split("\n").map((x) => x.trim()).filter(Boolean) }) !== JSON.stringify(plan);
  const lim = (k: keyof AdminPlan["limits"], v: unknown) => setP((x) => ({ ...x, limits: { ...x.limits, [k]: v } }));
  const num = (label: string, k: keyof AdminPlan["limits"], suffix?: string, nullable?: boolean) => (
    <label className="grid gap-1 text-[12.5px] font-semibold">{label}
      <span className="flex items-center gap-1.5">
        <input type="number" min={0} value={p.limits[k] === null ? "" : String(p.limits[k])} placeholder={nullable ? "illimité" : undefined}
          onChange={(e) => lim(k, e.target.value === "" && nullable ? null : Math.max(0, Number(e.target.value)))} className={cn(dateInputClass, "h-9 tabular")} />
        {suffix && <span className="text-[12px] font-normal text-muted">{suffix}</span>}
      </span>
    </label>
  );
  const toggle = (label: string, k: "verified_badge" | "recommendation_eligible" | "stories") => (
    <label className="inline-flex items-center gap-2 text-[13px]"><input type="checkbox" className="size-4 accent-[var(--gold)]" checked={!!p.limits[k]} onChange={(e) => lim(k, e.target.checked)} />{label}</label>
  );

  async function save() {
    setBusy(true);
    try { await savePlan({ ...p, features: features.split("\n").map((x) => x.trim()).filter(Boolean) }); toast.success(`Offre ${p.name} enregistrée`); onSaved(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <Panel className={cn(p.id === "prestige" && "border-gold/50")}>
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="font-display text-2xl">{p.name}</h2>
        <span className="text-[12.5px] text-muted"><b className="tabular text-text">{plan.subscribers}</b> abonné{plan.subscribers > 1 ? "s" : ""}</span>
      </div>
      <div className="grid gap-4 p-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 grid gap-1 text-[12.5px] font-semibold">Nom affiché<input value={p.name} maxLength={30} onChange={(e) => setP((x) => ({ ...x, name: e.target.value }))} className={cn(dateInputClass, "h-9")} /></label>
          <label className="grid gap-1 text-[12.5px] font-semibold">Prix / mois (USD)
            <input type="number" min={0} step="0.01" disabled={p.id === "free"} value={p.priceUsd / 100} onChange={(e) => setP((x) => ({ ...x, priceUsd: Math.round(Math.max(0, Number(e.target.value)) * 100) }))} className={cn(dateInputClass, "h-9 tabular")} />
          </label>
          <label className="grid gap-1 text-[12.5px] font-semibold">Prix / mois (CDF)
            <input type="number" min={0} step="500" disabled={p.id === "free"} value={p.priceCdf} onChange={(e) => setP((x) => ({ ...x, priceCdf: Math.max(0, Math.round(Number(e.target.value))) }))} className={cn(dateInputClass, "h-9 tabular")} />
          </label>
        </div>
        <fieldset className="grid grid-cols-2 gap-3">
          <legend className="mb-2 text-[12px] font-bold uppercase tracking-[.08em] text-muted">Limites</legend>
          {num("Photos", "max_photos")}{num("Vidéos", "max_videos")}
          {num("Stockage", "storage_mb", "Mo")}{num("Taille vidéo", "max_video_mb", "Mo")}
          {num("Forfaits", "max_packages", undefined, true)}{num("Équipe", "team_seats", "pers.")}
          <label className="col-span-2 grid gap-1 text-[12.5px] font-semibold">Statistiques
            <select value={p.limits.stats} onChange={(e) => lim("stats", e.target.value)} className={cn(dateInputClass, "h-9")}><option value="basic">Essentielles</option><option value="advanced">Avancées</option></select>
          </label>
          <div className="col-span-2 grid gap-1.5">{toggle("Badge Vérifié inclus", "verified_badge")}{toggle("Éligible à « Nos recommandations »", "recommendation_eligible")}{toggle("Stories", "stories")}</div>
        </fieldset>
        <label className="grid gap-1 text-[12.5px] font-semibold">Avantages affichés <span className="font-normal text-muted">(un par ligne)</span>
          <textarea rows={4} value={features} onChange={(e) => setFeatures(e.target.value)} className="rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm font-normal focus-visible:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40" />
        </label>
        <label className="inline-flex items-center gap-2 text-[13px] font-semibold">
          <input type="checkbox" className="size-4 accent-[var(--gold)]" disabled={p.id === "free"} checked={p.isActive} onChange={(e) => setP((x) => ({ ...x, isActive: e.target.checked }))} />
          Proposée à la souscription
        </label>
        <p className="text-[12px] text-muted">Les abonnés en cours gardent leur prix jusqu’au renouvellement.</p>
        <Button size="sm" disabled={!dirty} loading={busy} onClick={save}><Save aria-hidden />Enregistrer</Button>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
function Subscribers({ subs, onChanged }: { subs: Subscriber[]; onChanged: () => void }) {
  const [plan, setPlan] = React.useState<"" | PlanId>("");
  const [status, setStatus] = React.useState("");
  const [edit, setEdit] = React.useState<Subscriber | null>(null);
  const rows = subs.filter((s) => (!plan || s.plan === plan) && (!status || s.status === status));
  return (
    <Panel>
      <div className="flex flex-wrap items-end gap-3 border-b border-line p-3">
        <FilterSelect label="Offre" value={plan} onChange={(v) => setPlan(v as PlanId)} options={[{ value: "", label: "Toutes" }, ...(Object.keys(PLAN_LABEL) as PlanId[]).map((k) => ({ value: k, label: PLAN_LABEL[k] }))]} />
        <FilterSelect label="Statut" value={status} onChange={setStatus} options={[{ value: "", label: "Tous" }, ...Object.entries(SUB_STATUS).map(([k, v]) => ({ value: k, label: v.label }))]} />
        <p className="ml-auto pb-2 text-[13px] text-muted">{rows.length} abonnement{rows.length > 1 ? "s" : ""}</p>
      </div>
      {!rows.length ? <p className="px-4 py-8 text-center text-sm text-muted">Aucun abonnement ne correspond.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13.5px]">
            <caption className="sr-only">Abonnés</caption>
            <thead className="border-b border-line text-[12px] uppercase tracking-[.06em] text-muted">
              <tr>{["Prestataire", "Offre", "Statut", "Échéance", "Paiement", ""].map((h, i) => <th key={i} scope="col" className="px-3 py-2 text-left font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((s) => (
                <tr key={s.vendor.id} className="hover:bg-surface-2/60">
                  <td className="px-3 py-2"><Link href={`/admin/prestataires/${s.vendor.id}`} className="font-semibold hover:text-gold-ink">{s.vendor.name}</Link></td>
                  <td className="px-3 py-2">{PLAN_LABEL[s.plan]}</td>
                  <td className="px-3 py-2"><StatusTag tone={SUB_STATUS[s.status]?.tone ?? "muted"}>{SUB_STATUS[s.status]?.label ?? s.status}</StatusTag>{s.cancelAtPeriodEnd && <span className="ml-1.5 text-[12px] text-muted">non renouvelé</span>}</td>
                  <td className="px-3 py-2 tabular text-muted">{s.periodEnd ? fmtDate(s.periodEnd) : "—"}</td>
                  <td className="px-3 py-2 text-muted">{s.method ? `${METHOD[s.method] ?? s.method}${s.account ? ` ${s.account}` : ""}` : "—"}</td>
                  <td className="px-3 py-2 text-right"><Button size="sm" variant="ghost" onClick={() => setEdit(s)}>Changer l’offre</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {edit && <SubscriptionDialog sub={edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); onChanged(); }} />}
    </Panel>
  );
}

function SubscriptionDialog({ sub, onClose, onDone }: { sub: Subscriber; onClose: () => void; onDone: () => void }) {
  const [plan, setPlan] = React.useState<PlanId>(sub.plan === "free" ? "pro" : sub.plan);
  const [end, setEnd] = React.useState(() => toLocalInput(sub.periodEnd ?? new Date(Date.now() + 30 * 86400000).toISOString()));
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={`Offre de ${sub.vendor.name}`} description="Geste commercial, correction après paiement manuel… Aucun paiement n’est déclenché." className="admin-ui"
      footer={<>
        <Button variant="ghost" size="sm" onClick={onClose}>Annuler</Button>
        <Button size="sm" loading={busy} disabled={!reason.trim()} onClick={async () => {
          setBusy(true);
          try { await setSubscription(sub.vendor.id, plan, plan === "free" ? undefined : fromLocalInput(end), reason.trim()); toast.success("Offre mise à jour"); onDone(); }
          catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
        }}>Appliquer</Button>
      </>}>
      <div className="grid gap-3">
        <label className="grid gap-1.5 text-sm font-semibold">Offre
          <select value={plan} onChange={(e) => setPlan(e.target.value as PlanId)} className={dateInputClass}>{(Object.keys(PLAN_LABEL) as PlanId[]).map((k) => <option key={k} value={k}>{PLAN_LABEL[k]}</option>)}</select>
        </label>
        {plan !== "free" && <label className="grid gap-1.5 text-sm font-semibold">Valable jusqu’au<input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className={dateInputClass} /></label>}
        <label className="grid gap-1.5 text-sm font-semibold">Motif (journalisé)<input value={reason} onChange={(e) => setReason(e.target.value.slice(0, 300))} className={dateInputClass} placeholder="Ex. : paiement reçu en espèces le…" /></label>
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
function Invoices({ invoices, onChanged }: { invoices: AdminInvoice[]; onChanged: () => void }) {
  const [status, setStatus] = React.useState("");
  const [method, setMethod] = React.useState("");
  const [refund, setRefund] = React.useState<AdminInvoice | null>(null);
  const rows = invoices.filter((i) => (!status || i.status === status) && (!method || i.method === method));
  const month = new Date(); month.setDate(1); month.setHours(0, 0, 0, 0);
  const sum = (list: AdminInvoice[], f: (i: AdminInvoice) => number) => {
    const by: Record<string, number> = {};
    list.forEach((i) => { by[i.currency] = (by[i.currency] ?? 0) + f(i); });
    return Object.entries(by).map(([c, a]) => money(a, c)).join(" + ") || "0 USD";
  };
  const thisMonth = invoices.filter((i) => i.status === "paid" && new Date(i.paidAt ?? i.createdAt) >= month);

  async function openPdf(i: AdminInvoice) {
    if (!i.pdfPath) return;
    const url = await invoiceUrl(i.pdfPath);
    if (url) window.open(url, "_blank", "noopener"); else toast.error("Facture indisponible.");
  }

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi label="Encaissé ce mois" value={sum(thisMonth, (i) => i.amount)} />
        <Kpi label="Remboursé" value={sum(invoices.filter((i) => i.status === "refunded"), (i) => i.refundAmount ?? i.amount)} />
        <Kpi label="Paiements échoués" value={invoices.filter((i) => i.status === "failed").length} hint="à relancer par le prestataire" />
      </div>
      <Panel>
        <div className="flex flex-wrap items-end gap-3 border-b border-line p-3">
          <FilterSelect label="Statut" value={status} onChange={setStatus} options={[{ value: "", label: "Tous" }, ...Object.entries(INV_STATUS).map(([k, v]) => ({ value: k, label: v.label }))]} />
          <FilterSelect label="Moyen" value={method} onChange={setMethod} options={[{ value: "", label: "Tous" }, ...Object.entries(METHOD).map(([k, v]) => ({ value: k, label: v }))]} />
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => downloadCsv(`paiements-${new Date().toISOString().slice(0, 10)}.csv`, rows, [
            { label: "Numéro", value: (i) => i.number }, { label: "Date", value: (i) => i.createdAt.slice(0, 10) }, { label: "Prestataire", value: (i) => i.vendor.name },
            { label: "Offre", value: (i) => PLAN_LABEL[i.plan] }, { label: "Montant", value: (i) => (i.currency === "USD" ? (i.amount / 100).toFixed(2).replace(".", ",") : i.amount) },
            { label: "Devise", value: (i) => i.currency }, { label: "Moyen", value: (i) => METHOD[i.method] ?? i.method }, { label: "Statut", value: (i) => INV_STATUS[i.status].label },
            { label: "Remboursé", value: (i) => (i.refundAmount ? (i.currency === "USD" ? (i.refundAmount / 100).toFixed(2).replace(".", ",") : i.refundAmount) : "") },
          ])}><Download aria-hidden />CSV</Button>
        </div>
        {!rows.length ? <p className="px-4 py-8 text-center text-sm text-muted">Aucun paiement ne correspond.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-[13.5px]">
              <caption className="sr-only">Paiements et factures</caption>
              <thead className="border-b border-line text-[12px] uppercase tracking-[.06em] text-muted">
                <tr>{["Facture", "Date", "Prestataire", "Offre", "Montant", "Moyen", "Statut", ""].map((h, i) => <th key={i} scope="col" className="px-3 py-2 text-left font-semibold">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((i) => (
                  <tr key={i.id} className="hover:bg-surface-2/60">
                    <td className="px-3 py-2 font-mono text-[12.5px]">{i.number}</td>
                    <td className="px-3 py-2 tabular text-muted">{fmtDate(i.createdAt)}</td>
                    <td className="px-3 py-2"><Link href={`/admin/prestataires/${i.vendor.id}`} className="font-semibold hover:text-gold-ink">{i.vendor.name}</Link></td>
                    <td className="px-3 py-2">{PLAN_LABEL[i.plan]}{i.months === 12 && <span className="text-muted"> · annuel</span>}</td>
                    <td className="px-3 py-2 tabular">{money(i.amount, i.currency)}{i.refundAmount !== undefined && <span className="block text-[12px] text-muted">− {money(i.refundAmount, i.currency)}</span>}</td>
                    <td className="px-3 py-2 text-muted">{METHOD[i.method] ?? i.method}</td>
                    <td className="px-3 py-2"><StatusTag tone={INV_STATUS[i.status].tone}>{INV_STATUS[i.status].label}</StatusTag></td>
                    <td className="px-3 py-2">
                      <span className="flex justify-end gap-1">
                        {i.pdfPath && <Button size="icon" variant="ghost" className="size-8" aria-label={`Facture ${i.number}`} onClick={() => openPdf(i)}><FileText aria-hidden /></Button>}
                        {i.status === "paid" && <Button size="sm" variant="ghost" onClick={() => setRefund(i)}><RotateCcw aria-hidden />Rembourser</Button>}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      {refund && <RefundDialog inv={refund} onClose={() => setRefund(null)} onDone={() => { setRefund(null); onChanged(); }} />}
    </div>
  );
}

function RefundDialog({ inv, onClose, onDone }: { inv: AdminInvoice; onClose: () => void; onDone: () => void }) {
  const factor = inv.currency === "USD" ? 100 : 1;
  const [amount, setAmount] = React.useState(String(inv.amount / factor));
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const value = Math.round(Number(amount.replace(",", ".")) * factor);
  const invalid = !(value > 0 && value <= inv.amount);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={`Rembourser ${inv.number}`} className="admin-ui"
      description="Enregistre le remboursement dans NDOA. Le virement Mobile Money ou carte se fait depuis l’interface de l’opérateur de paiement."
      footer={<>
        <Button variant="ghost" size="sm" onClick={onClose}>Annuler</Button>
        <Button variant="danger" size="sm" loading={busy} disabled={invalid || !reason.trim()} onClick={async () => {
          setBusy(true);
          try { await refundInvoice(inv.id, value, reason.trim()); toast.success("Remboursement enregistré"); onDone(); }
          catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
        }}>Enregistrer le remboursement</Button>
      </>}>
      <div className="grid gap-3">
        <p className="text-sm text-muted">{inv.vendor.name} · payé {money(inv.amount, inv.currency)} par {METHOD[inv.method] ?? inv.method} le {fmtDate(inv.paidAt ?? inv.createdAt)}</p>
        <label className="grid gap-1.5 text-sm font-semibold">Montant remboursé ({inv.currency})
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={cn(dateInputClass, "tabular")} aria-invalid={invalid || undefined} />
        </label>
        {invalid && <p role="alert" className="-mt-1 text-[13px] text-danger">Entre 0 et {money(inv.amount, inv.currency)}.</p>}
        <label className="grid gap-1.5 text-sm font-semibold">Motif<input value={reason} onChange={(e) => setReason(e.target.value.slice(0, 300))} className={dateInputClass} placeholder="Ex. : double prélèvement" /></label>
      </div>
    </Dialog>
  );
}
