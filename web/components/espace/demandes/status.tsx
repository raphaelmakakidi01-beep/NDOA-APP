"use client";

import { useState } from "react";
import { DropdownMenu } from "radix-ui";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/field";
import { StatusTag, dateFr } from "@/components/ui/bits";
import { useEspace } from "@/lib/espace/store";
import { useBusiness } from "@/lib/espace/business";
import { INQUIRY_STATUS, type InquiryStatus } from "@/lib/espace/types";
import { cn } from "@/lib/utils";

export const STATUS_ORDER: InquiryStatus[] = ["new", "discussing", "quote_sent", "confirmed", "lost"];
const LOST_REASONS = ["Budget", "Date déjà prise ailleurs", "A choisi un autre prestataire", "Plus de nouvelles", "Mariage annulé ou reporté"];

/**
 * Changement de statut avec garde-fous :
 * « Perdu » demande une raison, « Confirmé » demande une confirmation (la date sera bloquée).
 */
export function useStatusFlow() {
  const { data } = useEspace();
  const biz = useBusiness();
  const [pending, setPending] = useState<{ id: string; status: InquiryStatus } | null>(null);
  const [reason, setReason] = useState(LOST_REASONS[0]);
  const [other, setOther] = useState("");
  const q = pending ? data.inquiries.find((x) => x.id === pending.id) : undefined;

  const request = (id: string, status: InquiryStatus) => {
    if (status === "lost" || status === "confirmed") { setReason(LOST_REASONS[0]); setOther(""); setPending({ id, status }); }
    else biz.setStatus(id, status);
  };
  const close = () => setPending(null);
  const conflict = q && pending?.status === "confirmed" ? data.availability[q.weddingDate] : undefined;

  const dialogs = (
    <Dialog open={!!pending} onOpenChange={(o) => !o && close()}
      title={pending?.status === "lost" ? "Marquer comme perdue" : `Confirmer le mariage de ${q?.couple ?? ""}`}
      description={pending?.status === "lost" ? "La raison reste privée. Elle alimente vos statistiques de conversion." : q ? `Le ${dateFr(q.weddingDate, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} sera marqué réservé dans votre calendrier et sur votre page publique.` : undefined}
      footer={<>
        <Button variant="ghost" onClick={close}>Annuler</Button>
        {pending?.status === "lost"
          ? <Button variant="danger" onClick={() => { biz.setStatus(pending.id, "lost", reason === "Autre" ? other.trim() || "Autre" : reason); close(); }}>Marquer perdue</Button>
          : <Button onClick={() => { if (pending) biz.setStatus(pending.id, "confirmed"); close(); }}><Check aria-hidden />Confirmer</Button>}
      </>}>
      {pending?.status === "lost" ? (
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-semibold">Pourquoi cette demande n’a pas abouti ?</legend>
          {[...LOST_REASONS, "Autre"].map((r) => (
            <label key={r} className="flex h-12 cursor-pointer items-center gap-3 rounded-xl border border-line px-4 text-[15px] has-[:checked]:border-gold has-[:checked]:bg-gold/8 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold/40">
              <input type="radio" name="lost-reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="size-4 accent-[var(--color-gold)]" />{r}
            </label>
          ))}
          {reason === "Autre" && <Input aria-label="Précisez la raison" value={other} onChange={(e) => setOther(e.target.value)} maxLength={80} placeholder="Précisez…" autoFocus />}
        </fieldset>
      ) : conflict && conflict.inquiryId !== pending?.id ? (
        <p role="alert" className="rounded-2xl border border-danger/40 bg-danger/8 px-4 py-3 text-sm">
          Attention : cette date est déjà {conflict.status === "booked" ? "réservée" : conflict.status === "blocked" ? "bloquée" : "en option"}{conflict.note ? ` (${conflict.note})` : ""}. Vérifiez que vous pouvez honorer les deux engagements.
        </p>
      ) : (
        <p className="text-sm text-muted">Le couple sera notifié et pourra vous laisser un avis après le mariage.</p>
      )}
    </Dialog>
  );
  return { request, dialogs };
}

/** Menu de statut (alternative clavier/lecteur d’écran au glisser-déposer) */
export function StatusMenu({ id, status, onChange, className }: { id: string; status: InquiryStatus; onChange: (id: string, s: InquiryStatus) => void; className?: string }) {
  const s = INQUIRY_STATUS[status];
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className={cn("group inline-flex items-center gap-1 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-gold/50", className)} aria-label={`Statut : ${s.label}. Changer le statut`}>
        <StatusTag tone={s.tone}>{s.label}<ChevronDown className="size-3 opacity-70 transition-transform group-data-[state=open]:rotate-180" aria-hidden /></StatusTag>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="start" sideOffset={6} className="z-50 min-w-52 rounded-2xl border border-line bg-surface p-1.5 shadow-2xl">
          <DropdownMenu.RadioGroup value={status} onValueChange={(v) => onChange(id, v as InquiryStatus)}>
            {STATUS_ORDER.map((k) => (
              <DropdownMenu.RadioItem key={k} value={k} className="flex h-10 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm outline-none data-[highlighted]:bg-surface-2">
                <span className="grid size-4 place-items-center"><DropdownMenu.ItemIndicator><Check className="size-4 text-gold-ink" aria-hidden /></DropdownMenu.ItemIndicator></span>
                <StatusTag tone={INQUIRY_STATUS[k].tone}>{INQUIRY_STATUS[k].label}</StatusTag>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
