"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { DEMO } from "@/lib/config";
import { getSupabase } from "@/lib/supabase/client";

type Notif = { id: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string };

const BellIcon = () => (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "à l’instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  return d < 7 ? `il y a ${d} j` : new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
};

/** Cloche du site public : réponses des prestataires, devis reçus, réservations confirmées (et, pour un prestataire, ses alertes) */
export function NotifBell({ userId }: { userId: string }) {
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (DEMO) return;
    const { data } = await getSupabase()!.from("notifications").select("id, title, body, link, read_at, created_at")
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
    setItems((data ?? []) as Notif[]);
  }, [userId]);

  // au chargement, quand l'onglet revient au premier plan, puis toutes les minutes tant qu'il est visible
  useEffect(() => {
    void load();
    const tick = () => { if (document.visibilityState === "visible") void load(); };
    const t = setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", tick); };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const out = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", out);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", out); document.removeEventListener("keydown", esc); };
  }, [open]);

  const unread = items.filter((n) => !n.read_at).length;

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (!next || !unread || DEMO) return;
    // ouvrir la liste = tout marquer comme lu (la pastille disparaît, les nouvelles restent signalées en or)
    const ids = items.filter((n) => !n.read_at).map((n) => n.id);
    await getSupabase()!.from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids);
    setTimeout(() => setItems((l) => l.map((n) => (ids.includes(n.id) ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n))), 4000);
  };

  return (
    <div className="nb" ref={wrap}>
      <button type="button" className="nav-social nb-btn" onClick={toggle} aria-expanded={open} aria-haspopup="true"
        aria-label={unread ? `Notifications : ${unread} non lue${unread > 1 ? "s" : ""}` : "Notifications"}>
        <BellIcon />
        {unread > 0 && <span className="nb-dot" aria-hidden="true">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="nb-panel" role="dialog" aria-label="Notifications">
          <p className="nb-head">Notifications</p>
          {items.length === 0 ? (
            <p className="nb-empty">Rien de neuf pour l’instant. Vous serez prévenu ici quand un prestataire vous répond.</p>
          ) : (
            <ul className="nb-list">
              {items.map((n) => {
                const body = (
                  <>
                    <strong>{n.title}</strong>
                    {n.body && <span className="nb-body">{n.body}</span>}
                    <small>{ago(n.created_at)}</small>
                  </>
                );
                return (
                  <li key={n.id} className={n.read_at ? "" : "is-new"}>
                    {n.link ? <Link href={n.link} onClick={() => setOpen(false)}>{body}</Link> : <div>{body}</div>}
                  </li>
                );
              })}
            </ul>
          )}
          <Link className="nb-all" href="/mon-compte?onglet=demandes" onClick={() => setOpen(false)}>Voir mes demandes →</Link>
        </div>
      )}
    </div>
  );
}
