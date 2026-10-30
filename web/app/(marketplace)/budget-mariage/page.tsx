import type { Metadata } from "next";
import { BudgetCalculator } from "@/components/mk/budget";
import { getSiteTexts } from "@/lib/public/content";

const ENV_WHATSAPP = process.env.NEXT_PUBLIC_CONTACT_WHATSAPP ?? "";

export const metadata: Metadata = {
  title: "Calculateur de budget mariage en USD",
  description: "Répartissez votre budget de mariage en dollars, poste par poste : salle, traiteur, décoration, photo, tenues et animation. Gratuit et sans inscription.",
  alternates: { canonical: "/budget-mariage" },
};

export default async function BudgetMariage() {
  const texts = await getSiteTexts();
  return (
    <section className="page">
      <div className="container">
        <p className="eyebrow">Outil gratuit</p>
        <h1 className="display">Le budget de votre <em className="gold-text">mariage</em></h1>
        <p style={{ color: "var(--muted)", maxWidth: "60ch" }}>Indiquez votre budget et le nombre d’invités : la répartition se calcule en direct, sans inscription.</p>
        <BudgetCalculator whatsapp={texts.contactWhatsapp ?? ENV_WHATSAPP} />
      </div>
    </section>
  );
}
