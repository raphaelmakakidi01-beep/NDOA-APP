import { Check } from "lucide-react";
import { Logo, ThemeToggle } from "@/components/brand";

const COVER = "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=72";

const PROMISES = [
  "Une vitrine qui ressemble à un portfolio",
  "Vos demandes de devis réunies au même endroit",
  "Gratuit, sans carte bancaire",
];

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* Panneau photo (desktop) : une image, le logo, un accueil et ce que le prestataire y gagne */}
      <aside className="hidden p-3 lg:sticky lg:top-0 lg:block lg:h-dvh">
        <div className="relative h-full overflow-hidden rounded-[28px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={COVER} alt="" decoding="async" className="auth-zoom absolute inset-0 size-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0B]/95 via-[#0A0A0B]/25 to-[#0A0A0B]/40" />
          <div className="relative flex h-full flex-col justify-between p-10 text-[#F5F0E8]">
            <Logo variant="full" size="lg" on="dark" />
            <div>
              <p className="auth-rise text-sm font-semibold text-gold" style={{ "--rise": "100ms" } as React.CSSProperties}>Bienvenue sur NDOA Wedding</p>
              <p className="auth-rise mt-3 max-w-md font-display text-[clamp(2.6rem,4vw,3.6rem)] leading-[1.02]" style={{ "--rise": "180ms" } as React.CSSProperties}>
                Faites <em className="text-gold">briller</em> votre talent.
              </p>
              <ul className="mt-7 grid gap-3 text-[15px]">
                {PROMISES.map((p, i) => (
                  <li key={p} className="auth-rise flex items-center gap-3" style={{ "--rise": `${300 + i * 90}ms` } as React.CSSProperties}>
                    <span className="grid size-6 shrink-0 place-items-center rounded-full border border-gold/60 bg-[#0A0A0B]/35 text-gold"><Check className="size-3.5" aria-hidden /></span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col">
        <header className="flex items-center justify-between px-5 py-4 sm:px-8">
          <Logo className="lg:invisible" size="sm" />
          <ThemeToggle />
        </header>
        <main id="contenu" className="flex flex-1 items-start justify-center px-5 pb-10 sm:items-center sm:px-8">
          <div className="auth-rise w-full max-w-[400px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
