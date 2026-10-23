import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { vendorUrl } from "@/components/mk/format";
import { getInspiration } from "@/lib/public/data";

export const metadata: Metadata = {
  title: "Inspiration mariage",
  description: "Les plus belles réalisations des prestataires NDOA Wedding : photos de mariages, décors, salles, tenues et réceptions en RDC.",
  alternates: { canonical: "/inspiration" },
};

export default async function Inspiration() {
  const items = await getInspiration();
  return (
    <section className="page">
      <div className="container">
        <p className="eyebrow">Inspiration</p>
        <h1 className="display">Les plus belles <em className="gold-text">réalisations</em></h1>
        <p style={{ color: "var(--muted)", maxWidth: "60ch" }}>Mariages, décors, salles, beauté : touchez une photo pour découvrir le prestataire qui l’a signée.</p>
        {items.length ? (
          <div className="insp">
            {items.map((x, i) => (
              <Link key={x.image + i} href={vendorUrl(x.vendor.slug)} aria-label={`${x.alt} — voir le profil de ${x.vendor.name}`}>
                <figure style={{ margin: 0 }}>
                  <Image src={x.image} alt={x.alt} width={600} height={Math.round((600 * x.height) / x.width)} sizes="(max-width: 900px) 50vw, 25vw" />
                  <figcaption><b>{x.vendor.name}</b>{[x.vendor.catName, x.vendor.city].filter(Boolean).join(" · ")}</figcaption>
                </figure>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty" style={{ marginTop: 32 }}><strong>Les premières réalisations arrivent.</strong>Elles s’affichent ici dès la publication des vitrines.</div>
        )}
      </div>
    </section>
  );
}
