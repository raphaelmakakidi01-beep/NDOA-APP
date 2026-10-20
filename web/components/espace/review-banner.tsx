"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Ban, Clock, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useEspaceMaybe } from "@/lib/espace/store";
import { getSupabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Statut de validation de la vitrine (file de validation NDOA) :
 * en attente, à corriger (motif de l'équipe + renvoi), ou suspendue.
 */
export function ReviewBanner() {
  const ctx = useEspaceMaybe();
  const [busy, setBusy] = React.useState(false);
  const review = ctx?.vendor.review;
  if (!review || !["pending_review", "rejected", "suspended"].includes(review.status)) return null;

  async function resubmit() {
    const sb = getSupabase();
    if (!sb || !ctx?.vendor.vendorId) return;
    setBusy(true);
    // repasser en « publiée » renvoie automatiquement la vitrine dans la file de validation
    const { error } = await sb.from("vendors").update({ status: "published" }).eq("id", ctx.vendor.vendorId);
    setBusy(false);
    if (error) {
      toast.error(/PUBLISH_NEEDS_6_PHOTOS/.test(error.message) ? "Il faut au moins 6 photos." : /PUBLISH_NEEDS/.test(error.message) ? "Votre vitrine est incomplète (forfait, contact ou activité)." : "Envoi impossible. Réessayez.");
      return;
    }
    toast.success("Vitrine renvoyée en validation", { description: "Vous serez prévenu par e-mail dès sa mise en ligne." });
    window.location.reload();
  }

  const conf = {
    pending_review: { icon: Clock, cls: "border-gold/50 bg-gold/10", iconCls: "text-gold-ink", title: "Votre vitrine est en cours de validation",
      text: "L’équipe NDOA la vérifie, généralement sous 24 h. Elle n’est pas encore visible des couples : vous serez prévenu par e-mail dès sa mise en ligne." },
    rejected: { icon: AlertTriangle, cls: "border-rose/50 bg-rose/10", iconCls: "text-rose-ink", title: "Quelques corrections avant la mise en ligne",
      text: review.reason ?? "Consultez l’e-mail de l’équipe NDOA." },
    suspended: { icon: Ban, cls: "border-danger/40 bg-danger/10", iconCls: "text-danger", title: "Votre vitrine est suspendue",
      text: `${review.reason ? `Motif : ${review.reason}. ` : ""}Contactez l’équipe NDOA pour en savoir plus.` },
  }[review.status as "pending_review" | "rejected" | "suspended"];

  return (
    <div role="status" className={cn("mb-6 flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center", conf.cls)}>
      <conf.icon className={cn("size-5 shrink-0", conf.iconCls)} aria-hidden />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">{conf.title}</p>
        <p className="mt-0.5 text-muted">{conf.text}</p>
      </div>
      {review.status === "rejected" && (
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button asChild variant="outline" size="sm"><Link href="/espace/vitrine">Corriger ma vitrine</Link></Button>
          <Button size="sm" loading={busy} onClick={resubmit}><Send aria-hidden />Renvoyer en validation</Button>
        </div>
      )}
    </div>
  );
}
