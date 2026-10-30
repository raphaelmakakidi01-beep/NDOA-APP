import type { Metadata } from "next";
import { Suspense } from "react";
import { MkFooter } from "@/components/mk/footer";
import { RouteProgress, ScrollReveal } from "@/components/mk/motion";
import { MkNav } from "@/components/mk/nav";
import { WhatsAppFab } from "@/components/mk/whatsapp-fab";
import { getSiteTexts } from "@/lib/public/content";
import "./marketplace.css";
import "./marketplace-extra.css";

const SHARE_TITLE = "NDOA Wedding — Trouvez les prestataires de votre mariage en RDC";
const SHARE_TEXT = "Photographes, salles, traiteurs, DJ, décorateurs… Comparez les talents et demandez vos devis gratuitement, sans créer de compte.";

export const metadata: Metadata = {
  title: { absolute: "NDOA Wedding — Les meilleurs prestataires de mariage en RDC", template: "%s | NDOA Wedding" },
  description: "Photographes, vidéastes, salles, traiteurs, DJ, décorateurs… Comparez les prestataires de mariage à Kinshasa, Lubumbashi, Goma et Matadi, et demandez vos devis gratuitement.",
  openGraph: {
    type: "website", locale: "fr_FR", siteName: "NDOA Wedding", title: SHARE_TITLE, description: SHARE_TEXT,
    images: [{ url: "/brand/og-ndoa.jpg", width: 1200, height: 630, alt: "Un couple de mariés, NDOA Wedding" }],
  },
  twitter: { card: "summary_large_image", title: SHARE_TITLE, description: SHARE_TEXT, images: ["/brand/og-ndoa.jpg"] },
};

/** Partie publique (les couples) : design du site d'origine, toujours sombre */
export default async function MarketplaceLayout({ children }: LayoutProps<"/">) {
  const texts = await getSiteTexts();
  return (
    <div className="mk">
      <Suspense fallback={null}>
        <RouteProgress />
        <ScrollReveal />
        <WhatsAppFab number={texts.contactWhatsapp} />
      </Suspense>
      <MkNav />
      <main id="contenu">{children}</main>
      <MkFooter />
    </div>
  );
}
