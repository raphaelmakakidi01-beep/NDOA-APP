import type { Metadata } from "next";
import Link from "next/link";
import { EditedLegal, Legal, Todo } from "@/components/mk/legal";
import { getSitePage } from "@/lib/public/content";

export const metadata: Metadata = {
  title: "Conditions d’utilisation",
  description: "Conditions générales d’utilisation de la plateforme NDOA Wedding.",
  alternates: { canonical: "/cgu" },
};

export default async function Cgu() {
  const page = await getSitePage("cgu");
  return page ? <EditedLegal page={page} /> : <CguDefault />;
}

function CguDefault() {
  return (
    <Legal title="Conditions" accent="d’utilisation" intro={<p>Version du <Todo>date</Todo>.</p>}>
      <h2>1. Objet</h2>
      <p>NDOA Wedding est une plateforme de mise en relation entre des couples qui préparent leur mariage et des prestataires de services (photographes, salles, traiteurs, etc.) en République démocratique du Congo. Elle est éditée par <Todo>raison sociale</Todo>, <Todo>forme juridique</Todo>, RCCM <Todo>numéro</Todo>, Id. Nat. <Todo>numéro</Todo>, dont le siège est situé <Todo>adresse</Todo>.</p>
      <h2>2. Accès au service</h2>
      <p>La consultation des prestataires et l’envoi de demandes de devis sont gratuits pour les couples, sans compte. Le compte couple (favoris, prestataires suivis, historique des demandes) est facultatif. L’espace prestataire nécessite la création d’un compte.</p>
      <h2>3. Rôle de NDOA Wedding</h2>
      <p>NDOA Wedding n’est pas partie aux contrats conclus entre couples et prestataires. Les prix, prestations et conditions sont fixés librement par chaque prestataire, qui en reste seul responsable.</p>
      <h2>4. Comptes prestataires et contenus</h2>
      <ul>
        <li>Le prestataire garantit l’exactitude de ses informations et détient les droits sur les photos et vidéos qu’il publie.</li>
        <li>Chaque vitrine est vérifiée par l’équipe NDOA avant sa première publication.</li>
        <li>Tout contenu illicite, trompeur ou portant atteinte à des tiers peut être retiré sans préavis.</li>
      </ul>
      <h2>5. Avis</h2>
      <p>Les avis sont déposés par les couples via un lien unique transmis par le prestataire. Un avis publié ne peut pas être modifié par le prestataire, qui peut y répondre publiquement.</p>
      <h2>6. Abonnements prestataires</h2>
      <p>Les offres Pro et Prestige sont payantes, sans engagement au-delà de la période payée. Le renouvellement peut être arrêté à tout moment depuis l’espace prestataire. <Todo>conditions de remboursement</Todo></p>
      <h2>7. Responsabilité</h2>
      <p><Todo>clauses de responsabilité à rédiger par le conseil juridique</Todo></p>
      <h2>8. Droit applicable</h2>
      <p>Les présentes conditions sont régies par le droit congolais. <Todo>juridiction compétente</Todo></p>
      <h2>9. Contact</h2>
      <p>Pour toute question : <Link href="/contact">page Contact</Link>.</p>
    </Legal>
  );
}
