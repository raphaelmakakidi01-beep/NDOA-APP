import Link from "next/link";
import { CATEGORIES } from "@/lib/onboarding/catalog";

const CITIES = ["Kinshasa", "Lubumbashi", "Goma", "Matadi"];

export function MkFooter() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="foot-top">
          <div className="news">
            <h3>NDOA <em>Wedding</em></h3>
            <p>Les prestataires de mariage de la RDC réunis au même endroit : photographes, salles, traiteurs, DJ, décorateurs… Comparez, demandez vos devis gratuitement, réservez.</p>
          </div>
          <div className="foot-cols">
            <div><h4>Explorer</h4><ul>
              <li><Link href="/prestataires">Tous les prestataires</Link></li>
              <li><Link href="/#recommandations">Recommandations</Link></li>
              <li><Link href="/inspiration">Inspiration</Link></li>
              <li><Link href="/mon-compte">Mon compte</Link></li>
            </ul></div>
            <div><h4>Catégories</h4><ul>
              {CATEGORIES.filter((c) => ["photographe", "salle", "traiteur", "dj", "planner"].includes(c.slug)).map((c) => (
                <li key={c.slug}><Link href={`/prestataires?categorie=${c.slug}`}>{c.name}</Link></li>
              ))}
            </ul></div>
            <div><h4>Villes</h4><ul>
              {CITIES.map((c) => <li key={c}><Link href={`/prestataires?ville=${encodeURIComponent(c)}`}>{c}</Link></li>)}
            </ul></div>
            <div><h4>NDOA Wedding</h4><ul>
              <li><Link href="/pro">Devenir prestataire</Link></li>
              <li><Link href="/connexion">Espace prestataire</Link></li>
              <li><Link href="/contact">Contact</Link></li>
            </ul></div>
          </div>
        </div>
        <div className="foot-bar">
          <span>© NDOA Wedding. Fait avec passion à Kinshasa.</span>
          <nav aria-label="Liens légaux"><Link href="/mentions-legales">Mentions légales</Link><Link href="/confidentialite">Confidentialité</Link><Link href="/cgu">CGU</Link></nav>
        </div>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <div className="giant" aria-hidden="true"><img src="/brand/ndoa-wedding-ivoire.webp" alt="" width="720" height="339" loading="lazy" /></div>
    </footer>
  );
}
