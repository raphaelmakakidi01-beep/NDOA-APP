"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useCouple } from "@/lib/public/couple";
import { NotifBell } from "./notif-bell";

const FACEBOOK_URL = "https://www.facebook.com/Ndoawedding";

const LINKS = [
  { href: "/prestataires", label: "Prestataires" },
  { href: "/inspiration", label: "Inspiration" },
  { href: "/#recommandations", label: "Recommandations" },
  { href: "/budget-mariage", label: "Budget" },
  { href: "/#comment-ca-marche", label: "Comment ça marche" },
];

/** Lit l'URL : isolé dans un Suspense pour que le reste de la barre reste dans la page préconstruite */
function CurrentLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  return <Link href={href} aria-current={pathname.startsWith(href) ? "page" : undefined}>{label}</Link>;
}

export function MkNav() {
  const couple = useCouple();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 40);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("keydown", esc); document.documentElement.style.overflow = ""; };
  }, [open]);
  const account = couple.userId ? { href: "/mon-compte", label: "Mon compte" } : { href: "/connexion?suite=/mon-compte&compte=couple", label: "Connexion" };

  return (
    <>
      <header className={`nav${scrolled ? " is-scrolled" : ""}`}>
        <div className="container">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <Link className="logo" href="/" aria-label="NDOA Wedding — accueil"><img src="/brand/ndoa-ivoire.webp" alt="" width="92" height="38" /></Link>
          <nav aria-label="Navigation principale">
            <ul className="nav-links">
              {LINKS.map((l) => <li key={l.href}><Suspense fallback={<Link href={l.href}>{l.label}</Link>}><CurrentLink {...l} /></Suspense></li>)}
            </ul>
          </nav>
          <div className="nav-actions">
            <a className="nav-social" href={FACEBOOK_URL} target="_blank" rel="noopener noreferrer" aria-label="Suivez NDOA Wedding sur Facebook" title="Suivez-nous sur Facebook">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true"><path d="M13.6 21.9v-8.1h2.7l.4-3.2h-3.1V8.6c0-.9.3-1.6 1.6-1.6h1.7V4.2c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.3H7.5v3.2h2.7v8.1z" /></svg>
            </a>
            {couple.userId && <NotifBell userId={couple.userId} />}
            <Link className="nav-login" href={account.href}>{account.label}</Link>
            <Link className="btn btn-gold" href="/pro">Devenir prestataire</Link>
            <button className="burger" aria-expanded={open} aria-controls="mmenu" aria-label={open ? "Fermer le menu" : "Ouvrir le menu"} onClick={() => setOpen(!open)}><span /></button>
          </div>
        </div>
      </header>
      <div className={`mmenu${open ? " is-open" : ""}`} id="mmenu" aria-hidden={!open} inert={!open}>
        <ul>
          {LINKS.map((l) => <li key={l.href}><Link href={l.href} onClick={() => setOpen(false)}>{l.label}</Link></li>)}
        </ul>
        <div className="mm-actions">
          <Link className="btn btn-gold" href="/pro" onClick={() => setOpen(false)}>Devenir prestataire</Link>
          <Link className="btn btn-ghost" href={account.href} onClick={() => setOpen(false)}>{account.label}</Link>
        </div>
      </div>
    </>
  );
}
