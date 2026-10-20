"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, BadgeCheck, Check as CheckIcon, Download, RefreshCw, Sparkles, Store, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/bits";
import { exportVendors, listVendors, reviewVendors } from "@/lib/admin/api";
import { DEFAULT_FILTERS, PLAN_LABEL, REJECT_REASONS, STATUS_META, type AdminVendorRow, type VendorFilters } from "@/lib/admin/types";
import { CATEGORIES, CITIES } from "@/lib/onboarding/catalog";
import { cn } from "@/lib/utils";
import { useAdmin } from "./context";
import { Check, FilterSelect, PageHeader, Pagination, Panel, ReasonDialog, SearchBox, SortTh, VendorStatusTag, downloadCsv, fmtDate } from "./ui";

const KEYS = ["q", "category", "city", "status", "plan", "sort", "dir", "page"] as const;

function filtersFrom(params: URLSearchParams): VendorFilters {
  const f = { ...DEFAULT_FILTERS };
  for (const k of KEYS) {
    const v = params.get(k);
    if (v === null) continue;
    if (k === "page") f.page = Math.max(1, Number(v) || 1);
    else (f as Record<string, unknown>)[k] = v;
  }
  return f;
}

export function VendorsTable() {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const { refreshPending } = useAdmin();
  const f = React.useMemo(() => filtersFrom(new URLSearchParams(params.toString())), [params]);

  const [q, setQ] = React.useState(f.q);
  const fKey = JSON.stringify(f);
  const [reload, setReload] = React.useState(0);
  const loadKey = `${fKey}#${reload}`;
  const [res, setRes] = React.useState<{ key: string; data?: { rows: AdminVendorRow[]; total: number }; error?: string } | null>(null);
  const data = res?.key === loadKey ? res.data ?? null : null;
  const error = res?.key === loadKey ? res.error ?? "" : "";
  // la sélection est propre à un jeu de filtres
  const [sel0, setSel0] = React.useState<{ key: string; ids: Set<string> }>({ key: "", ids: new Set() });
  const selected = sel0.key === fKey ? sel0.ids : new Set<string>();
  const setSelected = (u: Set<string> | ((s: Set<string>) => Set<string>)) =>
    setSel0((p) => ({ key: fKey, ids: typeof u === "function" ? u(p.key === fKey ? p.ids : new Set()) : u }));
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<"" | "approve" | "export">("");

  const update = React.useCallback((patch: Partial<VendorFilters>) => {
    const next = { ...f, ...patch, page: patch.page ?? 1 };
    const sp = new URLSearchParams();
    for (const k of KEYS) {
      const v = String(next[k]);
      if (v && v !== String(DEFAULT_FILTERS[k])) sp.set(k, v);
    }
    router.replace(`${path}${sp.size ? `?${sp}` : ""}`, { scroll: false });
  }, [f, path, router]);

  // recherche : attend la fin de la frappe
  React.useEffect(() => {
    if (q === f.q) return;
    const t = setTimeout(() => update({ q }), 300);
    return () => clearTimeout(t);
  }, [q, f.q, update]);

  React.useEffect(() => {
    let alive = true;
    listVendors(f).then((d) => alive && setRes({ key: loadKey, data: d })).catch((e: Error) => alive && setRes({ key: loadKey, error: e.message }));
    return () => { alive = false; };
  }, [f, loadKey]);

  const rows = data?.rows ?? [];
  const allOn = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const someOn = rows.some((r) => selected.has(r.id));
  const toggle = (id: string, on: boolean) => setSelected((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });
  const sel = rows.filter((r) => selected.has(r.id));
  const reviewable = sel.filter((r) => r.status === "pending_review");

  async function bulk(decision: "approve" | "reject", reason?: string) {
    if (!reviewable.length) { toast.error("Sélectionnez des vitrines « En attente »."); return; }
    setBusy(decision === "approve" ? "approve" : "");
    try {
      const r = await reviewVendors(reviewable.map((x) => x.id), decision, reason);
      if (r.ok) toast.success(decision === "approve" ? `${r.ok} vitrine${r.ok > 1 ? "s" : ""} validée${r.ok > 1 ? "s" : ""}` : `${r.ok} vitrine${r.ok > 1 ? "s" : ""} refusée${r.ok > 1 ? "s" : ""} — motif envoyé par e-mail`);
      if (r.errors.length) toast.error(`${r.errors.length} non traitée${r.errors.length > 1 ? "s" : ""}`, { description: "Ouvrez la fiche pour voir ce qui manque (photos, forfait, contact…)." });
      setRejectOpen(false);
      setSelected(new Set());
      setReload((x) => x + 1);
      refreshPending();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function exportCsv(onlySelected: boolean) {
    setBusy("export");
    try {
      const list = onlySelected ? sel : await exportVendors(f);
      downloadCsv(`prestataires-${new Date().toISOString().slice(0, 10)}.csv`, list, [
        { label: "Nom", value: (r) => r.name }, { label: "Slug", value: (r) => r.slug },
        { label: "Catégorie", value: (r) => r.category?.name }, { label: "Ville", value: (r) => r.city },
        { label: "Statut", value: (r) => STATUS_META[r.status].label }, { label: "Offre", value: (r) => PLAN_LABEL[r.plan] },
        { label: "Vérifié", value: (r) => (r.isVerified ? "oui" : "non") }, { label: "Note", value: (r) => (r.ratingCount ? r.rating.toFixed(1).replace(".", ",") : "") },
        { label: "Avis", value: (r) => r.ratingCount }, { label: "Inscrit le", value: (r) => r.createdAt.slice(0, 10) },
      ]);
      toast.success(`${list.length} ligne${list.length > 1 ? "s" : ""} exportée${list.length > 1 ? "s" : ""}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  const onSort = (k: VendorFilters["sort"]) => update({ sort: k, dir: f.sort === k && f.dir === "desc" ? "asc" : "desc" });
  const filtered = !!(f.q || f.category || f.city || f.status || f.plan);

  return (
    <>
      <PageHeader title="Prestataires" sub={data ? `${data.total} vitrine${data.total > 1 ? "s" : ""}${filtered ? " correspondant aux filtres" : ""}` : "Chargement…"}
        actions={<Button variant="outline" size="sm" loading={busy === "export"} onClick={() => exportCsv(false)}><Download aria-hidden />Exporter CSV</Button>} />

      <Panel>
        {/* Filtres */}
        <div className="grid gap-3 border-b border-line p-3 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1.4fr)_repeat(4,minmax(0,1fr))_auto] lg:items-end">
          <SearchBox value={q} onChange={setQ} placeholder="Rechercher un nom, un slug, une ville" className="sm:col-span-2 lg:col-span-1" />
          <FilterSelect label="Catégorie" value={f.category} onChange={(v) => update({ category: v })} options={[{ value: "", label: "Toutes" }, ...CATEGORIES.map((c) => ({ value: c.slug, label: c.name }))]} />
          <FilterSelect label="Ville" value={f.city} onChange={(v) => update({ city: v })} options={[{ value: "", label: "Toutes" }, ...CITIES.map((c) => ({ value: c, label: c }))]} />
          <FilterSelect label="Statut" value={f.status} onChange={(v) => update({ status: v as VendorFilters["status"] })} options={[{ value: "", label: "Tous" }, ...Object.entries(STATUS_META).map(([k, m]) => ({ value: k, label: m.label }))]} />
          <FilterSelect label="Abonnement" value={f.plan} onChange={(v) => update({ plan: v as VendorFilters["plan"] })} options={[{ value: "", label: "Tous" }, ...Object.entries(PLAN_LABEL).map(([k, l]) => ({ value: k, label: l }))]} />
          {filtered && <Button variant="ghost" size="sm" className="h-9 justify-self-start" onClick={() => { setQ(""); router.replace(path); }}><X aria-hidden />Effacer</Button>}
        </div>

        {/* Actions groupées */}
        {someOn && (
          <div className="sticky top-14 z-20 flex flex-wrap items-center gap-2 border-b border-line bg-surface/95 px-3 py-2 backdrop-blur" role="region" aria-label="Actions sur la sélection">
            <p className="mr-auto text-[13px] font-semibold"><span className="tabular">{sel.length}</span> sélectionnée{sel.length > 1 ? "s" : ""}
              {reviewable.length !== sel.length && <span className="font-normal text-muted"> · {reviewable.length} en attente</span>}</p>
            <Button size="sm" loading={busy === "approve"} disabled={!reviewable.length} onClick={() => bulk("approve")}><CheckIcon aria-hidden />Valider ({reviewable.length})</Button>
            <Button size="sm" variant="danger" disabled={!reviewable.length} onClick={() => setRejectOpen(true)}><X aria-hidden />Refuser</Button>
            <Button size="sm" variant="outline" onClick={() => exportCsv(true)}><Download aria-hidden />Exporter</Button>
          </div>
        )}

        {error ? (
          <div className="grid justify-items-center gap-3 px-6 py-12 text-center">
            <AlertTriangle className="size-6 text-danger" aria-hidden /><p className="text-sm">{error}</p>
            <Button variant="outline" size="sm" onClick={() => setReload((x) => x + 1)}><RefreshCw aria-hidden />Réessayer</Button>
          </div>
        ) : data && !rows.length ? (
          <EmptyState className="m-4" icon={<Store />} title={filtered ? "Aucun résultat" : "Aucun prestataire"}
            action={filtered ? <Button variant="outline" size="sm" onClick={() => { setQ(""); router.replace(path); }}>Effacer les filtres</Button> : undefined}>
            {filtered ? "Aucune vitrine ne correspond à ces critères." : "Les vitrines créées apparaîtront ici."}
          </EmptyState>
        ) : (
          <>
            {/* Tableau (écrans larges) */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-[13.5px]">
                <caption className="sr-only">Liste des prestataires</caption>
                <thead className="border-b border-line text-[12px] uppercase tracking-[.06em] text-muted">
                  <tr>
                    <th scope="col" className="w-10 px-3 py-2"><Check label="Tout sélectionner" checked={allOn} indeterminate={someOn && !allOn} onChange={(on) => setSelected(on ? new Set(rows.map((r) => r.id)) : new Set())} /></th>
                    <SortTh label="Prestataire" k="name" sort={f.sort} dir={f.dir} onSort={onSort} />
                    <th scope="col" className="px-3 py-2 text-left font-semibold">Catégorie</th>
                    <th scope="col" className="px-3 py-2 text-left font-semibold">Ville</th>
                    <th scope="col" className="px-3 py-2 text-left font-semibold">Statut</th>
                    <th scope="col" className="px-3 py-2 text-left font-semibold">Offre</th>
                    <SortTh label="Note" k="rating_avg" sort={f.sort} dir={f.dir} onSort={onSort} />
                    <SortTh label="Inscrit le" k="created_at" sort={f.sort} dir={f.dir} onSort={onSort} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {!data ? Array.from({ length: 8 }, (_, i) => (
                    <tr key={i}><td colSpan={8} className="px-3 py-2"><div className="skeleton h-9 rounded-lg" /></td></tr>
                  )) : rows.map((r) => (
                    <tr key={r.id} className={cn("hover:bg-surface-2/60", selected.has(r.id) && "bg-gold/6")}>
                      <td className="px-3 py-2"><Check label={`Sélectionner ${r.name}`} checked={selected.has(r.id)} onChange={(on) => toggle(r.id, on)} /></td>
                      <td className="px-3 py-2"><VendorName r={r} /></td>
                      <td className="px-3 py-2 text-muted">{r.category?.name ?? "—"}</td>
                      <td className="px-3 py-2 text-muted">{r.city}</td>
                      <td className="px-3 py-2"><VendorStatusTag status={r.status} /></td>
                      <td className="px-3 py-2"><PlanTag plan={r.plan} /></td>
                      <td className="px-3 py-2 tabular">{r.ratingCount ? <>{r.rating.toFixed(1).replace(".", ",")} <span className="text-muted">({r.ratingCount})</span></> : <span className="text-muted">—</span>}</td>
                      <td className="px-3 py-2 tabular text-muted">{fmtDate(r.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cartes (mobile) */}
            <ul className="divide-y divide-line md:hidden">
              {!data ? Array.from({ length: 5 }, (_, i) => <li key={i} className="p-3"><div className="skeleton h-14 rounded-lg" /></li>) : rows.map((r) => (
                <li key={r.id} className={cn("flex items-start gap-3 p-3", selected.has(r.id) && "bg-gold/6")}>
                  <span className="pt-2.5"><Check label={`Sélectionner ${r.name}`} checked={selected.has(r.id)} onChange={(on) => toggle(r.id, on)} /></span>
                  <div className="min-w-0 flex-1">
                    <VendorName r={r} />
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted">
                      <VendorStatusTag status={r.status} /><PlanTag plan={r.plan} /><span>{r.category?.name} · {r.city}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            {data && <Pagination page={f.page} pageSize={f.pageSize} total={data.total} onPage={(p) => update({ page: p })} />}
          </>
        )}
      </Panel>

      <ReasonDialog open={rejectOpen} onOpenChange={setRejectOpen} title={`Refuser ${reviewable.length} vitrine${reviewable.length > 1 ? "s" : ""}`}
        description="Le motif est envoyé par e-mail à chaque prestataire, qui pourra corriger puis renvoyer sa vitrine."
        presets={REJECT_REASONS} confirmLabel="Refuser et notifier" onConfirm={(reason) => bulk("reject", reason)} />
    </>
  );
}

export function VendorName({ r }: { r: AdminVendorRow }) {
  return (
    <Link href={`/admin/prestataires/${r.id}`} className="group flex min-w-0 items-center gap-2.5">
      {r.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={r.avatarUrl} alt="" className="size-9 shrink-0 rounded-full object-cover" loading="lazy" />
      ) : <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-bold text-muted">{r.name.slice(0, 1)}</span>}
      <span className="min-w-0">
        <span className="flex items-center gap-1 font-semibold group-hover:text-gold-ink">
          <span className="truncate">{r.name}</span>
          {r.isVerified && <BadgeCheck className="size-4 shrink-0 text-gold-ink" aria-label="Vérifié" />}
          {r.isRecommended && <Sparkles className="size-3.5 shrink-0 text-gold-ink" aria-label="Recommandé" />}
        </span>
        <span className="block truncate text-[12px] text-muted">/{r.slug}</span>
      </span>
    </Link>
  );
}

export function PlanTag({ plan }: { plan: AdminVendorRow["plan"] }) {
  return (
    <span className={cn("inline-flex h-6 items-center rounded-md px-2 text-xs font-semibold",
      plan === "prestige" ? "bg-gold/20 text-gold-ink" : plan === "pro" ? "bg-gold/10 text-gold-ink" : "bg-surface-2 text-muted")}>
      {PLAN_LABEL[plan]}
    </span>
  );
}
