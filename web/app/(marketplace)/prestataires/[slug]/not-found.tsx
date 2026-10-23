import Link from "next/link";

export default function ProfilIntrouvable() {
  return (
    <section className="nf">
      <div>
        <p className="eyebrow" style={{ justifyContent: "center" }}>Erreur 404</p>
        <h1 className="display">Ce profil <em className="gold-text">s’est éclipsé.</em></h1>
        <p>Le prestataire que vous cherchez n’existe pas ou n’est plus en ligne.</p>
        <Link className="btn btn-gold" href="/prestataires">Explorer les prestataires</Link>
      </div>
    </section>
  );
}
