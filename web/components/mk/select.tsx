"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Option = { value: string; label: string };
type Place = { left: number; width: number; top?: number; bottom?: number; maxHeight: number };

const GAP = 8;

/**
 * Liste déroulante aux couleurs du site, à la place du menu natif que le navigateur dessine lui-même.
 * Se soumet comme un <select> (champ caché) et se pilote au clavier (flèches, Début/Fin, Entrée, Échap, première lettre).
 * Rendue hors du formulaire : le verre de la recherche et le héros couperaient sinon le menu.
 */
export function Select({ id, name, options, defaultValue = "" }: { id?: string; name: string; options: readonly Option[]; defaultValue?: string }) {
  const listId = useId();
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [value, setValue] = useState(defaultValue);
  const [active, setActive] = useState(0);
  const [place, setPlace] = useState<Place | null>(null);
  const [root, setRoot] = useState<Element | null>(null);
  const open = !!place;
  const current = options.find((o) => o.value === value) ?? options[0];

  const close = useCallback(() => setPlace(null), []);
  const show = () => {
    setRoot(btn.current!.closest(".mk") ?? document.body);
    const r = btn.current!.getBoundingClientRect();
    const below = innerHeight - r.bottom - GAP * 2, above = r.top - GAP * 2;
    const up = below < 220 && above > below;
    const width = Math.max(r.width, 200);
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setPlace({
      left: Math.max(GAP, Math.min(r.left, innerWidth - width - GAP)), width,
      ...(up ? { bottom: innerHeight - r.top + GAP } : { top: r.bottom + GAP }),
      maxHeight: Math.min(320, up ? above : below),
    });
  };
  const choose = (i: number) => { setValue(options[i].value); close(); };

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => { if (!list.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) close(); };
    // Le menu est fixe à l'écran : on le ferme quand la page bouge, sauf si on fait défiler le menu lui-même
    const moved = (e: Event) => { if (!list.current?.contains(e.target as Node)) close(); };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("scroll", moved, { capture: true, passive: true });
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("scroll", moved, { capture: true });
      window.removeEventListener("resize", close);
    };
  }, [open, close]);

  useEffect(() => {
    if (open) list.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const last = options.length - 1;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); show(); }
      return;
    }
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === "Tab") close();
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(last, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(last); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(active); }
    else if (e.key.length === 1) {
      const i = options.findIndex((o) => o.label.toLowerCase().startsWith(e.key.toLowerCase()));
      if (i >= 0) setActive(i);
    }
  };

  return (
    <>
      <input type="hidden" name={name} value={value} />
      <button ref={btn} id={id} type="button" className="sel-btn" role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${active}` : undefined} onClick={() => (open ? close() : show())} onKeyDown={onKeyDown}>
        <span className="sel-value">{current?.label}</span>
        <svg className="sel-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {place && root && createPortal(
        <ul ref={list} id={listId} className={`sel-list${place.bottom != null ? " up" : ""}`} role="listbox" style={place}>
          {options.map((o, i) => (
            <li key={o.value || "tous"} id={`${listId}-${i}`} role="option" aria-selected={o.value === value} className={i === active ? "on" : undefined}
              onPointerMove={() => setActive(i)} onClick={() => { choose(i); btn.current?.focus(); }}>
              {o.label}
              {o.value === value && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>}
            </li>
          ))}
        </ul>,
        root,
      )}
    </>
  );
}
