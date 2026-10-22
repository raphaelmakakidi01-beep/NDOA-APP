"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ChevronDown, Download, History, RefreshCw, ShieldCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState, StatusTag } from "@/components/ui/bits";
import { Segmented } from "@/components/ui/segmented";
import { getContent, inviteStaff, listAudit, listUsers, saveSetting, setRole, type AdminUser, type AuditFilters, type AuditRow, type UserRole } from "@/lib/admin/manage";
import { getSupabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useAdmin } from "./context";
import { dateInputClass } from "./pickers";
import { ConfirmDialog, FilterSelect, PageHeader, Pagination, Panel, downloadCsv, fmtDate, waited } from "./ui";

/** Libellés lisibles des actions du journal */
export const AUDIT_LABEL: Record<string, string> = {
  "vendor.approve": "Vitrine validée", "vendor.reject": "Vitrine refusée", "vendor.verify": "Badge Vérifié attribué", "vendor.unverify": "Badge Vérifié retiré",
  "vendor.suspend": "Vitrine suspendue", "vendor.unsuspend": "Suspension de vitrine levée", "vendor.delete": "Vitrine supprimée", "vendor.view_as": "Vitrine consultée en lecture seule",
  "vendors.update": "Vitrine modifiée", "media.hide": "Média masqué", "media.approve": "Média rétabli / signalement classé", "media.delete": "Média supprimé",
  "review.hide": "Avis masqué", "review.approve": "Avis publié / signalement classé", "review.delete": "Avis supprimé", "story.hide": "Story masquée", "story.delete": "Story supprimée",
  "vendor.hide": "Vitrine signalée suspendue", "user.role": "Rôle modifié", "user.suspend": "Compte suspendu", "user.unsuspend": "Suspension de compte levée",
  "user.delete": "Compte supprimé", "user.view": "Fiche utilisateur consultée", "invoice.refund": "Remboursement enregistré", "subscription.set": "Offre modifiée",
  "announcement.send": "Annonce envoyée", "inquiry.nudge": "Prestataire relancé", "export.csv": "Export CSV", "plans.update": "Offre tarifaire modifiée",
  "categories.update": "Catégorie modifiée", "categories.insert": "Catégorie ajoutée", "categories.delete": "Catégorie supprimée", "cities.update": "Ville modifiée",
  "site_pages.update": "Page modifiée", "site_settings.update": "Réglage modifié", "faqs.update": "FAQ modifiée",
  "featured_slides.insert": "Slide ajouté", "featured_slides.update": "Slide modifié", "featured_slides.delete": "Slide supprimé", "home_picks.insert": "Mise en avant ajoutée",
};
export const auditLabel = (a: string) => AUDIT_LABEL[a] ?? (a.endsWith(".reorder") ? "Ordre modifié" : a);

type Tab = "team" | "general" | "audit";

export function Settings() {
  const [tab, setTab] = React.useState<Tab>("team");
  return (
    <>
      <PageHeader title="Paramètres" sub="Équipe d’administration, réglages généraux et journal d’audit" />
      <Segmented label="Rubrique" layoutId="settings-tab" value={tab} onChange={setTab} className="mb-4 max-w-full overflow-x-auto"
        options={[{ value: "team", label: "Équipe" }, { value: "general", label: "Réglages" }, { value: "audit", label: "Journal d’audit" }]} />
      {tab === "team" ? <Team /> : tab === "general" ? <General /> : <Audit />}
    </>
  );
}

/* ------------------------------------------------------------------ */
function Team() {
  const { me } = useAdmin();
  const [staff, setStaff] = React.useState<AdminUser[] | null>(null);
  const [error, setError] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [role, setRoleNew] = React.useState<"moderateur" | "admin">("moderateur");
  const [busy, setBusy] = React.useState(false);
  const [change, setChange] = React.useState<{ u: AdminUser; role: UserRole } | null>(null);

  const load = React.useCallback(() => {
    Promise.all([listUsers({ q: "", role: "admin", status: "", page: 1, pageSize: 100 }), listUsers({ q: "", role: "moderateur", status: "", page: 1, pageSize: 100 })])
      .then(([a, m]) => { setStaff([...a.rows, ...m.rows]); setError(""); }).catch((e: Error) => setError(e.message));
  }, []);
  React.useEffect(load, [load]);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!emailOk) return;
    setBusy(true);
    try {
      const r = await inviteStaff(email.trim(), role);
      toast.success(r.invited ? "Invitation envoyée" : "Rôle attribué au compte existant", { description: r.invited ? `${email.trim()} recevra un e-mail pour créer son mot de passe.` : undefined });
      setEmail(""); load();
    } catch (er) { toast.error((er as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <Panel title={`Membres de l’équipe (${staff?.length ?? "…"})`} id="team-list">
        {error ? <p className="p-4 text-sm text-danger">{error}</p> : !staff ? <div className="grid gap-2 p-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-12 rounded-lg" />)}</div> : (
          <ul className="divide-y divide-line">
            {staff.map((u) => {
              const self = u.id === me?.id;
              return (
                <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gold/15 text-xs font-bold text-gold-ink">{(u.name ?? u.email ?? "?").slice(0, 1).toUpperCase()}</span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/utilisateurs/${u.id}`} className="block truncate text-sm font-semibold hover:text-gold-ink">{u.name || u.email}{self && <span className="font-normal text-muted"> · vous</span>}</Link>
                    <p className="truncate text-[12px] text-muted">{u.email} · {u.lastSignInAt ? `vu il y a ${waited(u.lastSignInAt)}` : "jamais connecté"}</p>
                  </div>
                  {u.suspendedAt && <StatusTag tone="danger">Suspendu</StatusTag>}
                  <label className="sr-only" htmlFor={`role-${u.id}`}>Rôle de {u.name || u.email}</label>
                  <select id={`role-${u.id}`} value={u.role} disabled={self} title={self ? "Vous ne pouvez pas modifier votre propre rôle" : undefined}
                    onChange={(e) => setChange({ u, role: e.target.value as UserRole })} className={cn(dateInputClass, "h-9 w-auto")}>
                    <option value="admin">Administrateur</option>
                    <option value="moderateur">Modérateur</option>
                    <option value={u.vendors ? "prestataire" : "user"}>Retirer de l’équipe</option>
                  </select>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel title="Ajouter un membre" id="team-invite">
        <form onSubmit={invite} className="grid gap-3 p-4">
          <label className="grid gap-1.5 text-sm font-semibold">E-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={dateInputClass} placeholder="prenom@ndoa.cd" autoComplete="off" /></label>
          <fieldset className="grid gap-1.5">
            <legend className="mb-1 text-sm font-semibold">Rôle</legend>
            {([["moderateur", "Modérateur", "Valide les vitrines, modère photos et avis. Pas d’accès aux paiements, utilisateurs ni réglages."], ["admin", "Administrateur", "Accès complet, y compris paiements, suppression et équipe."]] as const).map(([v, l, d]) => (
              <label key={v} className={cn("flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2", role === v ? "border-gold bg-gold/8" : "border-line")}>
                <input type="radio" name="role" className="mt-1 accent-[var(--gold)]" checked={role === v} onChange={() => setRoleNew(v)} />
                <span className="text-sm"><b>{l}</b><span className="block text-[12.5px] text-muted">{d}</span></span>
              </label>
            ))}
          </fieldset>
          <Button type="submit" size="sm" disabled={!emailOk} loading={busy}><UserPlus aria-hidden />Ajouter</Button>
          <p className="text-[12px] text-muted">Compte existant : le rôle est attribué immédiatement. Nouvelle adresse : une invitation est envoyée par e-mail (nécessite la clé serveur et l’envoi d’e-mails Supabase).</p>
        </form>
      </Panel>

      <ConfirmDialog open={!!change} onOpenChange={(o) => !o && setChange(null)} title="Modifier le rôle ?" confirmLabel="Confirmer"
        onConfirm={async () => {
          if (!change) return;
          try { await setRole(change.u.id, change.role); toast.success("Rôle modifié"); setChange(null); load(); } catch (e) { toast.error((e as Error).message); }
        }}>
        <p><b>{change?.u.name || change?.u.email}</b> : {change && (change.role === "admin" ? "devient administrateur (accès complet)." : change.role === "moderateur" ? "devient modérateur." : "n’a plus accès à l’administration.")} Le changement est immédiat et journalisé.</p>
      </ConfirmDialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
function General() {
  const [value, setValue] = React.useState<boolean | null>(null);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    getContent().then((c) => setValue(c.settings.find((s) => s.key === "moderation.validation_obligatoire")?.value !== false)).catch(() => setValue(true));
  }, []);
  return (
    <Panel title={<span className="inline-flex items-center gap-2"><ShieldCheck className="size-4 text-gold-ink" aria-hidden />Validation des vitrines</span>} id="set-validation" className="max-w-2xl">
      {value === null ? <div className="skeleton m-3 h-24 rounded-lg" /> : (
        <div className="grid gap-3 p-4 text-sm">
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" className="mt-0.5 size-4 accent-[var(--gold)]" checked={value} disabled={busy}
              onChange={async (e) => {
                const v = e.target.checked;
                setBusy(true);
                try { await saveSetting("moderation.validation_obligatoire", v); setValue(v); toast.success(v ? "Validation obligatoire activée" : "Publication directe activée"); }
                catch (er) { toast.error((er as Error).message); } finally { setBusy(false); }
              }} />
            <span><b>Valider chaque nouvelle vitrine avant sa publication</b><span className="block text-muted">Recommandé. Désactivé, une vitrine complète (6 photos, un forfait, un contact, une activité) est publiée immédiatement, sans passer par la file de validation. Appliqué par la base de données.</span></span>
          </label>
        </div>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
function Audit() {
  const [f, setF] = React.useState<AuditFilters>({ action: "", actor: "", from: "", to: "", page: 1, pageSize: 50 });
  const key = JSON.stringify(f);
  const [res, setRes] = React.useState<{ key: string; data?: Awaited<ReturnType<typeof listAudit>>; error?: string } | null>(null);
  const [open, setOpen] = React.useState<Set<string>>(new Set());
  const data = res?.key === key ? res.data : undefined;
  const error = res?.key === key ? res.error : undefined;

  React.useEffect(() => {
    let alive = true;
    listAudit(f).then((d) => alive && setRes({ key, data: d })).catch((e: Error) => alive && setRes({ key, error: e.message }));
    return () => { alive = false; };
  }, [f, key]);

  async function exportCsv() {
    const all: AuditRow[] = [];
    for (let page = 1; page <= 20; page++) {
      const r = await listAudit({ ...f, page, pageSize: 500 });
      all.push(...r.rows);
      if (all.length >= r.total || !r.rows.length) break;
    }
    await getSupabase()?.rpc("admin_log", { p_action: "export.csv", p_target_type: "audit_logs", p_target_id: String(all.length) });
    downloadCsv(`journal-audit-${new Date().toISOString().slice(0, 10)}.csv`, all, [
      { label: "Date", value: (r) => r.createdAt }, { label: "Auteur", value: (r) => r.actor }, { label: "Rôle", value: (r) => r.actorRole },
      { label: "Action", value: (r) => auditLabel(r.action) }, { label: "Code", value: (r) => r.action }, { label: "Élément", value: (r) => `${r.targetType}:${r.targetId ?? ""}` },
      { label: "Motif", value: (r) => r.reason }, { label: "Détails", value: (r) => JSON.stringify(r.details ?? {}) },
    ]);
  }

  return (
    <Panel title={<span className="inline-flex items-center gap-2"><History className="size-4" aria-hidden />Journal d’audit</span>} id="audit"
      action={<Button size="sm" variant="ghost" onClick={() => exportCsv().catch((e: Error) => toast.error(e.message))}><Download aria-hidden />CSV</Button>}>
      <div className="grid gap-3 border-b border-line p-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
        <FilterSelect label="Action" value={f.action} onChange={(v) => setF((x) => ({ ...x, action: v, page: 1 }))}
          options={[{ value: "", label: "Toutes" }, ...(data?.actions ?? []).map((a) => ({ value: a, label: auditLabel(a) }))]} />
        <FilterSelect label="Auteur" value={f.actor} onChange={(v) => setF((x) => ({ ...x, actor: v, page: 1 }))}
          options={[{ value: "", label: "Toute l’équipe" }, ...(data?.actors ?? []).map((a) => ({ value: a.id, label: a.name }))]} />
        <label className="grid gap-1 text-[11px] font-bold uppercase tracking-[.1em] text-muted">Du<input type="date" value={f.from} onChange={(e) => setF((x) => ({ ...x, from: e.target.value, page: 1 }))} className={cn(dateInputClass, "h-9 normal-case tracking-normal")} /></label>
        <label className="grid gap-1 text-[11px] font-bold uppercase tracking-[.1em] text-muted">Au<input type="date" value={f.to} min={f.from || undefined} onChange={(e) => setF((x) => ({ ...x, to: e.target.value, page: 1 }))} className={cn(dateInputClass, "h-9 normal-case tracking-normal")} /></label>
      </div>
      {error ? (
        <div className="grid justify-items-center gap-3 px-6 py-10 text-center"><AlertTriangle className="size-6 text-danger" aria-hidden /><p className="text-sm">{error}</p>
          <Button variant="outline" size="sm" onClick={() => setF((x) => ({ ...x }))}><RefreshCw aria-hidden />Réessayer</Button></div>
      ) : data && !data.rows.length ? (
        <EmptyState className="m-4" icon={<History />} title="Aucune action">Aucune action ne correspond à ces filtres.</EmptyState>
      ) : (
        <>
          <ol className="divide-y divide-line">
            {!data ? Array.from({ length: 8 }, (_, i) => <li key={i} className="p-3"><div className="skeleton h-10 rounded-lg" /></li>) : data.rows.map((r) => {
              const isOpen = open.has(r.id);
              const details = r.details && typeof r.details === "object" && Object.keys(r.details as object).length ? r.details : null;
              return (
                <li key={r.id} className="px-4 py-2.5 text-[13.5px]">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="w-36 shrink-0 text-[12px] text-muted tabular">{fmtDate(r.createdAt, true)}</span>
                    <span className="min-w-0 flex-1"><b>{auditLabel(r.action)}</b> <span className="text-muted">par {r.actor}{r.actorRole === "moderateur" ? " (modérateur)" : ""}</span>
                      {r.vendorId && <> · <Link href={`/admin/prestataires/${r.vendorId}`} className="text-gold-ink hover:underline">voir la vitrine</Link></>}
                    </span>
                    {details && (
                      <button type="button" aria-expanded={isOpen} onClick={() => setOpen((s) => { const n = new Set(s); if (isOpen) n.delete(r.id); else n.add(r.id); return n; })}
                        className="inline-flex items-center gap-1 text-[12px] font-semibold text-muted hover:text-text">Détails<ChevronDown className={cn("size-3.5 transition-transform", isOpen && "rotate-180")} aria-hidden /></button>
                    )}
                  </div>
                  {r.reason && <p className="mt-0.5 text-[12.5px] text-muted sm:pl-39">Motif : {r.reason}</p>}
                  {isOpen && details && <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-surface-2 p-3 text-[12px] leading-relaxed">{JSON.stringify(details, null, 2)}</pre>}
                </li>
              );
            })}
          </ol>
          {data && <Pagination page={f.page} pageSize={f.pageSize} total={data.total} onPage={(p) => setF((x) => ({ ...x, page: p }))} />}
        </>
      )}
    </Panel>
  );
}
