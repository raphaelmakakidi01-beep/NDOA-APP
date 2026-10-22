"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AlertTriangle, Ban, Download, Mail, Phone, RefreshCw, RotateCcw, ShieldCheck, Trash2, UserRound, Users as UsersIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState, StatusTag } from "@/components/ui/bits";
import { getUser, listUsers, suspendUser, deleteUser, type AdminUser, type UserDetail, type UserFilters, type UserRole } from "@/lib/admin/manage";
import { getSupabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useAdmin } from "./context";
import { ConfirmDialog, FilterSelect, PageHeader, Pagination, Panel, ReasonDialog, SearchBox, downloadCsv, fmtDate, waited } from "./ui";

export const ROLE_LABEL: Record<UserRole, string> = { user: "Couple", prestataire: "Prestataire", moderateur: "Modérateur", admin: "Administrateur" };
const SUSPEND_REASONS = ["Messages abusifs ou insultants", "Fausses demandes de devis", "Usurpation d’identité", "Spam", "Demande de l’utilisateur"];
const INQ_LABEL: Record<string, string> = { new: "Nouvelle", discussing: "En discussion", quote_sent: "Devis envoyé", confirmed: "Confirmée", lost: "Perdue" };

export function UserStatus({ u }: { u: Pick<AdminUser, "suspendedAt" | "deletedAt"> }) {
  return u.deletedAt ? <StatusTag tone="muted">Supprimé</StatusTag> : u.suspendedAt ? <StatusTag tone="danger">Suspendu</StatusTag> : <StatusTag tone="success">Actif</StatusTag>;
}

export function UsersList() {
  const [f, setF] = React.useState<UserFilters>({ q: "", role: "user", status: "", page: 1, pageSize: 25 });
  const [q, setQ] = React.useState("");
  const [res, setRes] = React.useState<{ key: string; rows?: AdminUser[]; total?: number; error?: string } | null>(null);
  const [exporting, setExporting] = React.useState(false);
  const key = JSON.stringify(f);
  const data = res?.key === key ? res : null;

  React.useEffect(() => { const t = setTimeout(() => setF((x) => (x.q === q ? x : { ...x, q, page: 1 })), 300); return () => clearTimeout(t); }, [q]);
  React.useEffect(() => {
    let alive = true;
    listUsers(f).then((r) => alive && setRes({ key, ...r })).catch((e: Error) => alive && setRes({ key, error: e.message }));
    return () => { alive = false; };
  }, [f, key]);

  async function exportCsv() {
    setExporting(true);
    try {
      const all: AdminUser[] = [];
      for (let page = 1; page <= 50; page++) {
        const r = await listUsers({ ...f, page, pageSize: 200 });
        all.push(...r.rows);
        if (all.length >= r.total || !r.rows.length) break;
      }
      await getSupabase()?.rpc("admin_log", { p_action: "export.csv", p_target_type: "profiles", p_target_id: String(all.length) });
      downloadCsv(`utilisateurs-${new Date().toISOString().slice(0, 10)}.csv`, all, [
        { label: "Nom", value: (u) => u.name }, { label: "E-mail", value: (u) => u.email }, { label: "Téléphone", value: (u) => u.phone },
        { label: "Rôle", value: (u) => ROLE_LABEL[u.role] }, { label: "Inscrit le", value: (u) => u.createdAt.slice(0, 10) },
        { label: "Dernière connexion", value: (u) => u.lastSignInAt?.slice(0, 10) }, { label: "Demandes", value: (u) => u.inquiries },
        { label: "Statut", value: (u) => (u.deletedAt ? "supprimé" : u.suspendedAt ? "suspendu" : "actif") },
      ]);
      toast.success(`${all.length} ligne${all.length > 1 ? "s" : ""} exportée${all.length > 1 ? "s" : ""}`);
    } catch (e) { toast.error((e as Error).message); } finally { setExporting(false); }
  }

  const rows = data?.rows ?? [];
  return (
    <>
      <PageHeader title="Utilisateurs" sub={data?.total !== undefined ? `${data.total} compte${data.total > 1 ? "s" : ""}` : "Chargement…"}
        actions={<Button variant="outline" size="sm" loading={exporting} onClick={exportCsv}><Download aria-hidden />Exporter CSV</Button>} />
      <Panel>
        <div className="grid gap-3 border-b border-line p-3 sm:grid-cols-[minmax(220px,1fr)_180px_160px] sm:items-end">
          <SearchBox value={q} onChange={setQ} placeholder="Nom, e-mail ou téléphone" />
          <FilterSelect label="Type de compte" value={f.role} onChange={(v) => setF((x) => ({ ...x, role: v as UserFilters["role"], page: 1 }))}
            options={[{ value: "", label: "Tous" }, ...(Object.keys(ROLE_LABEL) as UserRole[]).map((r) => ({ value: r, label: ROLE_LABEL[r] }))]} />
          <FilterSelect label="Statut" value={f.status} onChange={(v) => setF((x) => ({ ...x, status: v as UserFilters["status"], page: 1 }))}
            options={[{ value: "", label: "Tous" }, { value: "active", label: "Actifs" }, { value: "suspended", label: "Suspendus" }, { value: "deleted", label: "Supprimés" }]} />
        </div>
        {data?.error ? (
          <div className="grid justify-items-center gap-3 px-6 py-12 text-center"><AlertTriangle className="size-6 text-danger" aria-hidden /><p className="text-sm">{data.error}</p>
            <Button variant="outline" size="sm" onClick={() => setF((x) => ({ ...x }))}><RefreshCw aria-hidden />Réessayer</Button></div>
        ) : data && !rows.length ? (
          <EmptyState className="m-4" icon={<UsersIcon />} title="Aucun compte">Aucun utilisateur ne correspond à ces critères.</EmptyState>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-[13.5px]">
                <caption className="sr-only">Liste des utilisateurs</caption>
                <thead className="border-b border-line text-[12px] uppercase tracking-[.06em] text-muted">
                  <tr>{["Utilisateur", "Téléphone", "Type", "Inscrit", "Dernière connexion", "Demandes", "Statut"].map((h) => <th key={h} scope="col" className="px-3 py-2 text-left font-semibold">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {!data ? Array.from({ length: 8 }, (_, i) => <tr key={i}><td colSpan={7} className="px-3 py-2"><div className="skeleton h-9 rounded-lg" /></td></tr>) : rows.map((u) => (
                    <tr key={u.id} className="hover:bg-surface-2/60">
                      <td className="px-3 py-2"><UserName u={u} /></td>
                      <td className="px-3 py-2 text-muted tabular">{u.phone ?? "—"}</td>
                      <td className="px-3 py-2">{ROLE_LABEL[u.role]}</td>
                      <td className="px-3 py-2 text-muted tabular">{fmtDate(u.createdAt)}</td>
                      <td className="px-3 py-2 text-muted">{u.lastSignInAt ? `il y a ${waited(u.lastSignInAt)}` : "jamais"}</td>
                      <td className="px-3 py-2 tabular">{u.inquiries}</td>
                      <td className="px-3 py-2"><UserStatus u={u} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-line md:hidden">
              {!data ? Array.from({ length: 5 }, (_, i) => <li key={i} className="p-3"><div className="skeleton h-12 rounded-lg" /></li>) : rows.map((u) => (
                <li key={u.id} className="flex items-center gap-3 p-3"><div className="min-w-0 flex-1"><UserName u={u} /></div><UserStatus u={u} /></li>
              ))}
            </ul>
            {data?.total !== undefined && <Pagination page={f.page} pageSize={f.pageSize} total={data.total} onPage={(p) => setF((x) => ({ ...x, page: p }))} />}
          </>
        )}
      </Panel>
    </>
  );
}

function UserName({ u }: { u: AdminUser }) {
  return (
    <Link href={`/admin/utilisateurs/${u.id}`} className="group flex min-w-0 items-center gap-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-bold text-muted">{(u.name ?? u.email ?? "?").slice(0, 1).toUpperCase()}</span>
      <span className="min-w-0">
        <span className="block truncate font-semibold group-hover:text-gold-ink">{u.deletedAt ? "Compte supprimé" : u.name || "Sans nom"}</span>
        <span className="block truncate text-[12px] text-muted">{u.email ?? "—"}</span>
      </span>
    </Link>
  );
}

export function UserDetailView() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { me } = useAdmin();
  const [u, setU] = React.useState<UserDetail | null>();
  const [error, setError] = React.useState("");
  const [dialog, setDialog] = React.useState<"" | "suspend" | "delete">("");
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(() => { getUser(id).then((x) => { setU(x); setError(""); }).catch((e: Error) => setError(e.message)); }, [id]);
  React.useEffect(load, [load]);

  if (error) return <EmptyState className="mt-10" icon={<AlertTriangle />} title="Chargement impossible" action={<Button variant="outline" size="sm" onClick={load}>Réessayer</Button>}>{error}</EmptyState>;
  if (u === undefined) return <div className="grid gap-3" aria-busy="true"><div className="skeleton h-12 w-72 rounded-xl" /><div className="skeleton h-80 rounded-2xl" /></div>;
  if (u === null) return <EmptyState className="mt-10" icon={<UserRound />} title="Compte introuvable" action={<Button asChild variant="outline" size="sm"><Link href="/admin/utilisateurs">Retour</Link></Button>} />;

  const self = me?.id === u.id;
  const staff = u.role === "admin" || u.role === "moderateur";

  async function unsuspend() {
    setBusy(true);
    try { await suspendUser(u!.id, false, "Levée par l’équipe"); toast.success("Suspension levée"); load(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader back={{ href: "/admin/utilisateurs", label: "Utilisateurs" }} title={u.deletedAt ? "Compte supprimé" : u.name || u.email || "Sans nom"}
        sub={<span className="inline-flex flex-wrap items-center gap-2"><UserStatus u={u} />{ROLE_LABEL[u.role]}{self && " · vous"}</span>}
        actions={!self && !u.deletedAt && <>
          {u.suspendedAt
            ? <Button size="sm" variant="outline" loading={busy} onClick={unsuspend}><RotateCcw aria-hidden />Lever la suspension</Button>
            : <Button size="sm" variant="danger" onClick={() => setDialog("suspend")}><Ban aria-hidden />Suspendre</Button>}
          <Button size="sm" variant="ghost" className="text-danger" onClick={() => setDialog("delete")}><Trash2 aria-hidden />Supprimer le compte</Button>
        </>} />

      {u.suspendedAt && <div role="status" className="mb-4 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm"><b>Suspendu le {fmtDate(u.suspendedAt)}.</b> <span className="text-muted">{u.suspendedReason}</span></div>}

      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Panel title="Compte" id="u-info">
          <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-2 p-4 text-[13.5px]">
            <dt className="text-muted">E-mail</dt><dd className="break-all">{u.email ? <a href={`mailto:${u.email}`} className="inline-flex items-center gap-1 hover:text-gold-ink"><Mail className="size-3.5 shrink-0" aria-hidden />{u.email}</a> : "—"}</dd>
            <dt className="text-muted">Téléphone</dt><dd>{u.phone ? <a href={`tel:${u.phone}`} className="inline-flex items-center gap-1 hover:text-gold-ink"><Phone className="size-3.5" aria-hidden />{u.phone}</a> : "—"}</dd>
            <dt className="text-muted">Connexion</dt><dd>{u.providers.map((p) => (p === "google" ? "Google" : p === "phone" ? "Téléphone" : "E-mail")).join(", ") || "—"}</dd>
            <dt className="text-muted">Inscrit le</dt><dd className="tabular">{fmtDate(u.createdAt)}</dd>
            <dt className="text-muted">Dernière visite</dt><dd>{u.lastSignInAt ? fmtDate(u.lastSignInAt, true) : "jamais"}</dd>
            <dt className="text-muted">Favoris</dt><dd className="tabular">{u.favorites}</dd>
            <dt className="text-muted">Suivis</dt><dd className="tabular">{u.follows}</dd>
          </dl>
          {staff && <p className="flex items-center gap-2 border-t border-line px-4 py-3 text-[13px] text-muted"><ShieldCheck className="size-4 text-gold-ink" aria-hidden />Membre de l’équipe : rôle modifiable dans <Link href="/admin/parametres" className="font-semibold text-gold-ink hover:underline">Paramètres</Link>.</p>}
        </Panel>

        <div className="grid content-start gap-4">
          {u.vendorList.length > 0 && (
            <Panel title="Vitrines" id="u-vendors">
              <ul className="divide-y divide-line">
                {u.vendorList.map((v) => <li key={v.id}><Link href={`/admin/prestataires/${v.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-surface-2"><b>{v.name}</b><span className="text-[12px] text-muted">/{v.slug}</span></Link></li>)}
              </ul>
            </Panel>
          )}
          <Panel title={`Demandes de devis (${u.inquiryList.length})`} id="u-inq">
            {u.inquiryList.length ? (
              <ul className="divide-y divide-line">
                {u.inquiryList.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[13.5px]">
                    <Link href={`/admin/prestataires/${i.vendorId}`} className="font-semibold hover:text-gold-ink">{i.vendor}</Link>
                    <StatusTag tone={i.status === "confirmed" ? "success" : i.status === "lost" ? "muted" : "gold"}>{INQ_LABEL[i.status] ?? i.status}</StatusTag>
                    <span className="ml-auto text-[12px] text-muted tabular">{i.weddingDate ? `Mariage le ${fmtDate(i.weddingDate)}` : "Date libre"} · {fmtDate(i.createdAt)}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="px-4 py-6 text-sm text-muted">Aucune demande envoyée depuis ce compte.</p>}
          </Panel>
        </div>
      </div>

      <ReasonDialog open={dialog === "suspend"} onOpenChange={(o) => setDialog(o ? "suspend" : "")} title="Suspendre ce compte"
        description="L’utilisateur ne peut plus se connecter. S’il possède une vitrine, elle est suspendue aussi."
        presets={SUSPEND_REASONS} confirmLabel="Suspendre"
        onConfirm={async (r) => {
          try {
            const res = await suspendUser(u.id, true, r);
            toast.success("Compte suspendu", { description: res.loginBlocked ? "Connexion bloquée." : "Connexion à bloquer : clé serveur non configurée." });
            setDialog(""); load();
          } catch (e) { toast.error((e as Error).message); }
        }} />
      <ConfirmDialog open={dialog === "delete"} onOpenChange={(o) => { setDialog(o ? "delete" : ""); if (!o) setReason(""); }} title="Supprimer ce compte ?" confirmLabel="Supprimer" typeToConfirm="SUPPRIMER"
        onConfirm={async () => {
          if (!reason.trim()) { toast.error("Indiquez le motif de la suppression."); return; }
          setBusy(true);
          try { await deleteUser(u.id, reason.trim()); toast.success("Compte supprimé"); router.replace("/admin/utilisateurs"); }
          catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
        }}>
        <p>Conforme au droit à l’effacement : le compte de connexion et le profil sont supprimés, ses favoris aussi. Ses demandes restent chez les prestataires mais <b>sans nom, e-mail ni téléphone</b>. Action irréversible et journalisée.</p>
        {u.vendors > 0 && <p className={cn("font-semibold text-danger")}>Ce compte possède une vitrine : supprimez-la d’abord depuis sa fiche prestataire.</p>}
        <label className="grid gap-1.5 font-semibold">Motif
          <input value={reason} onChange={(e) => setReason(e.target.value.slice(0, 300))} placeholder="Ex. : demande d’effacement reçue par e-mail le…"
            className="h-10 rounded-lg border border-line-strong bg-surface px-3 text-sm font-normal focus-visible:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40" />
        </label>
      </ConfirmDialog>
    </>
  );
}
