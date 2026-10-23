import type { Metadata } from "next";
import Link from "next/link";
import { getFaqs, getSiteTexts } from "@/lib/public/content";

export const metadata: Metadata = {
  title: "Contact et aide",
  description: "Une question sur NDOA Wedding, un prestataire ou une demande de devis ? Contactez-nous.",
  alternates: { canonical: "/contact" },
};

// Coordonnées officielles : réglages de l'admin, sinon variables d'environnement (aucun numéro ni e-mail inventé)
const ENV_WHATSAPP = process.env.NEXT_PUBLIC_CONTACT_WHATSAPP ?? "";
const ENV_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "";

/** FAQ par défaut, remplacée par celle publiée depuis l'admin (Pages et contenus) */
const FAQ_DEFAULT: [string, string][] = [
  ["NDOA Wedding est-il gratuit pour les mariés ?", "Oui. Rechercher des prestataires, comparer leurs tarifs et envoyer des demandes de devis est entièrement gratuit, sans engagement et sans créer de compte."],
  ["Comment fonctionne une demande de devis ?", "Depuis le profil d’un prestataire, choisissez « Demander un devis » et indiquez la date, le lieu, le nombre d’invités et votre numéro. Le prestataire reçoit votre demande et vous répond par WhatsApp, téléphone ou e-mail selon votre préférence."],
  ["À quoi sert le compte couple ?", "Il est facultatif : il garde vos favoris, les prestataires que vous suivez et l’historique de vos demandes de devis."],
  ["Comment les prestataires sont-ils vérifiés ?", "Chaque vitrine est relue par l’équipe NDOA avant sa mise en ligne. Le badge « Vérifié » est attribué après contrôle de l’identité, des coordonnées et des réalisations. Les avis ne peuvent être déposés que par des mariés ayant reçu un lien de leur prestataire."],
  ["Je suis prestataire : comment apparaître sur NDOA ?", "Créez votre vitrine en quelques minutes : vos réalisations, votre premier forfait et vos contacts suffisent. L’offre Gratuit permet de démarrer, les offres Pro et Prestige ajoutent vidéos, statistiques détaillées et mise en avant."],
  ["Comment signaler un problème avec un prestataire ou un avis ?", "Écrivez-nous en précisant le nom du prestataire. Chaque signalement est examiné par l’équipe de modération."],
];

export default async function Contact() {
  const [faqs, texts] = await Promise.all([getFaqs("couples"), getSiteTexts()]);
  const FAQ = faqs.length ? faqs : FAQ_DEFAULT;
  const WHATSAPP = (texts.contactWhatsapp ?? ENV_WHATSAPP).replace(/\D/g, "");
  const EMAIL = texts.contactEmail ?? ENV_EMAIL;
  return (
    <section className="pg">
      <div className="container">
        <div className="pg-head">
          <p className="eyebrow">Contact et aide</p>
          <h1 className="display">Parlons de <em className="gold-text">votre mariage.</em></h1>
          <p>Une question sur une demande de devis, un prestataire, votre compte ? Nous répondons sous 48 heures, du lundi au samedi.</p>
        </div>
        <div className="ct-grid">
          {WHATSAPP && <article className="ct-card"><h2>WhatsApp</h2><p>Le plus rapide pour une question simple.</p><a className="btn btn-gold" href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noopener">Écrire sur WhatsApp</a></article>}
          {EMAIL && <article className="ct-card"><h2>E-mail</h2><p>Pour un partenariat, la presse ou un signalement.</p><a className="btn btn-ghost" href={`mailto:${EMAIL}`}>{EMAIL}</a></article>}
          <article className="ct-card"><h2>Prestataires</h2><p>Créez votre vitrine gratuitement et recevez vos premières demandes.</p><Link className="btn btn-ghost" href="/pro">Devenir prestataire</Link></article>
        </div>
        <section className="faq" id="faq" aria-labelledby="faq-title">
          <h2 className="display" id="faq-title">Questions <em className="gold-text">fréquentes</em></h2>
          {FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
        </section>
      </div>
    </section>
  );
}
