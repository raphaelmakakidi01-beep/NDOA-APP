import type { Metadata } from "next";
import { ServicesWaButton, VendorServicesGrid, VendorServicesSteps } from "@/components/public/vendor-services";
import { getSiteTexts } from "@/lib/public/content";

export const metadata: Metadata = { title: "Services NDOA" };

const ENV_WHATSAPP = process.env.NEXT_PUBLIC_CONTACT_WHATSAPP ?? "";

export default async function Page() {
  const texts = await getSiteTexts();
  const whatsapp = (texts.contactWhatsapp ?? ENV_WHATSAPP).replace(/\D/g, "");
  return (
    <div className="grid gap-8">
      <header className="grid gap-3">
        <h1 className="font-display text-4xl leading-tight sm:text-5xl">Services aux prestataires</h1>
        <p className="max-w-2xl text-muted">Besoin d’aide pour votre image ? L’équipe NDOA crée votre contenu, gère vos réseaux sociaux et réalise vos vidéos de présentation. Sur devis, en toute simplicité sur WhatsApp.</p>
        <ServicesWaButton whatsapp={whatsapp} label="Nous écrire sur WhatsApp" className="w-fit" />
      </header>
      <VendorServicesGrid whatsapp={whatsapp} compact />
      <section aria-labelledby="deroule" className="grid gap-6 rounded-3xl border border-line p-6 sm:p-8">
        <h2 id="deroule" className="font-display text-3xl">Comment ça se passe</h2>
        <VendorServicesSteps />
      </section>
    </div>
  );
}
