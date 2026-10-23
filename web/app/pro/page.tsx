import Link from "next/link";
import { ArrowRight, BarChart3, Check, Eye, Inbox, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PhoneMockup } from "@/components/public/phone-mockup";
import { SiteFooter, SiteHeader } from "@/components/public/site-chrome";
import { OFFERS, PLANS, type PlanId } from "@/lib/espace/types";
import { MIN_PHOTOS } from "@/lib/onboarding/types";
import { cn } from "@/lib/utils";

const nf = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

const BENEFITS = [
  { icon: Eye, title: "Être vu par les couples qui cherchent", text: "Votre vitrine apparaît dans votre catégorie et votre ville sur NDOA Wedding, avec vos photos, vos vidéos et vos stories. Une adresse propre à partager sur WhatsApp et Instagram." },
  { icon: Inbox, title: "Recevoir des demandes de devis complètes", text: "Date, ville, nombre d’invités, formule souhaitée : chaque demande arrive prête à chiffrer. Vous répondez, envoyez un devis et bloquez la date dans votre calendrier." },
  { icon: BarChart3, title: "Savoir ce qui vous rapporte", text: "Vues de la vitrine, clics WhatsApp et appels, demandes reçues, photos les plus regardées : vous voyez d’où viennent vos clients et ce qui les décide." },
];

const STEPS = [
  { title: "Créez votre compte", text: "Avec votre numéro de téléphone ou votre e-mail. Un code de vérification confirme que c’est bien vous." },
  { title: "Montez votre vitrine", text: `Activité, ${MIN_PHOTOS} photos minimum, un premier forfait et vos contacts. Comptez une dizaine de minutes depuis votre téléphone.` },
  { title: "Publiez et répondez", text: "L’équipe NDOA vérifie la vitrine avant sa mise en ligne. Ensuite, les demandes arrivent dans votre espace." },
];

const TIERS: { id: PlanId; features: string[] }[] = [
  { id: "free", features: [`${nf(PLANS.free.maxPhotos)} photos`, "1 forfait affiché", "Demandes de devis illimitées", "Statistiques essentielles"] },
  { id: "pro", features: [`${nf(PLANS.pro.maxPhotos)} photos et ${PLANS.pro.maxVideos} vidéos`, "Forfaits et options", "Stories et badge Vérifié", "Statistiques détaillées", `Équipe de ${OFFERS.pro.seats} personnes`] },
  { id: "prestige", features: [`${nf(PLANS.prestige.maxPhotos)} photos et ${PLANS.prestige.maxVideos} vidéos`, "Tout le Pro", "Éligible à « Nos recommandations »", `Équipe de ${OFFERS.prestige.seats} personnes`] },
];

const FAQ = [
  { q: "Est-ce vraiment gratuit ?", a: `Oui. L’offre Gratuit permet de publier une vitrine complète (jusqu’à ${PLANS.free.maxPhotos} photos) et de recevoir toutes vos demandes de devis. Les offres Pro et Prestige ajoutent de la place, des vidéos, des stories et des statistiques détaillées.` },
  { q: "Comment les couples me contactent-ils ?", a: "Depuis votre vitrine : par une demande de devis, qui arrive dans votre espace, ou directement sur WhatsApp et par téléphone si vous affichez ces contacts." },
  { q: "Pourquoi ma vitrine est-elle vérifiée avant sa publication ?", a: "Pour que les couples ne trouvent que de vrais prestataires avec de vraies réalisations. La vérification concerne la première publication ; vos modifications suivantes sont en ligne tout de suite." },
  { q: "Comment payer un abonnement ?", a: "Par Mobile Money ou par carte, en dollars ou en francs congolais. L’abonnement s’arrête quand vous le souhaitez, sans engagement au-delà de la période payée ; l’engagement annuel coûte 10 mois au lieu de 12." },
  { q: "Puis-je travailler à plusieurs sur la vitrine ?", a: `Oui, avec Pro (${OFFERS.pro.seats} personnes) ou Prestige (${OFFERS.prestige.seats} personnes). Chaque membre a son rôle : gérant, éditeur ou lecteur.` },
  { q: "Mes photos m’appartiennent-elles toujours ?", a: "Oui. Vous restez propriétaire de vos contenus et pouvez les exporter ou les supprimer à tout moment depuis vos paramètres." },
];

export const metadata = { title: { absolute: "NDOA Pro — l’espace des prestataires de mariage" }, alternates: { canonical: "/pro" } };

export default function ProHome() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="contenu" className="flex-1">
        {/* Promesse + vitrine d’exemple */}
        <section className="mx-auto grid w-full max-w-[1280px] items-center gap-14 px-5 pb-20 pt-6 sm:px-8 lg:grid-cols-[1.15fr_1fr] lg:pt-12">
          <div className="grid gap-7">
            <h1 className="font-display max-w-3xl text-[2.9rem] leading-[.98] sm:text-7xl">
              Votre talent mérite une <em className="text-gold-ink">vitrine</em> à sa hauteur.
            </h1>
            <p className="max-w-xl text-lg text-muted">Créez votre profil en 10 minutes, recevez des demandes de devis qualifiées et suivez vos résultats, depuis votre téléphone.</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg"><Link href="/inscription">Créer ma vitrine gratuitement <ArrowRight aria-hidden /></Link></Button>
              <Button asChild variant="outline" size="lg"><Link href="/connexion">J’ai déjà un compte</Link></Button>
            </div>
            <p className="text-sm text-muted">Gratuit pour commencer · sans carte bancaire · photographes, salles, traiteurs, DJ, décorateurs…</p>
          </div>
          <PhoneMockup />
        </section>

        {/* Avantages */}
        <section aria-labelledby="avantages" className="border-t border-line">
          <div className="mx-auto grid w-full max-w-[1280px] gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[.8fr_1.2fr] lg:py-28">
            <h2 id="avantages" className="font-display text-4xl leading-[1.02] sm:text-5xl lg:sticky lg:top-10 lg:self-start">Moins de temps à chercher des clients, <em className="text-gold-ink">plus de dates réservées.</em></h2>
            <ul className="grid">
              {BENEFITS.map((b) => (
                <li key={b.title} className="grid grid-cols-[auto_1fr] gap-5 border-b border-line py-8 first:pt-0 last:border-0">
                  <span className="grid size-12 place-items-center rounded-full bg-gold/15 text-gold-ink"><b.icon className="size-5" aria-hidden /></span>
                  <div>
                    <h3 className="font-display text-2xl leading-tight sm:text-3xl">{b.title}</h3>
                    <p className="mt-2 max-w-[60ch] text-muted">{b.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Comment ça marche */}
        <section aria-labelledby="etapes" className="bg-surface">
          <div className="mx-auto w-full max-w-[1280px] px-5 py-20 sm:px-8 lg:py-28">
            <h2 id="etapes" className="font-display max-w-2xl text-4xl leading-[1.02] sm:text-5xl">En ligne <em className="text-gold-ink">aujourd’hui</em>, en trois étapes.</h2>
            <ol className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
              {STEPS.map((s, i) => (
                <li key={s.title} className="relative grid content-start gap-3 border-t border-line-strong pt-6">
                  <span className="font-display text-5xl leading-none text-gold-ink" aria-hidden>{i + 1}</span>
                  <h3 className="text-lg font-bold">{s.title}</h3>
                  <p className="text-muted">{s.text}</p>
                </li>
              ))}
            </ol>
            <Button asChild size="lg" className="mt-12"><Link href="/inscription">Commencer maintenant <ArrowRight aria-hidden /></Link></Button>
          </div>
        </section>

        {/* Tarifs */}
        <section id="tarifs" aria-labelledby="tarifs-titre" className="scroll-mt-6">
          <div className="mx-auto w-full max-w-[1280px] px-5 py-20 sm:px-8 lg:py-28">
            <h2 id="tarifs-titre" className="font-display text-4xl leading-[1.02] sm:text-5xl">Commencez gratuitement, <em className="text-gold-ink">grandissez ensuite.</em></h2>
            <p className="mt-4 max-w-xl text-muted">Prix par mois. Sans engagement ; en annuel, 12 mois pour le prix de 10.</p>
            <div className="mt-12 grid gap-5 lg:grid-cols-3">
              {TIERS.map((t) => {
                const o = OFFERS[t.id], featured = t.id === "pro";
                return (
                  <article key={t.id} className={cn("relative grid content-start gap-5 rounded-3xl border p-7", featured ? "border-gold bg-surface shadow-[0_30px_70px_-40px_rgba(196,151,90,.7)]" : "border-line")}>
                    {featured && <span className="absolute -top-3 left-7 rounded-full bg-gold px-3 py-1 text-xs font-bold text-on-gold">Le plus choisi</span>}
                    <div>
                      <h3 className="font-display text-3xl">{PLANS[t.id].name}</h3>
                      <p className="mt-1 text-sm text-muted">{o.pitch}</p>
                    </div>
                    <p className="flex items-baseline gap-2">
                      <span className="font-display text-5xl leading-none">{o.price.USD ? `${o.price.USD} $` : "0 $"}</span>
                      <span className="text-sm text-muted">{o.price.USD ? `/ mois · ${nf(o.price.CDF)} FC` : "pour toujours"}</span>
                    </p>
                    <ul className="grid gap-2.5 text-[15px]">
                      {t.features.map((f) => <li key={f} className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-gold-ink" aria-hidden />{f}</li>)}
                    </ul>
                    <Button asChild variant={featured ? "gold" : "outline"} className="mt-2"><Link href="/inscription">{o.price.USD ? `Choisir ${PLANS[t.id].name}` : "Créer ma vitrine"}</Link></Button>
                  </article>
                );
              })}
            </div>
            <p className="mt-6 text-sm text-muted">Les offres payantes s’activent depuis votre espace, une fois la vitrine créée.</p>
          </div>
        </section>

        {/* Questions fréquentes */}
        <section id="faq" aria-labelledby="faq-titre" className="scroll-mt-6 border-t border-line">
          <div className="mx-auto grid w-full max-w-[1280px] gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[.8fr_1.2fr] lg:py-28">
            <h2 id="faq-titre" className="font-display text-4xl leading-[1.02] sm:text-5xl">Vos <em className="text-gold-ink">questions</em></h2>
            <div className="grid">
              {FAQ.map((f) => (
                <details key={f.q} className="group border-b border-line py-1 first:border-t">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 rounded-md py-5 text-lg font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <Plus className="size-5 shrink-0 text-gold-ink transition-transform duration-300 group-open:rotate-45" aria-hidden />
                  </summary>
                  <p className="max-w-[65ch] pb-6 text-muted">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Dernier appel */}
        <section aria-labelledby="cta" className="bg-surface">
          <div className="mx-auto grid w-full max-w-[1280px] justify-items-start gap-6 px-5 py-20 sm:px-8 lg:py-24">
            <h2 id="cta" className="font-display max-w-3xl text-4xl leading-[1.02] sm:text-6xl">Le prochain mariage que vous signez commence <em className="text-gold-ink">ici.</em></h2>
            <Button asChild size="lg"><Link href="/inscription">Créer ma vitrine gratuitement <ArrowRight aria-hidden /></Link></Button>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
