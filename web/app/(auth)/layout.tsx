import { Suspense } from "react";
import { Logo, ThemeToggle } from "@/components/brand";
import { AuthAsideCopy, AuthAsideText } from "@/components/auth/auth-aside";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* Panneau de marque (desktop) : un dégradé qui se fond dans la page, le logo, une phrase */}
      <aside className="hidden lg:sticky lg:top-0 lg:block lg:h-dvh">
        <div className="flex h-full flex-col justify-between bg-[linear-gradient(90deg,#8B4026_0%,#4A2418_62%,transparent_100%)] p-10 pr-28 text-[#F5F0E8]">
          <Logo variant="full" size="lg" on="dark" />
          <Suspense fallback={<AuthAsideCopy title={<>Bienvenue sur <em>NDOA</em> Wedding.</>} sub="Mariés ou prestataires, un seul compte." />}>
            <AuthAsideText />
          </Suspense>
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
