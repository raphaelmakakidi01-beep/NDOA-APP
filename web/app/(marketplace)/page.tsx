import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Arrow } from "@/components/mk/icons";
import { fmt, priceLabel, rate, vendorUrl } from "@/components/mk/format";
import { Hero } from "@/components/mk/hero";
import { StoriesRow, Testimonials } from "@/components/mk/home-client";
import { VendorCard } from "@/components/mk/vendor-card";
import { getHome } from "@/lib/public/data";
import { getSiteTexts } from "@/lib/public/content";

export const metadata: Metadata = { alternates: { canonical: "/" } };

const SIZES = ["big", "tall", "", "", "wide", "", "", "tall", "wide", "wide", ""];
const nameEm = (name: string) => {
  const w = name.split(" ");
  return w.length > 1 ? <>{w.slice(0, -1).join(" ")} <em>{w[w.length - 1]}</em></> : <em>{name}</em>;
};

export default async function Accueil() {
  const [h, texts] = await Promise.all([getHome(), getSiteTexts()]);
  const feat = h.feature;
  return (
    <>
      <Hero slides={h.slides} categories={h.categories} cities={h.cities} texts={{ title: texts.heroTitle, subtitle: texts.heroSubtitle }} />

      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {[0, 1].map((g) => (
            <div className="marquee-group" key={g}>
              {h.categories.map((c, i) => <span key={c.slug} className="contents"><span className={`marquee-item${i % 2 ? " outline" : ""}`}>{c.plural}</span><span className="marquee-star">✦</span></span>)}
            </div>
          ))}
        </div>
      </div>

      {h.stories.length > 0 && (
        <section className="stories" id="stories" aria-labelledby="stories-title">
          <div className="container">
            <div className="stories-head"><h2 id="stories-title">En coulisses, <em>ce soir</em></h2><p>Touchez une story pour l’ouvrir</p></div>
            <StoriesRow stories={h.stories} />
          </div>
        </section>
      )}

      <section className="section" id="categories" aria-labelledby="cat-title">
        <div className="container">
          <div className="section-head">
            <div>
              <p className="eyebrow">Les catégories</p>
              <h2 className="display h2" id="cat-title">Toute la <em className="gold-text">distribution</em><br />du grand soir.</h2>
            </div>
            <p className="lead">Photographes, salles, traiteurs, DJ… Choisissez un métier pour voir tous les talents disponibles.</p>
          </div>
          <div className="bento">
            {h.categories.map((c, i) => (
              <Link key={c.slug} className={`cat ph ${SIZES[i % SIZES.length]}`} href={`/prestataires?categorie=${encodeURIComponent(c.slug)}`} data-cursor="Explorer">
                <Image src={c.image} alt="" fill sizes={SIZES[i % SIZES.length] === "big" ? "(max-width: 700px) 100vw, 50vw" : "(max-width: 700px) 50vw, 25vw"} />
                <span className="cat-num">{String(i + 1).padStart(2, "0")}</span>
                <span className="cat-go glass"><Arrow /></span>
                <h3 className="cat-name">{c.plural}</h3>
                <span className="cat-count">{c.count ? `${fmt(c.count)} prestataire${c.count > 1 ? "s" : ""}` : "Bientôt disponibles"}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {feat && (
        <section className="section light" id="recommandations" aria-labelledby="reco-title">
          <div className="container">
            <div className="section-head">
              <div>
                <p className="eyebrow">La sélection NDOA</p>
                <h2 className="display h2" id="reco-title">Nos <em style={{ color: "var(--wine)" }}>recommandations</em></h2>
              </div>
              <p className="lead">Chaque mois, notre équipe met en lumière les prestataires qui redéfinissent le mariage congolais.</p>
            </div>
            <div className="reco-grid">
              <article className="feature">
                <Link href={vendorUrl(feat.slug)} className="feature-media ph" data-cursor="Lire">
                  <Image src={feat.cover} alt={`Réalisation de ${feat.name}`} fill sizes="(max-width: 1024px) 100vw, 55vw" />
                  <span className="feature-issue">À la une</span><span className="sr-only"> : voir le profil de {feat.name}</span>
                  <span className="reco-stamp">Recommandé par NDOA</span>
                </Link>
                <div className="feature-card">
                  <span className="kicker">Portrait · {feat.catName}</span>
                  <h3>{nameEm(feat.name)}</h3>
                  {feat.tagline && <blockquote>« {feat.tagline} »</blockquote>}
                  <div className="feature-meta">
                    <span>{feat.reviews ? <><b>{rate(feat)}</b> ★ · {fmt(feat.reviews)} avis</> : <><b>Nouveau</b> sur NDOA</>}</span>
                    <span>{feat.city}</span>
                    {feat.price != null && <span>À partir de <b>{priceLabel(feat)}</b></span>}
                  </div>
                  <Link className="btn btn-dark" href={vendorUrl(feat.slug)}>Voir le profil <span className="arrow">→</span></Link>
                </div>
              </article>
              {h.picks.length > 0 && (
                <div>
                  <div className="picks-title"><h3>Coups de cœur</h3><span>{String(h.picks.length).padStart(2, "0")} talent{h.picks.length > 1 ? "s" : ""}</span></div>
                  <div className="picks">
                    {h.picks.map((v, i) => (
                      <Link key={v.slug} className="pick" href={vendorUrl(v.slug)} data-cursor="Voir">
                        <span className="pick-media ph"><Image src={v.gallery[0]} alt="" fill sizes="(max-width: 700px) 45vw, 20vw" /></span>
                        <span className="pick-num">N°0{i + 2}<span className="reco-mark">Recommandé</span></span>
                        <h4>{v.name}</h4>
                        <p>{v.catName} · {v.city} · {v.reviews ? `★ ${rate(v)}` : "Nouveau"}</p>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="section" id="feed" aria-labelledby="feed-title">
        <div className="container">
          <div className="section-head">
            <div>
              <p className="eyebrow">Le feed</p>
              <h2 className="display h2" id="feed-title">Ils font <em className="gold-text">vibrer</em><br />la ville.</h2>
            </div>
            <p className="lead">Suivez vos coups de cœur, ajoutez-les à vos favoris, comparez les tarifs. Survolez une carte pour feuilleter sa galerie.</p>
          </div>
          {h.vendors.length ? (
            <div className="feed">{h.vendors.slice(0, 8).map((v) => <VendorCard key={v.slug} v={v} />)}</div>
          ) : (
            <div className="empty"><strong>Les premiers talents arrivent.</strong>Les vitrines sont publiées dès leur validation par l’équipe NDOA. <Link href="/pro">Vous êtes prestataire ? Rejoignez NDOA →</Link></div>
          )}
          <div className="feed-more"><Link className="btn btn-ghost" href="/prestataires">Explorer tous les prestataires <span className="arrow">→</span></Link></div>
        </div>
      </section>

      <section className="section light" id="comment-ca-marche" aria-labelledby="how-title">
        <div className="container">
          <div className="section-head">
            <div>
              <p className="eyebrow">Comment ça marche</p>
              <h2 className="display h2" id="how-title">Trois gestes,<br /><em style={{ color: "var(--wine)" }}>zéro stress.</em></h2>
            </div>
            <p className="lead">De la première inspiration à la dernière danse, NDOA simplifie tout ce qui ne devrait pas vous voler la vedette.</p>
          </div>
          <div className="steps">
            <div className="steps-line" aria-hidden="true"><i /></div>
            {[
              ["Explorez & ", "inspirez-vous", "Parcourez les prestataires, les stories et nos sélections. Filtrez par ville, budget et note pour trouver votre style.", <><circle key="a" cx="11" cy="11" r="7" /><path key="b" d="m20 20-3.5-3.5M8 11h6M11 8v6" /></>],
              ["Demandez ", "vos devis", "Un formulaire, sans créer de compte : date, lieu, nombre d’invités. Le prestataire vous répond directement.", <><path key="a" d="M4 5h16v11H8l-4 4z" /><path key="b" d="M8 10h8M8 13h5" /></>],
              ["Réservez & ", "brillez", "Comparez les réponses, bloquez la date. Le jour J, il ne vous reste qu’à profiter.", <path key="a" d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z" />],
            ].map(([a, b, p, icon], i) => (
              <article className="step" key={i}>
                <span className="step-num" aria-hidden="true">0{i + 1}</span>
                <div className="step-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">{icon}</svg></div>
                <h3>{a}<em>{b}</em></h3>
                <p>{p}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {h.testimonials.length > 0 && (
        <section className="section" id="temoignages" aria-labelledby="tm-title">
          <div className="container">
            <div className="section-head">
              <div>
                <p className="eyebrow">Ils ont dit oui</p>
                <h2 className="display h2" id="tm-title">Des souvenirs <em className="gold-text">en or.</em></h2>
              </div>
            </div>
            <Testimonials items={h.testimonials} />
          </div>
        </section>
      )}

      <section className="section cta" id="devenir-prestataire" aria-labelledby="cta-title">
        <div className="container">
          <p className="eyebrow">Pour les prestataires</p>
          <h2 className="display" id="cta-title">Faites <em className="gold-text">briller</em> votre talent.</h2>
          <p className="lead">Un profil qui ressemble à un portfolio, des stories pour montrer les coulisses, des demandes de devis qualifiées directement dans votre espace.</p>
          {h.vendors.length > 0 && (
            <div className="counters">
              <div className="counter"><b>{fmt(h.vendors.length)}</b><span>Prestataires</span></div>
              <div className="counter"><b>{fmt(h.categories.length)}</b><span>Métiers</span></div>
              <div className="counter"><b>{fmt(new Set(h.vendors.map((v) => v.city)).size)}</b><span>Villes</span></div>
            </div>
          )}
          <div className="cta-actions">
            <Link className="btn btn-gold" href="/inscription">Créer mon profil gratuitement <span className="arrow">→</span></Link>
            <Link className="btn btn-ghost" href="/pro#tarifs">Voir les offres</Link>
          </div>
        </div>
      </section>
    </>
  );
}
