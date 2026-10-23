import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { compact, fmt, priceLabel, vendorUrl } from "@/components/mk/format";
import { Clock, No, Pin, Route, Star, Stars, Tag, Verified, Yes } from "@/components/mk/icons";
import { Calendar, Gallery, Highlights, MobileBar, MoreReviews, ProfileActions, Tabs, ViewTracker } from "@/components/mk/profile-client";
import { QuoteButton, QuoteProvider } from "@/components/mk/quote";
import { getDirectory, getProfile } from "@/lib/public/data";
import type { Profile, Review } from "@/lib/public/types";
import { SITE_URL } from "@/lib/config";

const cheapest = (p: Profile) => [...p.packages].sort((a, b) => (a.currency === "USD" ? 0 : 1) - (b.currency === "USD" ? 0 : 1) || a.price - b.price)[0];

export async function generateMetadata({ params }: PageProps<"/prestataires/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProfile(slug);
  if (!p) return { title: "Prestataire introuvable", robots: { index: false } };
  const c = cheapest(p);
  const description = `${p.name}, ${p.catName.toLowerCase()} à ${p.city}.${p.reviews ? ` Note ${p.rating.toFixed(1).replace(".", ",")}/5 sur ${p.reviews} avis.` : ""} ${c ? `À partir de ${fmt(c.price)} ${c.currency}.` : "Tarifs sur devis."} Réalisations, tarifs, disponibilités et devis gratuit.`;
  return {
    title: `${p.name} — ${p.catName} à ${p.city}`, description,
    alternates: { canonical: vendorUrl(p.slug) },
    openGraph: { type: "profile", title: `${p.name} — ${p.catName} à ${p.city}`, description, images: [{ url: p.coverImage, alt: `Réalisation de ${p.name}` }] },
    twitter: { card: "summary_large_image", images: [p.coverImage] },
  };
}

function ReviewCard({ r, name }: { r: Review; name: string }) {
  return (
    <article className="review">
      <div className="rv-top">
        {r.image ? <Image src={r.image} alt="" width={60} height={60} /> : <span className="rv-ini" aria-hidden="true">{r.names.slice(0, 1)}</span>}
        <div><strong>{r.names}</strong><small>Mariage le {r.date}{r.city ? ` · ${r.city}` : ""}</small></div>
        <Stars rating={r.rating} />
      </div>
      <p>{r.text}</p>
      {r.reply && <div className="reply"><b>Réponse de {name}</b>{r.reply}</div>}
    </article>
  );
}

async function ProfileView({ params }: { params: PageProps<"/prestataires/[slug]">["params"] }) {
  const { slug } = await params;
  const p = await getProfile(slug);
  if (!p) notFound();
  const all = await getDirectory();
  const others = all.filter((v) => v.slug !== p.slug);
  let similar = others.filter((v) => v.cat === p.cat);
  if (similar.length < 4) similar = [...similar, ...others.filter((v) => !similar.includes(v) && v.city === p.city)];
  similar = similar.slice(0, 8);
  const c = cheapest(p);
  const minPrice = c ? `${fmt(c.price)} ${c.currency}` : "sur devis";
  const words = p.name.split(" ");
  const stats: [number, string][] = [[p.followers, "Abonnés"], [p.reviews, "Avis"], [p.gallery2.filter((g) => !g.video).length, "Réalisations"]];
  const jsonld = {
    "@context": "https://schema.org", "@type": "LocalBusiness", name: p.name, url: `${SITE_URL}${vendorUrl(p.slug)}`, image: p.coverImage,
    description: p.tagline || p.bio[0], address: { "@type": "PostalAddress", addressLocality: p.city, addressCountry: "CD" }, areaServed: p.city,
    ...(c && { priceRange: `À partir de ${fmt(c.price)} ${c.currency}` }),
    ...(p.reviews && { aggregateRating: { "@type": "AggregateRating", ratingValue: p.rating, reviewCount: p.reviews, bestRating: 5 } }),
  };

  return (
    <QuoteProvider vendor={{ slug: p.slug, name: p.name, avatar: p.avatar, city: p.city, packages: p.packages, options: p.options, response: p.response }}>
      <ViewTracker slug={p.slug} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonld).replace(/</g, "\\u003c") }} />
      <section className="cover" aria-label="Couverture">
        <div className="cover-media ph"><Image src={p.coverImage} alt={`Réalisation de ${p.name}`} fill sizes="100vw" priority /></div>
        <nav className="crumbs" aria-label="Fil d’Ariane"><div className="container"><ol>
          <li><Link href="/">Accueil</Link></li>
          <li><Link href={`/prestataires?categorie=${p.cat}`}>{p.catName}</Link></li>
          <li><span aria-current="page">{p.name}</span></li>
        </ol></div></nav>
      </section>

      <section className="pp-head" aria-labelledby="ppName">
        <div className="container">
          <div className="pp-id">
            <div className="pp-avatar"><Image src={p.avatar} alt={`Photo de profil de ${p.name}`} width={184} height={184} /></div>
            <div className="pp-info">
              {p.recommended && <p className="pp-reco">Recommandé par NDOA</p>}
              <h1 className="display pp-name" id="ppName">
                {words.map((w, i) => <span key={i} className="line"><span className="w">{w}</span>{i < words.length - 1 ? " " : ""}</span>)}
                {p.verified && <Verified />}
              </h1>
              <ul className="pp-meta">
                <li><Tag />{p.catName}</li>
                <li><Pin />{p.city}</li>
                <li><Route />{p.zone}</li>
                <li><svg viewBox="0 0 24 24" fill="#C4975A" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z" /></svg>
                  {p.reviews ? <a href="#tab-avis"><b>{p.rating.toFixed(1).replace(".", ",")}</b> · {fmt(p.reviews)} avis</a> : <b>Nouveau sur NDOA</b>}</li>
              </ul>
            </div>
            <div className="pp-more">
              <div className="pp-row">
                <div className="pp-stats">{stats.map(([n, l]) => <div key={l} className="pp-stat"><b>{compact(n)}</b><span>{l}</span></div>)}</div>
                <ProfileActions p={p} />
              </div>
              {p.highlights.length > 0 && (
                <div className="highlights"><p className="hl-title">À la une</p><Highlights p={p} /></div>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="container pp-layout">
        <div className="pp-main">
          <Tabs tabs={[
            { id: "real", label: "Réalisations", count: String(p.gallery2.length), panel: p.gallery2.length ? <Gallery items={p.gallery2} name={p.name} /> : <p className="g-empty">Les réalisations arrivent bientôt.</p> },
            { id: "tarifs", label: "Tarifs", panel: (
              <>
                <h2 className="panel-h">{p.packages.length === 3 ? <>Trois façons de <em>briller</em></> : p.packages.length ? <>Nos <em>formules</em></> : <>Tarifs <em>sur devis</em></>}</h2>
                <p className="panel-sub">{p.packages.length ? "Prix indicatifs, ajustés selon votre date, votre lieu et vos besoins. Le devis est gratuit." : "Décrivez votre mariage : le prestataire vous répond avec un devis gratuit et détaillé."}</p>
                <div className="plans">{p.packages.map((k, i) => (
                  <article key={k.name + i} className={`plan${k.featured ? " featured" : ""}`}>
                    <span className="plan-flag">Le plus demandé</span>
                    <h3>{k.name}</h3>
                    <p className="plan-desc">{k.description}</p>
                    <div className="plan-price"><small>{k.fixed ? "forfait" : "à partir de"}</small><b>{fmt(k.price)}<span>{k.currency}</span></b></div>
                    <ul>
                      {k.includes.map((x) => <li key={x} className="yes"><Yes /><span>{x}</span></li>)}
                      {k.excludes.map((x) => <li key={x} className="no"><No /><span><span className="sr-only">Non inclus : </span>{x}</span></li>)}
                    </ul>
                    <QuoteButton plan={i} className={`btn ${k.featured ? "btn-gold" : "btn-ghost"}`}>Choisir {k.name}</QuoteButton>
                  </article>
                ))}</div>
                {p.options.length > 0 && <div className="options"><h3>Options à la carte</h3>{p.options.map((o) => <div key={o.name} className="opt"><span>{o.name}</span><b>+ {fmt(o.price)} {o.currency}</b></div>)}</div>}
              </>
            ) },
            { id: "avis", label: "Avis", count: fmt(p.reviews), panel: (
              <>
                <div className="rv-sum">
                  <div className="rv-score"><b>{p.reviews ? p.rating.toFixed(1).replace(".", ",") : "–"}</b><Stars rating={p.rating} /><small>{p.reviews ? `${fmt(p.reviews)} avis vérifiés` : "Pas encore d’avis"}</small></div>
                  <div className="dist ready">{p.dist.map((pc, i) => <div key={i} className="dist-row"><span>{5 - i} étoile{i < 4 ? "s" : ""}</span><span className="dist-bar"><i style={{ "--w": `${pc}%` } as React.CSSProperties} /></span><span>{pc} %</span></div>)}</div>
                </div>
                <div className="reviews">
                  {p.reviewList.slice(0, 4).map((r, i) => <ReviewCard key={i} r={r} name={p.name} />)}
                  <MoreReviews total={p.reviewList.length}>{p.reviewList.slice(4).map((r, i) => <ReviewCard key={i} r={r} name={p.name} />)}</MoreReviews>
                </div>
              </>
            ) },
            { id: "apropos", label: "À propos", panel: (
              <div className="about">
                <div className="bio">
                  {p.bio.map((b, i) => <p key={i}>{b}</p>)}
                  {p.styleTags.length > 0 && <><h3 style={{ marginTop: 28 }}>Style</h3><ul className="tags">{p.styleTags.map((s) => <li key={s}>{s}</li>)}</ul></>}
                </div>
                <div className="facts">
                  {p.keyFigures.length > 0 && <div className="kv">{p.keyFigures.map(([b, s]) => <div key={s}><b>{b}</b><span>{s}</span></div>)}</div>}
                  {p.facts.length > 0 && <div><h3>En détail</h3><ul className="list">{p.facts.map((f) => <li key={f}>{f}</li>)}</ul></div>}
                  {p.address && <div><h3>Adresse</h3><p style={{ margin: 0 }}>{p.address}{p.access && <><br /><small style={{ color: "var(--muted)" }}>{p.access}</small></>}</p>
                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.address}, ${p.city}`)}`} target="_blank" rel="noopener">Itinéraire ↗</a></div>}
                  <div><h3>Zone d’intervention</h3><p style={{ margin: 0, color: "rgba(245,240,232,.85)" }}>{p.zone}</p></div>
                  {p.languages.length > 0 && <div><h3>Langues parlées</h3><ul className="tags">{p.languages.map((l) => <li key={l}>{l}</li>)}</ul></div>}
                </div>
              </div>
            ) },
            { id: "dispo", label: "Disponibilités", panel: (
              <>
                <h2 className="panel-h">Vos dates, <em>en temps réel</em></h2>
                <p className="panel-sub">Touchez une date libre pour demander un devis.</p>
                <Calendar availability={p.availability} />
              </>
            ) },
          ]} />
        </div>

        <aside className="aside" aria-label="Demander un devis">
          <div className="contact">
            <span className="from">{c ? "à partir de" : "tarifs"}</span>
            <div className="amount">{c ? <>{fmt(c.price)}<span>{c.currency}</span></> : "Sur devis"}</div>
            <div className="rate"><Star />{p.reviews ? <><b>{p.rating.toFixed(1).replace(".", ",")}</b><span style={{ color: "var(--muted)" }}>· {fmt(p.reviews)} avis</span></> : <b>Nouveau</b>}</div>
            <QuoteButton>Demander un devis</QuoteButton>
            <div className="resp"><Clock /><div>{p.response ? `Répond en ${p.response}` : "Devis gratuit"}<small>Sans compte · gratuit et sans engagement</small></div></div>
          </div>
        </aside>
      </div>

      {similar.length > 0 && (
        <section className="more" aria-labelledby="simTitle">
          <div className="container">
            <div className="section-head">
              <div><p className="eyebrow">Dans la même catégorie</p><h2 className="display h2" id="simTitle" style={{ fontSize: "clamp(1.9rem,3.8vw,3.2rem)" }}>Prestataires <em className="gold-text">similaires</em></h2></div>
            </div>
            <div className="team">
              {similar.map((v) => (
                <Link key={v.slug} className="tm8 ph" href={vendorUrl(v.slug)} data-cursor="Voir">
                  <Image src={v.gallery[0]} alt="" fill sizes="(max-width: 700px) 45vw, 20vw" />
                  <span className="k">{v.catName}</span><strong>{v.name}</strong><small>{v.city} · {v.price == null ? "sur devis" : `dès ${priceLabel(v)}`}</small>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
      <MobileBar p={p} price={minPrice} />
    </QuoteProvider>
  );
}

export default function ProfilPage({ params }: PageProps<"/prestataires/[slug]">) {
  return (
    <Suspense fallback={<div className="cover" aria-busy="true" />}>
      <ProfileView params={params} />
    </Suspense>
  );
}
