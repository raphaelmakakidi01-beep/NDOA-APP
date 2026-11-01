import { Logo, ThemeToggle } from "@/components/brand";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* Panneau de marque (desktop) : un dégradé, le logo, une phrase */}
      <aside className="hidden p-3 lg:sticky lg:top-0 lg:block lg:h-dvh">
        <div className="flex h-full flex-col justify-between overflow-hidden rounded-[28px] bg-[linear-gradient(160deg,#141215_0%,#2A1812_48%,#8B4026_80%,#C4975A_100%)] p-10 text-[#F5F0E8]">
          <Logo variant="full" size="lg" on="dark" />
          <div>
            <p className="auth-rise max-w-md font-display text-[clamp(2.6rem,4vw,3.6rem)] leading-[1.02]" style={{ "--rise": "120ms" } as React.CSSProperties}>
              Faites <em>briller</em> votre talent.
            </p>
            <p className="auth-rise mt-4 text-[15px] text-[#F5F0E8]/85" style={{ "--rise": "220ms" } as React.CSSProperties}>Gratuit, sans carte bancaire.</p>
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
