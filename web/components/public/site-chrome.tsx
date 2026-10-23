import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Logo, ThemeToggle } from "@/components/brand";
import { Button } from "@/components/ui/button";

/** En-tête des pages publiques de l’espace pro (accueil, CGU, confidentialité) */
export function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-[1280px] items-center justify-between gap-3 px-5 py-5 sm:px-8">
      <Logo href="/pro" />
      <nav aria-label="Compte" className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm"><Link href="/connexion">Connexion</Link></Button>
        <Button asChild size="sm" className="hidden sm:inline-flex"><Link href="/inscription">Créer ma vitrine</Link></Button>
        <ThemeToggle />
      </nav>
    </header>
  );
}

const linkCls = "rounded-sm text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60";

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid w-full max-w-[1280px] gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="grid content-start gap-4">
          <Logo size="sm" href="/" />
          <p className="max-w-sm text-sm text-muted">La marketplace des prestataires de mariage en RDC. NDOA Pro est l’espace où ils gèrent leur vitrine, leurs devis et leurs résultats.</p>
          <Link href="/" className="inline-flex w-fit items-center gap-1.5 rounded-sm text-sm font-semibold text-gold-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60">
            Voir la marketplace NDOA Wedding <ArrowUpRight className="size-4" aria-hidden />
          </Link>
        </div>
        <nav aria-label="Espace prestataire" className="grid content-start gap-2.5 text-sm">
          <p className="mb-1 text-xs font-bold uppercase tracking-[.16em] text-muted">Prestataires</p>
          <Link href="/inscription" className={linkCls}>Créer ma vitrine</Link>
          <Link href="/connexion" className={linkCls}>Connexion</Link>
          <Link href="/pro#tarifs" className={linkCls}>Tarifs</Link>
          <Link href="/pro#faq" className={linkCls}>Questions fréquentes</Link>
        </nav>
        <nav aria-label="Informations légales" className="grid content-start gap-2.5 text-sm">
          <p className="mb-1 text-xs font-bold uppercase tracking-[.16em] text-muted">Informations</p>
          <Link href="/cgu" className={linkCls}>Conditions d’utilisation</Link>
          <Link href="/confidentialite" className={linkCls}>Politique de confidentialité</Link>
          <Link href="/contact" className={linkCls}>Contact</Link>
        </nav>
      </div>
      <p className="mx-auto w-full max-w-[1280px] px-5 pb-8 text-xs text-muted sm:px-8">© NDOA Wedding · Kinshasa, Lubumbashi, Goma, Matadi</p>
    </footer>
  );
}
