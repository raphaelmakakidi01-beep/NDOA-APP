"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import type { Story, Testimonial } from "@/lib/public/types";
import { vendorUrl } from "./format";
import { Chevron, Star } from "./icons";
import { StoryViewer } from "./story-viewer";

/** Rangée de stories mises en avant (admin) + visionneuse */
export function StoriesRow({ stories }: { stories: Story[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const [seen, setSeen] = useState<Set<number>>(new Set());
  const opener = useRef<HTMLButtonElement | null>(null);
  return (
    <>
      <div className="stories-row">
        {stories.map((s, i) => (
          <button key={s.id} className={`story${seen.has(i) ? " seen" : ""}`} onClick={(e) => { opener.current = e.currentTarget; setSeen(new Set(seen).add(i)); setOpen(i); }}>
            <span className="story-ring"><Image src={s.ring} alt="" width={104} height={104} sizes="104px" /></span>
            <span className="sr-only">Voir la story de </span><span className="story-name">{s.vendor.name}</span>
          </button>
        ))}
      </div>
      <StoryViewer index={open} onClose={() => { setOpen(null); opener.current?.focus(); }}
        stories={stories.map((s) => ({ key: s.id, title: s.title, frames: s.frames, name: s.vendor.name, meta: `${s.vendor.catName} · ${s.vendor.city}`, avatar: s.vendor.avatar, href: vendorUrl(s.vendor.slug) }))} />
    </>
  );
}

/** Témoignages : avis publiés par les couples (vrais avis, notés 4 ou 5) */
export function Testimonials({ items }: { items: Testimonial[] }) {
  const track = useRef<HTMLDivElement>(null);
  const step = (d: number) => {
    const card = track.current?.querySelector<HTMLElement>(".tm");
    track.current?.scrollBy({ left: d * ((card?.offsetWidth ?? 300) + 20), behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };
  return (
    <>
      {items.length > 1 && (
        <div className="tm-ctrl">
          <button className="round" aria-label="Témoignage précédent" onClick={() => step(-1)}><Chevron dir="left" /></button>
          <button className="round" aria-label="Témoignage suivant" onClick={() => step(1)}><Chevron dir="right" /></button>
        </div>
      )}
      <div className="tm-track tm-text" ref={track} tabIndex={0} aria-label="Témoignages de mariés"
        onKeyDown={(e) => { if (e.key === "ArrowRight") { e.preventDefault(); step(1); } if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); } }}>
        {items.map((t, i) => (
          <figure className="tm" key={t.names + i}>
            <div className="tm-body">
              <div>
                <div className="stars" role="img" aria-label={`Note : ${t.rating} sur 5`}>{Array.from({ length: t.rating }, (_, k) => <Star key={k} />)}</div>
                <blockquote>« {t.text} »</blockquote>
              </div>
              <figcaption className="tm-who"><strong>{t.names}</strong><span>{[t.city, t.date].filter(Boolean).join(" · ")}</span><br /><Link href={vendorUrl(t.vendor.slug)}>Avec {t.vendor.name} →</Link></figcaption>
            </div>
          </figure>
        ))}
      </div>
    </>
  );
}
