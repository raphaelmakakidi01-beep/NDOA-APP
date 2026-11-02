import type { Metadata } from "next";
import Link from "next/link";
import { EditedLegal, Legal } from "@/components/mk/legal";
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
    <Legal title="Politique de" accent="confidentialité" notice={false} intro={<p>Version du 30 octobre 2026.</p>}>
      <h2>Données collectées</h2>
      <ul>
        <li><strong>Demandes de devis</strong> : nom, téléphone ou WhatsApp, e-mail (facultatif), date, ville et lieu du mariage, nombre d’invités, message. Elles sont transmises au seul prestataire concerné.</li>
        <li><strong>Compte couple (facultatif)</strong> : identifiant de connexion, favoris, prestataires suivis et historique de vos demandes.</li>
        <li><strong>Comptes prestataires</strong> : nom, coordonnées, contenus publiés, informations de facturation.</li>
        <li><strong>Statistiques de visite</strong> : un identifiant anonyme aléatoire stocké dans votre navigateur, sans donnée personnelle, pour compter les visites d’un profil sans doublon.</li>
        <li><strong>Anti-spam</strong> : le formulaire de devis utilise Cloudflare Turnstile, qui vérifie que l’envoi vient d’une personne.</li>
      </ul>
      <h2>Connexion avec Google</h2>
      <p>Si vous choisissez de vous connecter avec Google, nous recevons votre nom, votre adresse e-mail et votre photo de profil. Ces données servent uniquement à créer votre compte, à vous identifier et à sécuriser l’accès. Elles ne sont ni vendues, ni utilisées à des fins publicitaires. Vous pouvez retirer cet accès à tout moment depuis les paramètres de votre compte Google.</p>
      <h2>Assistant du site</h2>
      <p>L’assistant est une intelligence artificielle fournie par Anthropic. Les messages que vous lui écrivez sont transmis à Anthropic pour produire ses réponses ; NDOA Wedding ne les enregistre pas. N’y indiquez pas de données sensibles. Si vous choisissez de continuer avec un conseiller, un résumé de votre demande pré-remplit votre message WhatsApp : rien n’est envoyé sans votre action.</p>
      <h2>Finalités</h2>
      <p>Mettre en relation couples et prestataires, permettre aux prestataires de gérer leur activité, assurer la sécurité de la plateforme et produire des statistiques agrégées.</p>
      <h2>Partage</h2>
      <p>Aucune donnée n’est vendue. Le site est hébergé par Vercel. La base de données et l’authentification sont assurées par Supabase, sur des serveurs situés en Irlande (région eu-west-1). Aucun prestataire de paiement n’est utilisé pour l’instant.</p>
      <h2>Durée de conservation</h2>
      <ul>
        <li><strong>Demandes de devis</strong> : 1 an.</li>
        <li><strong>Comptes</strong> : jusqu’à leur suppression.</li>
        <li><strong>Factures</strong> : 2 ans.</li>
      </ul>
      <h2>Vos droits</h2>
      <p>Vous pouvez demander l’accès, la rectification ou la suppression de vos données via la <Link href="/contact">page Contact</Link>. Les prestataires peuvent exporter ou supprimer leurs données depuis leur espace (Paramètres › Données et suppression).</p>
      <h2>Responsable du traitement</h2>
      <p>NDOA Wedding. Contact : <a href="mailto:contactsocimab@gmail.com">contactsocimab@gmail.com</a>.</p>
    </Legal>
  );
}
