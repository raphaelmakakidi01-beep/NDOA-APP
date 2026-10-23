"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import type { Card } from "@/lib/public/types";
import { toggle, useCouple } from "@/lib/public/couple";
import { compact, fmt, priceLabel, rate, vendorUrl } from "./format";
import { Heart, Star, Verified } from "./icons";

/** Carte du feed : survol / focus = feuilletage de la galerie ; ♥ = favori, « Suivre » = abonnement (compte couple) */
export function VendorCard({ v, sizes = "(max-width: 700px) 92vw, (max-width: 1200px) 46vw, 30vw" }: { v: Card; sizes?: string }) {
  const couple = useCouple();
  const liked = couple.favorites.has(v.id), followed = couple.follows.has(v.id);
  const [k, setK] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const start = () => {
    if (timer.current || v.gallery.length < 2 || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setK((x) => (x + 1) % v.gallery.length);
    timer.current = setInterval(() => setK((x) => (x + 1) % v.gallery.length), 1100);
  };
  const stop = () => { if (timer.current) clearInterval(timer.current); timer.current = null; setK(0); };

  return (
    <article className="card" onMouseEnter={start} onMouseLeave={stop} onFocus={start} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) stop(); }}>
      <div className="card-cover ph">
        {v.gallery.map((g, i) => (
          <Image key={g + i} src={g} alt={i === 0 ? `Réalisation de ${v.name}` : ""} fill sizes={sizes} className={i === k ? "on" : ""} />
        ))}
        <div className="card-dots" aria-hidden="true">{v.gallery.map((g, i) => <i key={g + i} className={i === k ? "on" : ""} />)}</div>
        <button type="button" className={`like glass${liked ? " pop" : ""}`} aria-pressed={liked} aria-label={`${liked ? "Retirer des favoris" : "Ajouter aux favoris"} : ${v.name}`}
          onClick={() => toggle("favorites", v.id)}>
          <span className="burst" aria-hidden="true">{Array.from({ length: 8 }, (_, i) => <i key={i} style={{ "--r": `${i * 45}deg` } as React.CSSProperties} />)}</span>
          <Heart />
        </button>
      </div>
      <div className="card-body">
        <div className="card-top">
          <Image className="card-avatar" src={v.avatar} alt="" width={64} height={64} />
          <button type="button" className="follow" aria-pressed={followed} aria-label={`${followed ? "Ne plus suivre" : "Suivre"} ${v.name}`} onClick={() => toggle("follows", v.id)}>
            {followed ? "Suivi ✓" : "+ Suivre"}
          </button>
        </div>
        <h3><Link href={vendorUrl(v.slug)} data-cursor="Voir">{v.name}</Link>{v.verified && <Verified />}</h3>
        <p className="card-sub">{v.catName} · {v.city}{v.followers > 0 && <> · {compact(v.followers)} abonnés</>}</p>
        <div className="card-foot">
          <span className="rating"><Star />{rate(v)}{v.reviews > 0 && <small> ({fmt(v.reviews)})</small>}</span>
          <span className="price">{v.price != null && "à partir de"}<b>{priceLabel(v)}</b></span>
        </div>
      </div>
    </article>
  );
}
