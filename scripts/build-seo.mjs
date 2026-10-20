#!/usr/bin/env node
/* =========================================================
   NDOA Wedding — génération SEO du site public
   ---------------------------------------------------------
   node scripts/build-seo.mjs            (SITE_URL=https://ndoa.cd par défaut)

   1. Remplit le bloc <!-- SEO:START --> … <!-- SEO:END --> de chaque page :
      title, description, canonical, Open Graph (WhatsApp, Facebook,
      Instagram), Twitter Card, données structurées JSON-LD.
   2. Génère une page statique par prestataire : /prestataire/<slug>/index.html
      (URL propre, aperçu de partage correct même sans JavaScript).
   3. Écrit sitemap.xml et robots.txt.
   À relancer après chaque ajout de prestataire ou de page.
   ========================================================= */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = (process.env.SITE_URL || "https://ndoa.cd").replace(/\/$/, "");
const OG_DEFAULT = `${SITE}/assets/brand/og-ndoa.jpg`;
const TODAY = new Date().toISOString().slice(0, 10);

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const write = (f, s) => { fs.mkdirSync(path.dirname(path.join(ROOT, f)), { recursive: true }); fs.writeFileSync(path.join(ROOT, f), s); };

function seoBlock({ title, description, url, image = OG_DEFAULT, imageAlt = "NDOA Wedding", type = "website", jsonld, noindex }) {
  return [
    "<!-- SEO:START (généré par scripts/build-seo.mjs, ne pas modifier à la main) -->",
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}">`,
    noindex ? '<meta name="robots" content="noindex, follow">' : `<link rel="canonical" href="${esc(url)}">`,
    '<meta property="og:site_name" content="NDOA Wedding">',
    '<meta property="og:locale" content="fr_FR">',
    `<meta property="og:type" content="${type}">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta property="og:image" content="${esc(image)}">`,
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    `<meta property="og:image:alt" content="${esc(imageAlt)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(description)}">`,
    `<meta name="twitter:image" content="${esc(image)}">`,
    jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, "\\u003c")}</script>` : "",
    "<!-- SEO:END -->",
  ].filter(Boolean).join("\n");
}

function inject(html, block, file) {
  const re = /<!-- SEO:START[\s\S]*?<!-- SEO:END -->/;
  if (!re.test(html)) throw new Error(`Bloc SEO absent dans ${file}`);
  return html.replace(re, block);
}

/* ---------- Pages statiques ---------- */
const ORG = {
  "@context": "https://schema.org", "@type": "Organization", name: "NDOA Wedding", url: SITE,
  logo: `${SITE}/assets/brand/icon-512.png`, areaServed: ["Kinshasa", "Lubumbashi", "Goma", "Matadi"],
};
const PAGES = [
  { file: "index.html", path: "/", title: "NDOA Wedding — Les meilleurs prestataires de mariage en RDC",
    description: "Photographes, vidéastes, salles, traiteurs, DJ, décorateurs… Comparez les prestataires de mariage à Kinshasa, Lubumbashi, Goma et Matadi, et demandez vos devis gratuitement.",
    jsonld: [ORG, { "@context": "https://schema.org", "@type": "WebSite", name: "NDOA Wedding", url: SITE }] },
  { file: "a-propos.html", path: "/a-propos.html", title: "À propos — NDOA Wedding",
    description: "NDOA Wedding réunit les prestataires de mariage de Kinshasa, Lubumbashi, Goma et Matadi. Notre histoire, nos engagements, nos villes.", image: `${SITE}/assets/brand/og-a-propos.jpg` },
  { file: "contact.html", path: "/contact.html", title: "Contact et aide — NDOA Wedding",
    description: "Une question sur NDOA Wedding, un partenariat, un souci avec une demande de devis ? Écrivez-nous, réponse sous 48 heures." },
  { file: "cgu.html", path: "/cgu.html", title: "Conditions d’utilisation — NDOA Wedding", description: "Conditions générales d’utilisation de la plateforme NDOA Wedding." },
  { file: "confidentialite.html", path: "/confidentialite.html", title: "Politique de confidentialité — NDOA Wedding", description: "Comment NDOA Wedding collecte, utilise et protège vos données personnelles." },
  { file: "mentions-legales.html", path: "/mentions-legales.html", title: "Mentions légales — NDOA Wedding", description: "Éditeur, hébergement et contact de la plateforme NDOA Wedding." },
  { file: "404.html", path: "/404.html", title: "Page introuvable — NDOA Wedding", description: "Cette page n’existe pas ou a été déplacée.", noindex: true },
];
for (const p of PAGES) {
  if (!fs.existsSync(path.join(ROOT, p.file))) continue;
  write(p.file, inject(read(p.file), seoBlock({ ...p, url: SITE + p.path, jsonld: p.jsonld }), p.file));
}

/* ---------- Profils prestataires ---------- */
// Les données de démonstration vivent dans prestataire.html (P, CAT, BASE). En production,
// remplacer ce bloc par une lecture de la vue publique Supabase (vendors publiés).
const tpl = read("prestataire.html");
const grab = (name, open, close) => {
  const start = tpl.indexOf(`const ${name} = ${open}`);
  if (start < 0) throw new Error(`Données ${name} introuvables dans prestataire.html`);
  let depth = 0, i = tpl.indexOf(open, start);
  for (; i < tpl.length; i++) { if (tpl[i] === open) depth++; else if (tpl[i] === close && --depth === 0) break; }
  return tpl.slice(tpl.indexOf(open, start), i + 1);
};
const P = new Function(`return ${grab("P", "{", "}")}`)();
const CAT = new Function(`return ${grab("CAT", "{", "}")}`)();
const BASE = new Function("P", `return ${grab("BASE", "[", "]")}`)(P);
const img = (id, w, h) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&h=${h}&q=75`;

const profiles = [];
for (const v of BASE) {
  const label = CAT[v.cat]?.[0] ?? "Prestataire";
  const url = `${SITE}/prestataire/${v.slug}/`;
  const rating = String(v.rating).replace(".", ",");
  const title = `${v.name} — ${label} à ${v.city} | NDOA Wedding`;
  const description = `${v.name}, ${label.toLowerCase()} à ${v.city}. Note ${rating}/5 sur ${v.reviews} avis, à partir de ${v.price} USD. Réalisations, tarifs, disponibilités et devis gratuit.`;
  const jsonld = {
    "@context": "https://schema.org", "@type": "LocalBusiness", name: v.name, url, image: img(v.gallery[0], 1200, 630),
    description, priceRange: `À partir de ${v.price} USD`, currenciesAccepted: "USD, CDF",
    address: { "@type": "PostalAddress", addressLocality: v.city, addressCountry: "CD" }, areaServed: v.city,
    aggregateRating: { "@type": "AggregateRating", ratingValue: v.rating, reviewCount: v.reviews, bestRating: 5 },
  };
  const block = seoBlock({ title, description, url, image: img(v.gallery[0], 1200, 630), imageAlt: `Réalisation de ${v.name}`, type: "profile", jsonld });
  // Le script de la page lit le slug dans l’URL (/prestataire/<slug>/)
  write(`prestataire/${v.slug}/index.html`, inject(tpl, block, "prestataire.html"));
  profiles.push(url);
}
// Gabarit générique (?slug=…) : jamais indexé, les URL propres font foi
write("prestataire.html", inject(tpl, seoBlock({ title: "Prestataire — NDOA Wedding", description: "Profil prestataire NDOA Wedding : réalisations, tarifs, avis et demande de devis.", url: `${SITE}/prestataire.html`, noindex: true }), "prestataire.html"));

/* ---------- sitemap.xml & robots.txt ---------- */
const urls = [
  [`${SITE}/`, "daily", "1.0"], [`${SITE}/a-propos.html`, "monthly", "0.6"], [`${SITE}/contact.html`, "monthly", "0.5"],
  ...profiles.map((u) => [u, "weekly", "0.8"]),
  [`${SITE}/cgu.html`, "yearly", "0.2"], [`${SITE}/confidentialite.html`, "yearly", "0.2"], [`${SITE}/mentions-legales.html`, "yearly", "0.2"],
];
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([loc, freq, prio]) => `  <url><loc>${loc}</loc><lastmod>${TODAY}</lastmod><changefreq>${freq}</changefreq><priority>${prio}</priority></url>`).join("\n")}
</urlset>
`);
write("robots.txt", `User-agent: *
Allow: /
Disallow: /prestataire.html

Sitemap: ${SITE}/sitemap.xml
`);
console.log(`SEO : ${PAGES.length} pages, ${profiles.length} profils, sitemap de ${urls.length} URL (${SITE})`);
