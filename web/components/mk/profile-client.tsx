"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { DEMO } from "@/lib/config";
import { toggle, useCouple } from "@/lib/public/couple";
import type { GalleryItem, Profile } from "@/lib/public/types";
import { getSupabase } from "@/lib/supabase/client";
import { Chevron, Close, Phone, Play, Plus, Share, WhatsApp } from "./icons";
import { useQuote } from "./quote";
import { StoryViewer } from "./story-viewer";

const visitor = () => {
  try {
    let v = localStorage.getItem("ndoa.visitor");
    if (!v) { v = crypto.randomUUID(); localStorage.setItem("ndoa.visitor", v); }
    return v;
  } catch { return ""; }
};

/** Compte la visite du profil dans les statistiques du prestataire */
export function ViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    if (DEMO) return;
    getSupabase()?.rpc("track_event", { p_vendor_slug: slug, p_event: "profile_view", p_source: document.referrer.includes(location.host) ? "recherche" : "direct", p_media_id: null, p_visitor: visitor() });
  }, [slug]);
  return null;
}

function useToast() {
  const [msg, setMsg] = useState("");
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = (m: string) => { setMsg(m); if (t.current) clearTimeout(t.current); t.current = setTimeout(() => setMsg(""), 2600); };
  return { node: <div className={`toast${msg ? " on" : ""}`} role="status" aria-live="polite">{msg}</div>, show };
}

/** Numéro et WhatsApp : demandés au serveur seulement au clic */
function useContact(slug: string) {
  const [c, setC] = useState<{ phone: string; whatsapp: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const reveal = async (type: "phone" | "whatsapp") => {
    if (c) return c;
    setBusy(true);
    const r = await fetch(`/api/prestataires/${slug}/contact?type=${type}&v=${encodeURIComponent(visitor())}`).then((x) => (x.ok ? x.json() : null)).catch(() => null);
    setBusy(false);
    if (r) setC(r);
    return r as { phone: string; whatsapp: string } | null;
  };
  return { c, busy, reveal };
}

export function ProfileActions({ p }: { p: Pick<Profile, "id" | "slug" | "name" | "hasPhone" | "hasWhatsapp"> }) {
  const couple = useCouple();
  const open = useQuote();
  const toast = useToast();
  const { c, busy, reveal } = useContact(p.slug);
  const followed = couple.follows.has(p.id), saved = couple.favorites.has(p.id);
  const wa = async () => {
    const r = await reveal("whatsapp");
    if (r?.whatsapp) window.open(`https://wa.me/${r.whatsapp}?text=${encodeURIComponent(`Bonjour ${p.name}, je vous ai trouvé sur NDOA pour mon mariage.`)}`, "_blank", "noopener");
    else if (!r) toast.show("Numéro indisponible pour le moment");
  };
  const share = async () => {
    const data = { title: `${p.name} sur NDOA Wedding`, url: location.href };
    try { if (navigator.share) await navigator.share(data); else { await navigator.clipboard.writeText(location.href); toast.show("Lien du profil copié"); } }
    catch (e) { if ((e as Error).name !== "AbortError") toast.show("Impossible de partager pour le moment"); }
  };
  return (
    <div className="pp-actions">
      <button className="btn btn-gold" onClick={() => open()}>Demander un devis <span className="arrow">→</span></button>
      {p.hasWhatsapp && <button className="act wa" aria-busy={busy} onClick={wa}><WhatsApp /><span className="lbl">WhatsApp</span></button>}
      {p.hasPhone && (c?.phone
        ? <a className="act reveal" href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}><Phone /><span className="lbl">{c.phone}</span></a>
        : <button className="act" aria-busy={busy} onClick={() => reveal("phone")}><Phone /><span className="lbl">Afficher le numéro</span></button>)}
      <button className="act" aria-pressed={followed} onClick={async () => { if (await toggle("follows", p.id)) toast.show(followed ? "Vous ne suivez plus ce prestataire" : `Vous suivez ${p.name}`); }}>
        <Plus /><span className="lbl">{followed ? "Abonné" : "Suivre"}</span>
      </button>
      <button className="act" aria-pressed={saved} onClick={async () => { if (await toggle("favorites", p.id)) toast.show(saved ? "Retiré de vos favoris" : "Ajouté à vos favoris"); }}>
        <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path className="ico-fill" d="M6 3h12v18l-6-4-6 4z" /></svg><span className="lbl">{saved ? "Enregistré" : "Enregistrer"}</span>
      </button>
      <button className="act" onClick={share}><Share /><span className="lbl">Partager</span></button>
      {toast.node}
    </div>
  );
}

/** Barre fixe mobile : prix + devis + WhatsApp */
export function MobileBar({ p, price }: { p: Pick<Profile, "slug" | "name" | "hasWhatsapp">; price: string }) {
  const open = useQuote();
  const { busy, reveal } = useContact(p.slug);
  return (
    <div className="mbar">
      <div className="price"><small>{price === "sur devis" ? "tarifs" : "à partir de"}</small><b>{price}</b></div>
      {p.hasWhatsapp && <button className="act wa" aria-label="WhatsApp" aria-busy={busy} onClick={async () => { const r = await reveal("whatsapp"); if (r?.whatsapp) window.open(`https://wa.me/${r.whatsapp}`, "_blank", "noopener"); }}><WhatsApp /></button>}
      <button className="btn btn-gold" onClick={() => open()}>Devis</button>
    </div>
  );
}

/** Onglets accessibles (flèches, Début, Fin) ; les panneaux sont rendus côté serveur */
export function Tabs({ tabs }: { tabs: { id: string; label: string; count?: string; panel: React.ReactNode }[] }) {
  const [cur, setCur] = useState(tabs[0].id);
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const ind = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const move = () => { const t = refs.current[cur]; if (t && ind.current) { ind.current.style.width = `${t.offsetWidth}px`; ind.current.style.transform = `translateX(${t.offsetLeft}px)`; } };
    move();
    window.addEventListener("resize", move);
    document.fonts?.ready.then(move);
    return () => window.removeEventListener("resize", move);
  }, [cur]);
  const go = (id: string, focus?: boolean) => { setCur(id); if (focus) refs.current[id]?.focus(); };
  return (
    <>
      <div className="tabs">
        <div className="tablist" role="tablist" aria-label="Sections du profil">
          {tabs.map((t, i) => (
            <button key={t.id} ref={(el) => { refs.current[t.id] = el; }} className="tab" role="tab" id={`tab-${t.id}`} aria-controls={`p-${t.id}`} aria-selected={cur === t.id} tabIndex={cur === t.id ? 0 : -1}
              onClick={() => go(t.id)}
              onKeyDown={(e) => {
                const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
                if (k) { e.preventDefault(); go(tabs[(i + k + tabs.length) % tabs.length].id, true); }
                if (e.key === "Home") { e.preventDefault(); go(tabs[0].id, true); }
                if (e.key === "End") { e.preventDefault(); go(tabs[tabs.length - 1].id, true); }
              }}>
              {t.label}{t.count && <small> {t.count}</small>}
            </button>
          ))}
          <span className="tab-ind" ref={ind} aria-hidden="true" />
        </div>
      </div>
      {tabs.map((t) => (
        <section key={t.id} className={`panel${cur === t.id ? " in" : ""}`} role="tabpanel" id={`p-${t.id}`} aria-labelledby={`tab-${t.id}`} tabIndex={0} hidden={cur !== t.id}>{t.panel}</section>
      ))}
    </>
  );
}

/** Galerie en maçonnerie + filtres (photos, vidéos, albums) + visionneuse plein écran */
export function Gallery({ items, name }: { items: GalleryItem[]; name: string }) {
  const albums = useMemo(() => [...new Set(items.map((g) => g.album).filter(Boolean))], [items]);
  const [f, setF] = useState("all");
  const [k, setK] = useState<number | null>(null);
  const list = items.filter((g) => f === "all" || (f === "photo" && !g.video) || (f === "video" && g.video) || f === `a:${g.album}`);
  const opener = useRef<HTMLButtonElement | null>(null);
  const close = () => { setK(null); opener.current?.focus(); };
  useEffect(() => {
    if (k === null) return;
    document.documentElement.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") setK((x) => (x === null ? x : (x + 1) % list.length));
      if (e.key === "ArrowLeft") setK((x) => (x === null ? x : (x - 1 + list.length) % list.length));
    };
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("keydown", key); document.documentElement.style.overflow = ""; };
  });
  const filters: ([string, string] | null)[] = [["all", "Tout"], ["photo", "Photos"], ...(items.some((g) => g.video) ? [["video", "Vidéos"] as [string, string]] : []), ...(albums.length ? [null, ...albums.map((a) => [`a:${a}`, a] as [string, string])] : [])];
  const g = k === null ? null : list[k];
  const tx = useRef<number | null>(null);
  return (
    <>
      <div className="g-filters" role="group" aria-label="Filtrer la galerie">
        {filters.map((x, i) => x ? <button key={x[0]} type="button" className="chip" aria-pressed={f === x[0]} onClick={() => setF(x[0])}>{x[1]}</button> : <span key={`sep${i}`} className="sep" aria-hidden="true" />)}
      </div>
      <div className="masonry">
        {list.length ? list.map((x, i) => (
          <button key={x.image + i} className="g-item ph" aria-label={`Ouvrir ${x.video ? "la vidéo" : "la photo"} ${i + 1}${x.album ? ` — ${x.album}` : ""}`} data-cursor={x.video ? "Lire" : "Voir"}
            onClick={(e) => { opener.current = e.currentTarget; setK(i); }}>
            <Image src={x.image} alt={x.alt} width={700} height={Math.round((700 * x.height) / x.width)} sizes="(max-width: 700px) 48vw, (max-width: 1100px) 32vw, 24vw" />
            {x.video && <span className="g-play"><Play />{x.video.duration || "Vidéo"}</span>}
            {x.album && <span className="g-cap">{x.album}</span>}
          </button>
        )) : <p className="g-empty">Aucune réalisation pour ce filtre.</p>}
      </div>
      <div className={`lb${g ? " is-open" : ""}`} role="dialog" aria-modal="true" aria-label="Galerie plein écran" aria-hidden={!g} inert={!g}>
        <div className="lb-top"><span className="lb-count">{k !== null && `${String(k + 1).padStart(2, "0")} / ${String(list.length).padStart(2, "0")}`}</span>
          <button className="qm-close" aria-label="Fermer la galerie" onClick={close} autoFocus><Close /></button></div>
        <div className="lb-stage" onClick={(e) => { if (e.target === e.currentTarget) close(); }}
          onTouchStart={(e) => { tx.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => { if (tx.current === null || k === null) return; const dx = e.changedTouches[0].clientX - tx.current; if (Math.abs(dx) > 50) setK((k + (dx < 0 ? 1 : -1) + list.length) % list.length); tx.current = null; }}>
          {g && (g.video
            ? <video key={g.video.src} src={g.video.src} poster={g.image} controls playsInline preload="metadata" style={{ maxWidth: "100%", maxHeight: "100%" }} />
            // eslint-disable-next-line @next/next/no-img-element
            : <img key={g.image} src={g.image} alt={g.alt || `Photo de ${name}`} />)}
          <button className="lb-nav prev" aria-label="Image précédente" onClick={() => k !== null && setK((k - 1 + list.length) % list.length)}><Chevron dir="left" /></button>
          <button className="lb-nav next" aria-label="Image suivante" onClick={() => k !== null && setK((k + 1) % list.length)}><Chevron dir="right" /></button>
        </div>
        <div className="lb-bot" aria-live="polite">{g && <>{g.album && <strong>{g.album} · </strong>}{g.video ? "Vidéo" : "Photo"}</>}</div>
      </div>
    </>
  );
}

/** « À la une » du profil (stories permanentes) */
export function Highlights({ p }: { p: Pick<Profile, "highlights" | "name" | "avatar"> }) {
  const [open, setOpen] = useState<number | null>(null);
  const quote = useQuote();
  return (
    <>
      <div className="stories-row">
        {p.highlights.map((h, i) => (
          <button key={h.title + i} className="story" aria-label={`Voir « ${h.title} »`} onClick={() => setOpen(i)}>
            <span className="story-ring"><Image src={h.frames[0]} alt="" width={84} height={84} sizes="84px" /></span><span className="story-name">{h.title}</span>
          </button>
        ))}
      </div>
      <StoryViewer index={open} onClose={() => setOpen(null)} cta={{ label: "Demander un devis", onClick: () => { setOpen(null); quote(); } }}
        stories={p.highlights.map((h, i) => ({ key: String(i), title: h.title, frames: h.frames.map((image) => ({ image, caption: h.caption })), name: p.name, meta: h.title, avatar: p.avatar }))} />
    </>
  );
}

/** Calendrier des disponibilités (dates réservées ou en option, venant du prestataire) */
export function Calendar({ availability }: { availability: Profile["availability"] }) {
  const open = useQuote();
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const [y, setY] = useState(now.getFullYear());
  const [m, setM] = useState(now.getMonth());
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const first = new Date(y, m, 1), days = new Date(y, m + 1, 0).getDate(), lead = (first.getDay() + 6) % 7;
  const atStart = y === now.getFullYear() && m === now.getMonth();
  const shift = (d: number) => { const t = new Date(y, m + d, 1); setY(t.getFullYear()); setM(t.getMonth()); };
  return (
    <div className="cal">
      <div className="cal-head">
        <button className="round" aria-label="Mois précédent" disabled={atStart} style={{ opacity: atStart ? 0.35 : 1 }} onClick={() => shift(-1)}><Chevron dir="left" /></button>
        <h3 aria-live="polite">{first.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</h3>
        <button className="round" aria-label="Mois suivant" onClick={() => shift(1)}><Chevron dir="right" /></button>
      </div>
      <div className="cal-grid">
        {["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"].map((d) => <span key={d} className="cal-dow" aria-hidden="true">{d}</span>)}
        {Array.from({ length: lead }, (_, i) => <span key={`l${i}`} />)}
        {Array.from({ length: days }, (_, i) => {
          const d = new Date(y, m, i + 1), id = iso(d);
          const st = (d < now ? "past" : availability[id] ?? "free") as "past" | "booked" | "option" | "free";
          const label = `${d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} — ${{ past: "passé", booked: "réservé", option: "option posée", free: "libre" }[st]}`;
          return st === "free"
            ? <button key={id} type="button" className="day free" aria-label={`${label} : demander un devis pour cette date`} onClick={() => open(undefined)}>{i + 1}</button>
            : <span key={id} className={`day ${st}`} role="img" aria-label={label}>{i + 1}</span>;
        })}
      </div>
      <div className="legend"><span><i style={{ background: "rgba(245,240,232,.06)", border: "1px solid rgba(245,240,232,.15)" }} />Libre</span><span><i style={{ background: "rgba(196,151,90,.18)" }} />Option posée</span><span><i style={{ background: "rgba(139,64,38,.5)" }} />Réservé</span></div>
    </div>
  );
}

export function MoreReviews({ children, total }: { children: React.ReactNode; total: number }) {
  const [all, setAll] = useState(false);
  if (total <= 4) return null;
  return all ? <>{children}</> : <div className="rv-more"><button className="btn btn-ghost" onClick={() => setAll(true)}>Afficher les {total - 4} autres avis</button></div>;
}
