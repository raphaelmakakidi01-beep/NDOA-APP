import type { Metadata } from "next";
import { MkFooter } from "@/components/mk/footer";
import { MkNav } from "@/components/mk/nav";
import "./marketplace.css";
import "./marketplace-extra.css";

export const metadata: Metadata = {
  title: { absolute: "NDOA Wedding — Les meilleurs prestataires de mariage en RDC", template: "%s | NDOA Wedding" },
  description: "Photographes, vidéastes, salles, traiteurs, DJ, décorateurs… Comparez les prestataires de mariage à Kinshasa, Lubumbashi, Goma et Matadi, et demandez vos devis gratuitement.",
};

/** Partie publique (les couples) : design du site d'origine, toujours sombre */
export default function MarketplaceLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="mk">
      <MkNav />
      <main id="contenu">{children}</main>
      <MkFooter />
    </div>
  );
}
