import type { Metadata } from "next";
import Link from "next/link";
import { EditedLegal, Legal, Todo } from "@/components/mk/legal";
import { getSitePage } from "@/lib/public/content";

export const metadata: Metadata = {
  title: "Mentions légales",
  description: "Éditeur, hébergement et contact de la plateforme NDOA Wedding.",
  alternates: { canonical: "/mentions-legales" },
};

export default async function MentionsLegales() {
  const page = await getSitePage("mentions-legales");
  return page ? <EditedLegal page={page} /> : <MentionsLegalesDefault />;
}

function MentionsLegalesDefault() {
  return (
    <Legal title="Mentions" accent="légales">
      <h2>Éditeur</h2>
      <p><Todo>raison sociale</Todo> · <Todo>forme juridique et capital</Todo> · RCCM <Todo>numéro</Todo> · Id. Nat. <Todo>numéro</Todo> · <Todo>adresse du siège</Todo> · Directeur de la publication : <Todo>nom</Todo>.</p>
      <h2>Hébergement</h2>
      <p>Site : Vercel Inc. <Todo>adresse de l’hébergeur</Todo>. Données : Supabase <Todo>région des serveurs</Todo>.</p>
      <h2>Contact</h2>
      <p><Link href="/contact">Page Contact</Link></p>
      <h2>Crédits</h2>
      <p>Les réalisations publiées sur les profils appartiennent à leurs prestataires respectifs.</p>
    </Legal>
  );
}
