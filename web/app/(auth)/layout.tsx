import { Logo, ThemeToggle } from "@/components/brand";

const COVER = "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=72";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* Panneau photo (desktop) : une image, le logo, une phrase */}
      <aside className="hidden p-3 lg:sticky lg:top-0 lg:block lg:h-dvh" aria-hidden>
        <div className="relative h-full overflow-hidden rounded-[28px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={COVER} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0B]/90 via-[#0A0A0B]/10 to-[#0A0A0B]/35" />
          <div className="relative flex h-full flex-col justify-between p-10 text-[#F5F0E8]">
            <Logo variant="full" size="lg" on="dark" />
            <p className="max-w-xs font-display text-[2.6rem] leading-[1.02]">
              Faites <em className="text-gold">briller</em> votre talent.
            </p>
          </div>
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col">
        <header className="flex items-center justify-between px-5 py-4 sm:px-8">
          <Logo className="lg:invisible" size="sm" />
          <ThemeToggle />
        </header>
        <main id="contenu" className="flex flex-1 items-start justify-center px-5 pb-10 sm:items-center sm:px-8">
          <div className="w-full max-w-[400px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
