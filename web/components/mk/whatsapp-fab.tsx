"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { WhatsApp } from "./icons";

const ENV_WHATSAPP = process.env.NEXT_PUBLIC_CONTACT_WHATSAPP ?? "";

/** Bouton flottant vers le conseiller NDOA. Masqué sans numéro, et sur les vitrines qui ont leur propre contact. */
export function WhatsAppFab({ number }: { number?: string }) {
  const pathname = usePathname();
  const msg = useRef<HTMLSpanElement>(null);
  // Le message ne s'affiche qu'une fois par visite : il masquerait sinon le contenu à chaque page
  useEffect(() => {
    if (!msg.current) return;
    try {
      if (sessionStorage.getItem("ndoa-fab-vu")) return;
      sessionStorage.setItem("ndoa-fab-vu", "1");
    } catch { return; }
    msg.current.classList.add("hello");
  }, [pathname]);
  const digits = (number ?? ENV_WHATSAPP).replace(/\D/g, "");
  if (!digits || pathname.startsWith("/prestataires/")) return null;
  const text = encodeURIComponent("Bonjour NDOA, je prépare mon mariage et j’aimerais être conseillé(e).");
  return (
    <a className="wa-fab" href={`https://wa.me/${digits}?text=${text}`} target="_blank" rel="noopener noreferrer" aria-label="Discuter sur WhatsApp : un conseiller vous répond en moins d’1 h">
      <WhatsApp />
      <span ref={msg} className="wa-fab-msg" aria-hidden="true"><b>Besoin d’un conseil ?</b>Un conseiller vous répond en moins d’1 h</span>
    </a>
  );
}
