"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Chevron, Close } from "./icons";

export type ViewerStory = { key: string; title: string; frames: { image: string; caption: string }[]; name: string; meta: string; avatar: string; href?: string };

const MS = 5000;

/** Visionneuse plein écran façon Instagram : barres de progression, tap gauche/droite, clavier, glisser vers le bas */
export function StoryViewer({ stories, index, onClose, cta }: { stories: ViewerStory[]; index: number | null; onClose: () => void; cta?: { label: string; onClick: () => void } }) {
  // position (story, image) ; remise à zéro quand on ouvre une autre story (pendant le rendu, sans effet)
  const [pos, setPos] = useState({ from: index, v: index ?? 0, i: 0 });
  if (pos.from !== index) setPos({ from: index, v: index ?? 0, i: 0 });
  const { v, i } = pos;
  const setV = (x: number) => setPos((p) => ({ ...p, v: x }));
  const setI = (x: number) => setPos((p) => ({ ...p, i: x }));
  const closeRef = useRef<HTMLButtonElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const open = index !== null;
  const story = stories[v];

  const next = useCallback(() => {
    if (!story) return;
    if (i < story.frames.length - 1) setI(i + 1);
    else if (v < stories.length - 1) { setV(v + 1); setI(0); }
    else onClose();
  }, [i, v, story, stories.length, onClose]);
  const prev = useCallback(() => {
    if (i > 0) setI(i - 1);
    else if (v > 0) { setV(v - 1); setI(0); }
  }, [i, v]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    document.documentElement.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "Tab") { // piège de focus
        const f = [...(frameRef.current?.parentElement?.querySelectorAll<HTMLElement>("button, a") ?? [])];
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    };
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("keydown", key); document.documentElement.style.overflow = ""; };
  }, [open, next, prev, onClose]);
  useEffect(() => {
    if (!open || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setTimeout(next, MS);
    return () => clearTimeout(t);
  }, [open, v, i, next]);

  const ty = useRef<number | null>(null);
  if (!story) return null;
  const f = story.frames[i];
  return (
    <div className={`sv${open ? " is-open" : ""}`} role="dialog" aria-modal="true" aria-label={`Story : ${story.title}`} aria-hidden={!open} inert={!open}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onTouchStart={(e) => { ty.current = e.touches[0].clientY; }} onTouchEnd={(e) => { if (ty.current !== null && e.changedTouches[0].clientY - ty.current > 90) onClose(); ty.current = null; }}>
      <button className="sv-nav prev" aria-label="Story précédente" onClick={() => { if (v > 0) { setV(v - 1); setI(0); } }}><Chevron dir="left" /></button>
      <div className="sv-frame" ref={frameRef}>
        {open && f && <Image key={f.image} className="sv-img" src={f.image} alt={`${story.name} — ${f.caption || story.title}`} fill sizes="(max-width: 640px) 100vw, 500px" />}
        <div className="sv-bars">{story.frames.map((x, k) => <span key={x.image + k} className={k < i ? "done" : k === i ? "run" : ""}><i /></span>)}</div>
        <div className="sv-head">
          <Image src={story.avatar} alt="" width={36} height={36} />
          <div className="meta"><strong>{story.name}</strong><small>{story.meta}</small></div>
          <button ref={closeRef} className="sv-close" aria-label="Fermer la story" onClick={onClose}><Close /></button>
        </div>
        <button className="sv-tap prev" aria-label="Image précédente" onClick={prev} />
        <button className="sv-tap next" aria-label="Image suivante" onClick={next} />
        <div className="sv-foot">
          <p>{f?.caption || story.title}</p>
          {cta ? <button className="btn btn-gold" onClick={cta.onClick}>{cta.label}</button>
            : story.href && <Link className="btn btn-gold" href={story.href}>Voir le profil</Link>}
        </div>
      </div>
      <button className="sv-nav next" aria-label="Story suivante" onClick={() => { if (v < stories.length - 1) { setV(v + 1); setI(0); } else onClose(); }}><Chevron dir="right" /></button>
    </div>
  );
}
