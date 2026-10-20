"use client";

import { useState } from "react";
import { profileUrl } from "@/lib/config";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Check, Copy, LayoutDashboard, Monitor, PartyPopper, Smartphone, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { useOnboarding } from "@/lib/onboarding/store";
import { publishChecklist } from "@/lib/onboarding/rules";
import { goldConfetti } from "@/lib/confetti";
import { cn } from "@/lib/utils";
import { ProfilePreview } from "./profile-preview";
import { DeviceFrame } from "@/components/shared/device-frame";
import { ScoreCard } from "./shell";

export function StepApercu() {
  const { draft, publish, saving } = useOnboarding();
  const [device, setDevice] = useState<"desktop" | "mobile">("mobile");
  const [celebrate, setCelebrate] = useState(false);
  const checklist = publishChecklist(draft);
  const ready = checklist.every((c) => c.ok);
  const published = !!draft.publishedAt;
  const publicUrl = profileUrl(draft.slug);

  async function onPublish() {
    const ok = await publish();
    if (ok) { setCelebrate(true); goldConfetti(); }
  }

  return (
    <>
      {published ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10 rounded-3xl border border-gold/50 bg-surface p-6 sm:p-8">
          <span className="mb-4 grid size-14 place-items-center rounded-2xl bg-gold text-on-gold"><PartyPopper className="size-6" aria-hidden /></span>
          <h1 className="font-display text-[1.9rem] leading-[1.08] sm:text-[2.4rem]">Votre vitrine est <em className="text-gold-ink">en ligne</em>.</h1>
          <p className="mt-3 max-w-xl text-muted">Les mariés peuvent désormais vous trouver et vous envoyer des demandes de devis. Complétez votre profil pour remonter dans les résultats.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg"><Link href="/espace"><LayoutDashboard aria-hidden />Aller au tableau de bord</Link></Button>
            <Button variant="outline" size="lg" onClick={async () => { try { await navigator.clipboard.writeText(publicUrl); toast.success("Lien copié", { description: publicUrl }); } catch { toast.error("Copie impossible"); } }}>
              <Copy aria-hidden />Copier le lien de ma page
            </Button>
          </div>
        </motion.div>
      ) : (
        <div className="mb-7 max-w-xl">
          <h1 className="font-display text-[1.9rem] leading-[1.08] sm:text-[2.4rem]">Prêt à <em className="text-gold-ink">briller</em> ?</h1>
          <p className="mt-2 text-[15px] text-muted">Voici ce que verront les mariés. Tout reste modifiable ensuite.</p>
        </div>
      )}

      <div className={cn("grid gap-6", !published && "lg:grid-cols-[minmax(0,1fr)_290px]")}>
        <div className="min-w-0">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">Aperçu de votre page publique</p>
            <Segmented label="Appareil d’aperçu" layoutId="device" value={device} onChange={setDevice}
              options={[
                { value: "mobile", label: <span className="inline-flex items-center gap-1.5"><Smartphone className="size-4" aria-hidden /><span className="hidden sm:inline">Mobile</span></span> },
                { value: "desktop", label: <span className="inline-flex items-center gap-1.5"><Monitor className="size-4" aria-hidden /><span className="hidden sm:inline">Ordinateur</span></span> },
              ]} />
          </div>
          <DeviceFrame device={device}><ProfilePreview d={draft} compact={device === "mobile"} /></DeviceFrame>
        </div>

        <div className="grid content-start gap-6">
          {!published && (
            <section className="rounded-3xl border border-line bg-surface p-5" aria-labelledby="pub-title">
              <h2 id="pub-title" className="font-display text-xl">Avant de publier</h2>
              <ul className="mt-4 grid gap-2.5">
                {checklist.map((c) => (
                  <li key={c.label} className="flex items-start gap-3 text-sm">
                    <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full", c.ok ? "bg-success text-bg" : "border border-danger text-danger")}>
                      {c.ok ? <Check className="size-3" strokeWidth={3} aria-hidden /> : <X className="size-3" strokeWidth={3} aria-hidden />}
                    </span>
                    <span className="flex-1">{c.label}<span className="sr-only">{c.ok ? " : fait" : " : à compléter"}</span></span>
                    {!c.ok && <Link href={`/onboarding/${c.step}`} className="font-semibold text-gold-ink underline-offset-4 hover:underline">Compléter</Link>}
                  </li>
                ))}
              </ul>
              <Button size="lg" className="mt-6 w-full" disabled={!ready} loading={saving} onClick={onPublish}>
                Publier ma vitrine{!saving && <ArrowRight aria-hidden />}
              </Button>
              {!ready && <p className="mt-3 text-center text-[13px] text-muted">Complétez les éléments en rouge pour publier.</p>}
            </section>
          )}
          <ScoreCard />
        </div>
      </div>

      {celebrate && (
        <div role="status" aria-live="polite" className="sr-only">Félicitations, votre vitrine est publiée.</div>
      )}
    </>
  );
}
