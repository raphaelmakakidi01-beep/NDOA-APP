"use client";

import { MessageCircle } from "lucide-react";
import { ProfilePreview } from "@/components/onboarding/profile-preview";
import { DEMO_AVATAR, DEMO_PHOTOS, U } from "@/lib/onboarding/catalog";
import { emptyDraft, type Draft, type MediaRef } from "@/lib/onboarding/types";

const ref = (id: string, w: number, i = 0): MediaRef => ({ id: `${id}-${i}`, url: U(id, w), source: "remote", name: "", size: 1, status: "ready", progress: 100 });

/** Vitrine d’exemple, rendue avec le même composant que l’aperçu de l’onboarding */
const SAMPLE: Draft = {
  ...emptyDraft(),
  categories: ["photographe"], primaryCategory: "photographe",
  name: "Studio Lumière Mbala", slug: "studio-lumiere-mbala",
  tagline: "Reportages de mariage éditoriaux, du coutumier à la soirée.",
  city: "Kinshasa", zones: ["Kongo-Central"], styleTags: ["Éditorial", "Lumière naturelle", "Coutumier"],
  avatar: ref(DEMO_AVATAR, 200), cover: ref(DEMO_PHOTOS[2], 800),
  photos: DEMO_PHOTOS.slice(0, 6).map((id, i) => ref(id, 400, i)),
  pkg: { ...emptyDraft().pkg, name: "Essentiel", amount: "850", includes: ["Reportage de la journée", "300 photos retouchées", "Galerie privée en ligne"] },
};

export function PhoneMockup() {
  return (
    <figure className="relative mx-auto w-full max-w-[340px]">
      <div className="rounded-[46px] border border-line-strong bg-black p-2.5 shadow-[0_40px_90px_-30px_rgba(0,0,0,.65)]">
        <div className="relative h-[600px] overflow-hidden rounded-[38px]" aria-hidden>
          <span className="absolute left-1/2 top-2 z-10 h-6 w-24 -translate-x-1/2 rounded-full bg-black" />
          <div className="pointer-events-none select-none"><ProfilePreview d={SAMPLE} compact /></div>
          <span className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black to-transparent" />
        </div>
      </div>
      {/* ce que reçoit le prestataire quand un couple écrit depuis la vitrine */}
      <div className="absolute left-0 bottom-16 w-[250px] rounded-2xl border border-line bg-surface p-3.5 shadow-xl sm:-left-16" aria-hidden>
        <p className="flex items-center gap-2 text-xs font-bold text-gold-ink"><MessageCircle className="size-4" />Nouvelle demande de devis</p>
        <p className="mt-1.5 text-sm font-semibold">Grâce & Patrick</p>
        <p className="text-xs text-muted">Mariage le 14 juin · Kinshasa · 250 invités</p>
      </div>
      <figcaption className="sr-only">Exemple de vitrine NDOA sur téléphone, avec une demande de devis reçue.</figcaption>
    </figure>
  );
}
