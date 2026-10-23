import type { Metadata } from "next";
import Link from "next/link";
import { EditedLegal, Legal, Todo } from "@/components/mk/legal";
import { getSitePage } from "@/lib/public/content";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description: "Comment NDOA Wedding collecte, utilise et protège vos données personnelles.",
  alternates: { canonical: "/confidentialite" },
};

export default async function Confidentialite() {
  const page = await getSitePage("confidentialite");
  return page ? <EditedLegal page={page} /> : <ConfidentialiteDefault />;
}

function ConfidentialiteDefault() {
  return (
    <Legal title="Politique de" accent="confidentialité" intro={<p>Version du <Todo>date</Todo>.</p>}>
      <h2>Données collectées</h2>
      <ul>
        <li><strong>Demandes de devis</strong> : nom, téléphone ou WhatsApp, e-mail (facultatif), date, ville et lieu du mariage, nombre d’invités, message. Elles sont transmises au seul prestataire concerné.</li>
        <li><strong>Compte couple (facultatif)</strong> : identifiant de connexion, favoris, prestataires suivis et historique de vos demandes.</li>
        <li><strong>Comptes prestataires</strong> : nom, coordonnées, contenus publiés, informations de facturation.</li>
        <li><strong>Statistiques de visite</strong> : un identifiant anonyme aléatoire stocké dans votre navigateur, sans donnée personnelle, pour compter les visites d’un profil sans doublon.</li>
        <li><strong>Anti-spam</strong> : le formulaire de devis utilise Cloudflare Turnstile, qui vérifie que l’envoi vient d’une personne.</li>
      </ul>
      <h2>Finalités</h2>
      <p>Mettre en relation couples et prestataires, permettre aux prestataires de gérer leur activité, assurer la sécurité de la plateforme et produire des statistiques agrégées.</p>
      <h2>Partage</h2>
      <p>Aucune donnée n’est vendue. Les données sont hébergées par <Todo>hébergeur et localisation des serveurs</Todo> et les paiements traités par <Todo>prestataire de paiement</Todo>, qui ne communique jamais les données de carte à NDOA Wedding.</p>
      <h2>Durée de conservation</h2>
      <p><Todo>durées par catégorie de données</Todo></p>
      <h2>Vos droits</h2>
      <p>Vous pouvez demander l’accès, la rectification ou la suppression de vos données via la <Link href="/contact">page Contact</Link>. Les prestataires peuvent exporter ou supprimer leurs données depuis leur espace (Paramètres › Données et suppression).</p>
      <h2>Responsable du traitement</h2>
      <p><Todo>raison sociale, adresse, contact</Todo></p>
    </Legal>
  );
}
