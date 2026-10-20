import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Logo, ThemeToggle } from "@/components/brand";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-[1280px] items-center justify-between px-5 py-5 sm:px-8">
        <Logo />
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm"><Link href="/connexion">Connexion</Link></Button>
          <ThemeToggle />
        </div>
      </header>
      <main id="contenu" className="mx-auto grid w-full max-w-[1280px] flex-1 content-center gap-8 px-5 pb-20 sm:px-8">
        <p className="flex items-center gap-3 text-xs font-bold uppercase tracking-[.22em] text-gold-ink"><span className="h-px w-7 bg-current" />NDOA Pro · espace prestataire</p>
        <h1 className="font-display max-w-4xl text-5xl leading-[.98] sm:text-7xl">
          Votre talent mérite une <em className="text-gold-ink">vitrine</em> à sa hauteur.
        </h1>
        <p className="max-w-xl text-lg text-muted">Créez votre profil en 10 minutes, recevez des demandes de devis qualifiées et suivez vos résultats, depuis votre téléphone.</p>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg"><Link href="/inscription">Créer ma vitrine gratuitement <ArrowRight aria-hidden /></Link></Button>
          <Button asChild variant="outline" size="lg"><Link href="/connexion">J’ai déjà un compte</Link></Button>
        </div>
      </main>
    </div>
  );
}
