"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { Eye, Inbox, Star } from "lucide-react";
import { EmptyState, StatusTag } from "@/components/ui/bits";
import { getVendor, getVendorWorkspace, logViewAs, type Workspace } from "@/lib/admin/api";
import { PLAN_LABEL, type AdminVendorDetail } from "@/lib/admin/types";
import { useAdmin } from "./context";
import { PublicPreview } from "./preview";
import { PageHeader, Panel, VendorStatusTag, fmtDate } from "./ui";

const INQ: Record<string, { label: string; tone: "gold" | "success" | "muted" | "rose" | "danger" }> = {
  new: { label: "Nouvelle", tone: "rose" }, discussing: { label: "En discussion", tone: "gold" }, quote_sent: { label: "Devis envoyé", tone: "gold" },
  confirmed: { label: "Confirmée", tone: "success" }, lost: { label: "Perdue", tone: "muted" },
};

/**
 * « Se connecter en tant que » en LECTURE SEULE : l'admin voit ce que voit le prestataire
 * (vitrine, demandes, avis) sans ouvrir sa session ni pouvoir agir. La consultation est journalisée.
 */
export function ViewAs() {
  const { id } = useParams<{ id: string }>();
  const { me } = useAdmin();
  const [v, setV] = React.useState<AdminVendorDetail | null>();
  const [ws, setWs] = React.useState<Workspace | null>(null);
  const logged = React.useRef(false);

  React.useEffect(() => {
    if (!me) return;
    getVendor(id, me.role).then(setV).catch(() => setV(null));
    if (me.role === "admin") getVendorWorkspace(id).then(setWs).catch(() => setWs({ inquiries: [], reviews: [] }));
    if (!logged.current) { logged.current = true; void logViewAs(id); }
  }, [id, me]);

  if (v === undefined) return <div className="skeleton h-96 rounded-2xl" />;
  if (v === null) return <EmptyState className="mt-10" title="Vitrine introuvable" />;

  return (
    <>
      <div role="status" className="sticky top-14 z-20 -mx-3 mb-4 flex items-center gap-2 border-y border-gold/40 bg-gold/12 px-4 py-2 text-[13px] font-semibold sm:-mx-5 lg:-mx-8">
        <Eye className="size-4 text-gold-ink" aria-hidden />
        Lecture seule — vous voyez l’espace de « {v.name} » tel qu’il le voit. Aucune action n’est possible ici ; cette consultation est journalisée.
      </div>
      <PageHeader back={{ href: `/admin/prestataires/${v.id}`, label: "Fiche du prestataire" }} title={`Espace de ${v.name}`}
        sub={<span className="inline-flex items-center gap-2"><VendorStatusTag status={v.status} />Offre {PLAN_LABEL[v.plan]}</span>} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid content-start gap-4">
          {me?.role === "admin" ? (
            <>
              <Panel title={<span className="inline-flex items-center gap-2"><Inbox className="size-4" aria-hidden />Demandes récentes</span>} id="va-inq">
                {!ws ? <div className="skeleton m-3 h-32 rounded-lg" /> : ws.inquiries.length ? (
                  <ul className="divide-y divide-line">
                    {ws.inquiries.map((i) => (
                      <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[13.5px]">
                        <span className="font-semibold">{i.names}</span>
                        <StatusTag tone={INQ[i.status]?.tone ?? "muted"}>{INQ[i.status]?.label ?? i.status}</StatusTag>
                        {!i.answered && <span className="text-[12px] font-semibold text-danger">sans réponse</span>}
                        <span className="ml-auto text-[12px] text-muted tabular">{i.date ? `Mariage le ${fmtDate(i.date)}` : "Date à préciser"} · reçue le {fmtDate(i.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="px-4 py-6 text-sm text-muted">Aucune demande pour l’instant.</p>}
              </Panel>
              <Panel title={<span className="inline-flex items-center gap-2"><Star className="size-4" aria-hidden />Avis</span>} id="va-rev">
                {!ws ? <div className="skeleton m-3 h-20 rounded-lg" /> : ws.reviews.length ? (
                  <ul className="divide-y divide-line">
                    {ws.reviews.map((r) => (
                      <li key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-[13.5px]">
                        <span className="font-semibold">{r.names}</span><span className="tabular text-gold-ink">{r.rating}/5</span>
                        <span className="ml-auto text-[12px] text-muted">{fmtDate(r.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="px-4 py-6 text-sm text-muted">Aucun avis.</p>}
              </Panel>
            </>
          ) : (
            <Panel><p className="p-4 text-sm text-muted">Les demandes et avis des prestataires sont réservés aux administrateurs.</p></Panel>
          )}
        </div>
        <Panel title="Vitrine publique" id="va-preview"><div className="p-3"><PublicPreview v={v} /></div></Panel>
      </div>
    </>
  );
}
