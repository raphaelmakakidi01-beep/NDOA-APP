"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Category, Slide } from "@/lib/public/types";
import { vendorUrl } from "./format";
import { Search } from "./icons";

const DUR = 6500;
// mouvement réduit ou onglet masqué : pas de défilement automatique
const subscribe = (cb: () => void) => {
  const mq = matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb); document.addEventListener("visibilitychange", cb);
  return () => { mq.removeEventListener("change", cb); document.removeEventListener("visibilitychange", cb); };
};
const stilled = () => matchMedia("(prefers-reduced-motion: reduce)").matches || document.hidden;
const BUDGETS = [["0-500", "Moins de 500 USD"], ["500-1500", "500 – 1 500 USD"], ["1500-5000", "1 500 – 5 000 USD"], ["5000+", "Plus de 5 000 USD"]];

/** Héros : réalisations des prestataires en diaporama (photo, prestataire, lien vers son profil) + recherche */
export function Hero({ slides, categories, cities, texts }: { slides: Slide[]; categories: Category[]; cities: string[]; texts?: { title?: string; subtitle?: string } }) {
  const [i, setI] = useState(0);
  const [userPaused, setPaused] = useState(false);
  const still = useSyncExternalStore(subscribe, stilled, () => false);
  const paused = userPaused || still;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const n = slides.length;
  const go = useCallback((k: number) => setI(((k % n) + n) % n), [n]);

  useEffect(() => {
    if (paused || n < 2) return;
    timer.current = setTimeout(() => go(i + 1), DUR);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [i, paused, n, go]);

  const s = slides[i];
  return (
    <section className={`hero${paused ? " is-paused" : ""}`} aria-roledescription="carrousel" aria-label="Réalisations de nos prestataires">
      <div className="hero-slides">
        {n === 0 && <div className="hero-slide ph is-active"><Image src="https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?auto=format&fit=crop&w=2200&q=72" alt="" fill sizes="100vw" priority /></div>}
        {slides.map((x, k) => (
          <div key={x.image + k} className={`hero-slide ph${k === i ? " is-active" : ""}`} aria-hidden={k !== i}>
            <Image src={x.image} alt={x.title || `Réalisation de ${x.vendor.name}`} fill sizes="100vw" priority={k === 0} />
          </div>
        ))}
      </div>
      <div className="hero-shade" />

      {s && (
        <div className="hero-widget">
          <div className="hw-head">
            <span className="hw-num" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
            <div className="hero-bars" role="group" aria-label="Choisir une réalisation">
              {slides.map((x, k) => (
                <button key={x.image + k} className={`hero-bar${k === i ? " active" : ""}${k < i ? " done" : ""}`} style={{ "--d": `${DUR}ms` } as React.CSSProperties}
                  aria-label={`Réalisation ${k + 1} : ${x.vendor.name}`} aria-current={k === i} onClick={() => go(k)}><span><i /></span></button>
              ))}
            </div>
            <span className="hw-num" aria-hidden="true">{String(n).padStart(2, "0")}</span>
            <button className="hero-pause" aria-label={paused ? "Reprendre le diaporama" : "Mettre le diaporama en pause"} onClick={() => setPaused(!userPaused)}>
              {paused
                ? <svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M3 1.5v9l7-4.5z" /></svg>
                : <svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><rect x="2" y="1" width="2.6" height="10" rx="1" /><rect x="7.4" y="1" width="2.6" height="10" rx="1" /></svg>}
            </button>
          </div>
          <Link className="hero-credit" href={vendorUrl(s.vendor.slug)} data-cursor="Voir">
            <Image className="hero-credit-avatar" src={s.vendor.avatar} alt="" width={28} height={28} />
            <span className="lbl">{s.video ? "Vidéo" : "Photo"}</span>
            <span className="fade"><strong>{s.title || s.vendor.name}</strong></span>
            <small className="fade">— {s.subtitle || (s.title ? `${s.vendor.name}, ${s.vendor.city}` : `${s.vendor.catName}, ${s.vendor.city}`)}</small>
            <span className="go" aria-hidden="true">↗</span>
          </Link>
        </div>
      )}

      <div className="container hero-inner">
        {texts?.title ? (
          // titre édité dans l'admin : lignes de deux mots animées, dernier mot en or
          <h1 className="display hero-title">
            {heroLines(texts.title).map((line, li, all) => (
              <span key={li}>
                <span className="line">{line.map((w, wi) => {
                  const last = li === all.length - 1 && wi === line.length - 1;
                  return <span key={wi}>{wi > 0 && " "}{last ? <em className="w gold-text hero-accent">{w}</em> : <span className="w">{w}</span>}</span>;
                })}</span>{li < all.length - 1 && " "}
              </span>
            ))}
          </h1>
        ) : (
          <h1 className="display hero-title">
            <span className="line"><span className="w">Les</span> <span className="w">meilleurs</span></span>{" "}
            <span className="line"><span className="w">prestataires</span> <span className="w">pour</span></span>{" "}
            <span className="line"><span className="w">votre</span> <em className="w gold-text hero-accent">mariage.</em></span>
          </h1>
        )}
        <p className="hero-sub">{texts?.subtitle ?? <>Photographes, salles, traiteurs, DJ, décorateurs… Trouvez, comparez et réservez les meilleurs talents{cities.length ? <> à <b>{cities.slice(0, 4).join(", ")}</b></> : " en RDC"}.</>}</p>

        <form className="search glass" action="/prestataires" method="get" role="search" aria-label="Rechercher un prestataire">
          <div className="field f-what">
            <label htmlFor="s-cat">Prestataire</label>
            <select id="s-cat" name="categorie" defaultValue="">
              <option value="">Tous les métiers</option>
              {categories.map((c) => <option key={c.slug} value={c.slug}>{c.plural}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="s-ville">Ville</label>
            <select id="s-ville" name="ville" defaultValue="">
              <option value="">Toutes</option>
              {cities.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="s-date">Date</label>
            <input id="s-date" name="date" type="date" />
          </div>
          <div className="field">
            <label htmlFor="s-budget">Budget</label>
            <select id="s-budget" name="budget" defaultValue="">
              <option value="">Tous</option>
              {BUDGETS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <button className="btn btn-gold" type="submit"><Search />Rechercher</button>
        </form>
      </div>
    </section>
  );
}

/** Découpe un titre en lignes de deux mots (comme le titre d'origine) */
function heroLines(title: string) {
  const words = title.trim().split(/\s+/).slice(0, 12);
  const lines: string[][] = [];
  for (let i = 0; i < words.length; i += 2) lines.push(words.slice(i, i + 2));
  return lines;
}
