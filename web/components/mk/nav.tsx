"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCouple } from "@/lib/public/couple";

const LINKS = [
  { href: "/prestataires", label: "Prestataires" },
  { href: "/inspiration", label: "Inspiration" },
  { href: "/#recommandations", label: "Recommandations" },
  { href: "/#comment-ca-marche", label: "Comment ça marche" },
];

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
              {LINKS.map((l) => <li key={l.href}><Link href={l.href}>{l.label}</Link></li>)}
            </ul>
          </nav>
          <div className="nav-actions">
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
