import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/public/site-chrome";
import { ServicesWaButton, VendorServicesGrid, VendorServicesSteps } from "@/components/public/vendor-services";
import { getSiteTexts } from "@/lib/public/content";

export const metadata: Metadata = {
  title: { absolute: "Services aux prestataires — NDOA Wedding" },
  description: "Création de contenu, gestion de vos réseaux sociaux et vidéos de présentation : l’équipe NDOA met en valeur votre activité de mariage. Contact sur WhatsApp.",
  alternates: { canonical: "/pro/services" },
};

const ENV_WHATSAPP = process.env.NEXT_PUBLIC_CONTACT_WHATSAPP ?? "";

export default async function ServicesPrestataires() {
  const texts = await getSiteTexts();
  const whatsapp = (texts.contactWhatsapp ?? ENV_WHATSAPP).replace(/\D/g, "");
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="contenu" className="flex-1">
        <section className="mx-auto grid w-full max-w-[1280px] gap-7 px-5 pb-16 pt-6 sm:px-8 lg:pt-12">
          <p className="text-sm font-bold uppercase tracking-[.16em] text-gold-ink">Services aux prestataires</p>
          <h1 className="font-display max-w-4xl text-[2.6rem] leading-[1] sm:text-7xl">
            Vous faites de beaux mariages. <em className="text-gold-ink">On le fait savoir.</em>
          </h1>
          <p className="max-w-2xl text-lg text-muted">L’équipe NDOA crée votre contenu, anime vos réseaux sociaux et réalise vos vidéos de présentation, pour que les couples vous remarquent et vous contactent.</p>
          <div className="flex flex-wrap gap-3">
            <ServicesWaButton whatsapp={whatsapp} label="Nous écrire sur WhatsApp" />
            <Link href="#services" className="inline-flex h-12 items-center rounded-full border border-line-strong px-6 text-[15px] font-semibold hover:border-gold hover:text-gold-ink">Voir les services</Link>
          </div>
          {!whatsapp && <p className="text-sm text-muted">Pour en savoir plus, passez par la page <Link href="/contact" className="text-gold-ink underline">Contact</Link>.</p>}
        </section>

        <section id="services" aria-labelledby="services-titre" className="scroll-mt-6 border-t border-line">
          <div className="mx-auto w-full max-w-[1280px] px-5 py-16 sm:px-8 lg:py-24">
            <h2 id="services-titre" className="font-display max-w-2xl text-4xl leading-[1.02] sm:text-5xl">Trois services, <em className="text-gold-ink">sur devis.</em></h2>
            <p className="mt-4 max-w-xl text-muted">Choisissez un service ou combinez-les. Chaque proposition est adaptée à votre métier et à votre budget.</p>
            <div className="mt-12"><VendorServicesGrid whatsapp={whatsapp} /></div>
          </div>
        </section>

        <section aria-labelledby="deroule" className="bg-surface">
          <div className="mx-auto w-full max-w-[1280px] px-5 py-16 sm:px-8 lg:py-24">
            <h2 id="deroule" className="font-display max-w-2xl text-4xl leading-[1.02] sm:text-5xl">Comment ça se <em className="text-gold-ink">passe</em></h2>
            <div className="mt-12"><VendorServicesSteps /></div>
            <ServicesWaButton whatsapp={whatsapp} label="Demander un devis sur WhatsApp" className="mt-12" />
          </div>
        </section>

        <section aria-labelledby="vitrine" className="border-t border-line">
          <div className="mx-auto grid w-full max-w-[1280px] justify-items-start gap-5 px-5 py-16 sm:px-8 lg:py-20">
            <h2 id="vitrine" className="font-display max-w-3xl text-3xl leading-[1.05] sm:text-5xl">Pas encore sur NDOA ? <em className="text-gold-ink">Votre vitrine est gratuite.</em></h2>
            <Link href="/inscription" className="inline-flex h-12 items-center rounded-full bg-gold px-6 text-[15px] font-semibold text-on-gold hover:brightness-105">Créer ma vitrine</Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
