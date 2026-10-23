import type { Metadata } from "next";
import { Account } from "@/components/mk/account";
import { getDirectory } from "@/lib/public/data";

export const metadata: Metadata = { title: "Mon compte", robots: { index: false } };

export default async function MonCompte() {
  const vendors = await getDirectory();
  return (
    <section className="page">
      <div className="container">
        <p className="eyebrow">Compte couple</p>
        <h1 className="display">Mon <em className="gold-text">compte</em></h1>
        <p style={{ color: "var(--muted)", maxWidth: "60ch", marginBottom: 28 }}>Vos favoris, les prestataires que vous suivez et vos demandes de devis.</p>
        <Account vendors={vendors} />
      </div>
    </section>
  );
}
