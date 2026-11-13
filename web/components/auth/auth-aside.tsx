"use client";

import { usePathname, useSearchParams } from "next/navigation";

/** Phrase du panneau de marque : pour les mariés (?compte=couple) ou pour les prestataires */
export function AuthAsideText() {
  const couple = useSearchParams().get("compte") === "couple";
  const login = usePathname().startsWith("/connexion");
  const [title, sub] = couple
    ? [<>Préparez votre <em>plus beau</em> jour.</>, "Favoris, prestataires suivis et demandes de devis, au même endroit."]
    : login
      ? [<>Heureux de vous <em>revoir</em>.</>, "Mariés ou prestataires, un seul compte NDOA Wedding."]
      : [<>Faites <em>briller</em> votre talent.</>, "Gratuit, sans carte bancaire."];
  return <AuthAsideCopy title={title} sub={sub} />;
}

export function AuthAsideCopy({ title, sub }: { title: React.ReactNode; sub: string }) {
  return (
    <div>
      <p className="auth-rise max-w-md font-display text-[clamp(2.6rem,4vw,3.6rem)] leading-[1.02]" style={{ "--rise": "120ms" } as React.CSSProperties}>{title}</p>
      <p className="auth-rise mt-4 max-w-sm text-[15px] text-[#F5F0E8]/85" style={{ "--rise": "220ms" } as React.CSSProperties}>{sub}</p>
    </div>
  );
}
