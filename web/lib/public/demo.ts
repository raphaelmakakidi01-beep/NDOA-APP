/*
 * Données de démonstration de la marketplace : UNIQUEMENT en développement local (mode démo, voir lib/config).
 * Reprises du site statique d'origine (index.html, prestataire.html). En production, tout vient de Supabase.
 */
import { CATEGORIES, U } from "@/lib/onboarding/catalog";
import type { Card, Category, Home, InspirationItem, Profile, Testimonial } from "./types";

const P = {
  coupleA: "1519741497674-611481863552", weddingB: "1511285560929-80b456fea0bc", coupleC: "1465495976277-4387d4b0b4c6",
  weddingD: "1522673607200-164d1b6ce486", bride: "1520854221256-17451cc331bf", weddingE: "1606216794074-735e91aa2c92",
  weddingF: "1583939003579-730e3918a45a", rings: "1469371670807-013ccf25f16a", table: "1478146896981-b80fe463b330",
  decor: "1464366400600-7168b8af9bc3", venue: "1519225421980-715cb0215aed", champagne: "1530103862676-de8c9debad1d",
  party: "1492684223066-81342ee5ff30", dj: "1470225620780-dba8ba36b745", concert: "1516450360452-9312f5e86fc7",
  makeup: "1487412947147-5cebf100ffc2", makeup2: "1522335789203-aabd1fc54bc9", flowers: "1490750967868-88aa4486c946",
  flowers2: "1487530811176-3780de880c2d", catering: "1555244162-803834f70033", food: "1414235077428-338989a2e8c0",
  car: "1503376780353-7e6692767b70", car2: "1494976388531-d1058494cdd8", drone: "1473968512647-3e447244af8f",
  camera2: "1516035069371-29a1b244cc32",
  a1: "1531746020798-e6953c6e8e04", a2: "1500648767791-00dcc994a43e", a3: "1506794778202-cad84cf45f1d",
  a4: "1494790108377-be9c29b29330", a5: "1534528741775-53994a69daeb", a6: "1507003211169-0a1dd7228f2d",
  a7: "1544005313-94ddf0286df2", a8: "1438761681033-6461ffad8d80", a9: "1472099645785-5658abf4ff4e",
  a10: "1517841905240-472988babdf9", a11: "1507679799987-c73779587ccf", a12: "1560250097-0b93528c311a",
};
const catName = (slug: string) => CATEGORIES.find((c) => c.slug === slug)?.name ?? "Prestataire";

type Raw = [slug: string, name: string, cat: string, city: string, rating: number, reviews: number, price: number, likes: number, avatar: string, gallery: string[], tagline: string, story: string];
const RAW: Raw[] = [
  ["studio-lumiere-mbala", "Studio Lumière Mbala", "photographe", "Kinshasa", 4.9, 214, 850, 3120, P.a6, [P.coupleA, P.weddingB, P.bride], "Je photographie les mariés comme des icônes : avec lumière, audace et vérité.", "Golden hour sur le boulevard du 30 Juin"],
  ["kasa-films", "Kasa Films", "videaste", "Kinshasa", 4.8, 167, 1200, 2410, P.a2, [P.camera2, P.weddingD, P.coupleC], "Des films de mariage qui se regardent comme du cinéma.", "Making-of d’un clip de mariage"],
  ["skyshot-congo", "SkyShot Congo", "drone", "Lubumbashi", 4.7, 58, 350, 980, P.a9, [P.drone, P.venue, P.weddingE], "Votre cortège vu du ciel.", "Vue aérienne du cortège"],
  ["salle-le-fleuve-dor", "Le Fleuve d’Or", "salle", "Kinshasa", 4.9, 302, 3500, 4870, P.a12, [P.venue, P.table, P.decor], "La salle de réception au bord du fleuve Congo.", "Nouvelle mise en lumière de la grande salle"],
  ["maison-nkosi-deco", "Maison Nkosi Déco", "decorateur", "Goma", 4.8, 121, 1500, 2050, P.a4, [P.decor, P.table, P.flowers2], "Une table doit raconter une histoire avant même le premier toast.", "Installation d’une arche dorée"],
  ["fleurs-de-matadi", "Fleurs de Matadi", "fleuriste", "Matadi", 4.6, 74, 400, 860, P.a8, [P.flowers, P.flowers2, P.rings], "Bouquets et compositions de saison.", "Bouquet signature de la saison"],
  ["saveurs-mama-tshala", "Saveurs de Mama Tshala", "traiteur", "Lubumbashi", 4.9, 189, 1800, 2760, P.a7, [P.catering, P.food, P.table], "La cuisine congolaise des grands jours.", "Dressage du buffet de gala"],
  ["dj-kinoir", "DJ Kinoir", "dj", "Kinshasa", 4.8, 143, 600, 5230, P.a3, [P.dj, P.concert, P.party], "Rumba, afro, ndombolo : la piste ne se vide jamais.", "Warm-up avant l’entrée des mariés"],
  ["glam-by-grace", "Glam by Grâce", "maquilleur", "Goma", 5.0, 96, 150, 3890, P.a5, [P.makeup, P.makeup2, P.bride], "Sublimer sans transformer : la mariée doit se reconnaître, en plus lumineuse.", "Look « gala doré » en 4 étapes"],
  ["prestige-auto-kin", "Prestige Auto Kin", "voiture", "Kinshasa", 4.7, 88, 300, 1340, P.a11, [P.car, P.car2, P.weddingF], "Voitures de prestige pour votre cortège.", "Le cabriolet blanc est arrivé"],
  ["elegance-events", "Élégance Events", "planner", "Lubumbashi", 4.9, 131, 2500, 2980, P.a10, [P.table, P.champagne, P.weddingE], "Le jour J, les mariés n’ont qu’une mission : vivre l’instant.", "Répétition générale au Pullman"],
  ["ngoma-visuals", "Ngoma Visuals", "photographe", "Goma", 4.8, 102, 700, 1720, P.a1, [P.weddingF, P.coupleA, P.rings], "Séances couple au bord du lac Kivu.", "Séance couple au bord du lac Kivu"],
];
const STORY = Object.fromEntries(RAW.map((r) => [r[0], r[11]]));

export const DEMO_CARDS: Card[] = RAW.map(([slug, name, cat, city, rating, reviews, price, likes, avatar, gallery, tagline]) => ({
  id: slug, slug, name, cat, catName: catName(cat), city, tagline, rating, reviews, followers: likes, price,
  verified: true, recommended: ["studio-lumiere-mbala", "glam-by-grace", "dj-kinoir", "maison-nkosi-deco", "elegance-events"].includes(slug),
  avatar: U(avatar, 320, 320), cover: U(gallery[0], 1600), gallery: gallery.map((g) => U(g, 1200)),
}));
const bySlug = (s: string) => DEMO_CARDS.find((c) => c.slug === s)!;

const DEMO_CATEGORIES: Category[] = CATEGORIES.map((c) => ({
  slug: c.slug, name: c.name, plural: c.name.endsWith("s") || c.slug === "dj" ? c.name : `${c.name}s`, image: U(c.img, 900),
  count: DEMO_CARDS.filter((v) => v.cat === c.slug).length,
}));

const TESTIMONIALS: Testimonial[] = [
  { names: "Grâce & Patrick", city: "Kinshasa", date: "Juin 2026", rating: 5, text: "On cherchait un photographe qui comprenne notre énergie. Nos photos ressemblent à une couverture de magazine.", vendor: { slug: "studio-lumiere-mbala", name: "Studio Lumière Mbala" } },
  { names: "Divine & Jonathan", city: "Lubumbashi", date: "Avril 2026", rating: 5, text: "Traiteur, planner et DJ réservés au même endroit, avec des devis clairs en dollars. Zéro stress.", vendor: { slug: "elegance-events", name: "Élégance Events" } },
  { names: "Rachel & Héritier", city: "Goma", date: "Février 2026", rating: 5, text: "Glam by Grâce m’a rendue lumineuse du matin jusqu’à la dernière danse.", vendor: { slug: "glam-by-grace", name: "Glam by Grâce" } },
];

export const DEMO_HOME: Home = {
  slides: [[P.coupleC, "studio-lumiere-mbala"], [P.venue, "salle-le-fleuve-dor"], [P.party, "dj-kinoir"], [P.bride, "glam-by-grace"], [P.decor, "maison-nkosi-deco"]]
    .map(([img, s]) => ({ image: U(img, 2200), title: "", subtitle: "", video: false, vendor: bySlug(s) })),
  feature: { ...bySlug("studio-lumiere-mbala"), cover: U(P.coupleA, 1600) },
  picks: ["glam-by-grace", "dj-kinoir", "maison-nkosi-deco", "elegance-events"].map(bySlug),
  stories: DEMO_CARDS.slice(0, 10).map((v) => ({ id: v.slug, title: STORY[v.slug], ring: v.avatar, frames: v.gallery.map((image) => ({ image, caption: STORY[v.slug] })), vendor: v })),
  categories: DEMO_CATEGORIES,
  cities: ["Kinshasa", "Lubumbashi", "Goma", "Matadi"],
  vendors: DEMO_CARDS,
  testimonials: TESTIMONIALS,
};

export function demoProfile(slug: string): Profile | null {
  const v = DEMO_CARDS.find((c) => c.slug === slug);
  if (!v) return null;
  const raw = RAW.find((r) => r[0] === slug)!;
  const names = ["Grâce & Patrick", "Divine & Jonathan", "Rachel & Héritier"];
  const images = [...raw[9], ...raw[9]];
  return {
    ...v,
    bio: [`${v.name} accompagne les mariés à ${v.city} avec passion et exigence.`, "Profil de démonstration : les informations détaillées sont complétées par le prestataire."],
    styleTags: ["Élégant", "Moderne", "Coutumier"], zone: `${v.city} et environs`, languages: ["Français", "Lingala"],
    coverImage: v.cover,
    gallery2: images.map((id, i) => ({ image: U(id, 1200), width: 1000, height: [1250, 900, 1350, 800, 1100, 1000][i % 6], alt: "", album: names[i % 3], video: null })),
    packages: [
      { id: null, name: "Essentiel", description: "L’essentiel, réalisé avec soin.", price: v.price ?? 0, currency: "USD", fixed: false, featured: false, includes: ["Rendez-vous de préparation", "Prestation le jour J", "Suivi WhatsApp"], excludes: ["Options sur mesure"] },
      { id: null, name: "Premium", description: "Notre formule la plus demandée.", price: Math.round(((v.price ?? 0) * 1.75) / 10) * 10, currency: "USD", fixed: false, featured: true, includes: ["Prestation étendue le jour J", "Coordination avec vos autres prestataires", "Suivi prioritaire"], excludes: [] },
      { id: null, name: "Prestige", description: "Une prestation entièrement personnalisée.", price: Math.round(((v.price ?? 0) * 2.9) / 10) * 10, currency: "USD", fixed: false, featured: false, includes: ["Tout le Premium", "Présence sur toutes vos cérémonies"], excludes: [] },
    ],
    options: [{ id: null, name: "Déplacement hors de la ville", price: 150, currency: "USD" }, { id: null, name: "Heure supplémentaire", price: 80, currency: "USD" }],
    reviewList: TESTIMONIALS.map((t) => ({ names: t.names, image: null, date: t.date, city: t.city, rating: t.rating, text: t.text, reply: "" })),
    dist: [88, 9, 2, 1, 0],
    facts: ["Rendez-vous de préparation", "Devis détaillé sous 48 h"],
    keyFigures: [[String(v.reviews), "avis vérifiés"], [String(Math.round(v.reviews * 1.8)), "mariages réalisés"]],
    address: "", access: "",
    highlights: [{ title: "Mariages", frames: v.gallery, caption: "Nos dernières réalisations" }, { title: "Coulisses", frames: [v.gallery[2], v.gallery[0]], caption: "Préparatifs" }],
    availability: {},
    response: "moins de 3 h", hasPhone: true, hasWhatsapp: true,
  };
}

export const DEMO_INSPIRATION: InspirationItem[] = DEMO_CARDS.flatMap((v) => v.gallery.map((image, i) => ({
  image, width: 1000, height: [1250, 900, 1100][i % 3], alt: `Réalisation de ${v.name}`, vendor: { slug: v.slug, name: v.name, catName: v.catName, city: v.city },
})));
