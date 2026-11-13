"use client";

import * as React from "react";
import { WarpCarousel, type WarpCard } from "@/components/ui/warp-carousel";
import type { Partner } from "@/lib/public/types";
import { Arrow } from "./icons";

// Dégradés des cartes, aux couleurs NDOA (noir, or, bordeaux), en alternance
const MESHES = [
  ["#0A0A0B", "#17171A", "#2a1f12", "#0A0A0B", "#3a2a14", "#6b5030", "#17171A", "#8B6A3A", "#2a1f12", "#0A0A0B", "#1F1F23", "#0A0A0B"],
  ["#0A0A0B", "#1a0d0a", "#3d1a10", "#6e3220", "#17171A", "#4a1d12", "#0A0A0B", "#2a120c", "#8B4026", "#1F1F23", "#0A0A0B", "#140808"],
  ["#17171A", "#1F1F23", "#0A0A0B", "#2b2b31", "#17171A", "#33302c", "#0A0A0B", "#1F1F23", "#5b4a33", "#17171A", "#0A0A0B", "#1F1F23"],
];

/** Visuel servi par Next (même origine) : il peut être peint dans le canvas du carrousel */
const sameOrigin = (src: string) => (src.startsWith("/") && !src.startsWith("//") ? src : `/_next/image?url=${encodeURIComponent(src)}&w=828&q=75`);

/** Nos partenaires : carrousel 3D des publicités + légende de la publicité de face, avec son lien */
export function PartnersCarousel({ partners }: { partners: Partner[] }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [active, setActive] = React.useState(0);
  const [fonts, setFonts] = React.useState<{ sans: string; serif: string } | null>(null);

  // polices du site (next/font) lues sur la page, pour les textes peints dans les cartes
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const serifEl = el.querySelector<HTMLElement>(".pc-serif-probe");
    setFonts({ sans: getComputedStyle(el).fontFamily, serif: serifEl ? getComputedStyle(serifEl).fontFamily : "Georgia, serif" });
  }, []);

  const cards = React.useMemo<WarpCard[]>(() => partners.map((p, i) => ({
    image: sameOrigin(p.image), badge: "Partenaire", title: p.partner, text: p.title || undefined,
    footer: p.link ? "Découvrir  →" : undefined, mesh: MESHES[i % MESHES.length], glow: "#C4975A", accent: "#E6C694",
  })), [partners]);

  const open = React.useCallback((i: number) => {
    const link = partners[i]?.link;
    if (link) window.open(link, "_blank", "noopener,noreferrer");
  }, [partners]);

  const p = partners[active] ?? partners[0];
  if (!p) return null;
  return (
    <div className="pc" ref={ref}>
      <span className="pc-serif-probe" aria-hidden="true" />
      <div className="pc-stage">
        {fonts && (
          <WarpCarousel cards={cards} font={fonts.sans} serif={fonts.serif} background="#0A0A0B" glow="#C4975A" interval={3}
            onIndexChange={setActive} onFrontClick={open} ariaLabel="Publicités de nos partenaires : glissez ou utilisez les flèches" />
        )}
      </div>
      <div className="pc-caption" aria-live="polite">
        <span className="pc-count">{String(active + 1).padStart(2, "0")}<i> / {String(partners.length).padStart(2, "0")}</i></span>
        <div className="pc-text">
          <b>{p.partner}</b>
          {p.title && <span>{p.title}</span>}
        </div>
        {p.link && (
          <a className="btn btn-ghost pc-link" href={p.link} target="_blank" rel="sponsored noopener noreferrer">
            Découvrir <span className="arrow"><Arrow /></span>
          </a>
        )}
      </div>
    </div>
  );
}
