/* Catalogue partagé (identique à supabase/seed.sql et au site public) */

export const U = (id: string, w = 900, h?: number) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}${h ? `&h=${h}` : ""}&q=72`;

export const CATEGORIES = [
  { slug: "photographe", name: "Photographe", hint: "Reportage, portraits, albums", img: "1465495976277-4387d4b0b4c6" },
  { slug: "videaste", name: "Vidéaste", hint: "Films, teasers, clips", img: "1516035069371-29a1b244cc32" },
  { slug: "drone", name: "Pilote de drone", hint: "Plans aériens", img: "1473968512647-3e447244af8f" },
  { slug: "salle", name: "Salle de fête", hint: "Réception, terrasse, jardin", img: "1519225421980-715cb0215aed" },
  { slug: "decorateur", name: "Décorateur", hint: "Scénographie, arches, tables", img: "1464366400600-7168b8af9bc3" },
  { slug: "fleuriste", name: "Fleuriste", hint: "Bouquets, compositions", img: "1490750967868-88aa4486c946" },
  { slug: "traiteur", name: "Traiteur", hint: "Buffets, menus, service", img: "1555244162-803834f70033" },
  { slug: "dj", name: "DJ", hint: "Son, lumière, ambiance", img: "1470225620780-dba8ba36b745" },
  { slug: "maquilleur", name: "Maquilleuse", hint: "Beauté de la mariée", img: "1487412947147-5cebf100ffc2" },
  { slug: "voiture", name: "Location de voitures", hint: "Cortège, voitures de prestige", img: "1503376780353-7e6692767b70" },
  { slug: "planner", name: "Wedding planner", hint: "Organisation, coordination", img: "1478146896981-b80fe463b330" },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];
export const categoryName = (slug: string) => CATEGORIES.find((c) => c.slug === slug)?.name ?? slug;

export const CITIES = ["Kinshasa", "Lubumbashi", "Goma", "Matadi", "Bukavu", "Kisangani", "Mbuji-Mayi", "Kolwezi", "Boma", "Kananga"];
export const ZONE_SUGGESTIONS = ["Kinshasa", "Kongo-Central", "Haut-Katanga", "Nord-Kivu", "Sud-Kivu", "Lualaba", "Toute la RDC", "Brazzaville", "International"];
export const LANGUAGES = ["Français", "Lingala", "Swahili", "Kikongo", "Tshiluba", "Anglais"];

/** Photos de démonstration (pour remplir vite l’étape 3 en mode démo) */
export const DEMO_PHOTOS = [
  "1519741497674-611481863552", "1511285560929-80b456fea0bc", "1465495976277-4387d4b0b4c6",
  "1522673607200-164d1b6ce486", "1520854221256-17451cc331bf", "1606216794074-735e91aa2c92",
  "1583939003579-730e3918a45a", "1469371670807-013ccf25f16a",
];
export const DEMO_AVATAR = "1507003211169-0a1dd7228f2d";

/** Inclus proposés selon la catégorie principale (étape 4) */
export const INCLUDE_SUGGESTIONS: Record<string, string[]> = {
  photographe: ["Reportage de la journée", "Photos retouchées", "Galerie privée en ligne", "Séance couple", "Album imprimé"],
  videaste: ["Film du mariage", "Teaser 60 s", "Plans drone", "Livraison sur clé USB"],
  salle: ["Tables et chaises", "Sonorisation", "Parking sécurisé", "Groupe électrogène", "Coordinateur le jour J"],
  traiteur: ["Cocktail", "Buffet chaud", "Service à table", "Vaisselle", "Boissons"],
  dj: ["Sonorisation", "Jeux de lumière", "Animation micro", "Playlist personnalisée"],
  default: ["Rendez-vous de préparation", "Prestation le jour J", "Déplacement en ville", "Suivi WhatsApp"],
};

/** Champs propres à chaque métier (miroir de categories.detail_schema dans seed.sql) */
export type DetailField = { key: string; label: string; type: "text" | "number" | "list"; hint?: string; suffix?: string };
export const DETAIL_FIELDS: Record<string, { title: string; fields: DetailField[] }> = {
  photographe: { title: "Matériel et livraison", fields: [
    { key: "materiel", label: "Matériel", type: "list", hint: "Un élément par ligne. Ex. : Canon EOS R5" },
    { key: "delai_livraison", label: "Délai de livraison", type: "text", hint: "Ex. : 4 semaines" },
  ] },
  videaste: { title: "Matériel et formats", fields: [
    { key: "materiel", label: "Matériel", type: "list", hint: "Un élément par ligne." },
    { key: "formats", label: "Formats livrés", type: "list", hint: "Ex. : Film 15 min, teaser 60 s" },
  ] },
  drone: { title: "Appareils et autorisations", fields: [
    { key: "appareils", label: "Appareils", type: "list" },
    { key: "autorisations", label: "Autorisations de vol", type: "text" },
  ] },
  salle: { title: "Capacité et équipements", fields: [
    { key: "places_assises", label: "Places assises", type: "number", suffix: "places" },
    { key: "places_debout", label: "Places debout", type: "number", suffix: "places" },
    { key: "parking", label: "Places de parking", type: "number", suffix: "places" },
    { key: "superficie", label: "Superficie", type: "number", suffix: "m²" },
    { key: "equipements", label: "Équipements", type: "list", hint: "Ex. : Climatisation, groupe électrogène" },
    { key: "adresse", label: "Adresse", type: "text" },
    { key: "acces", label: "Plan d’accès", type: "text", hint: "Repères pour trouver la salle" },
  ] },
  decorateur: { title: "Styles", fields: [{ key: "styles", label: "Styles proposés", type: "list" }] },
  traiteur: { title: "Cuisine et capacité", fields: [
    { key: "cuisines", label: "Cuisines", type: "list", hint: "Ex. : Congolaise, européenne" },
    { key: "couverts_max", label: "Couverts maximum", type: "number", suffix: "couverts" },
  ] },
  dj: { title: "Matériel et musique", fields: [
    { key: "materiel", label: "Matériel son et lumière", type: "list" },
    { key: "genres", label: "Genres musicaux", type: "list", hint: "Ex. : Rumba, ndombolo, afrobeats" },
  ] },
  voiture: { title: "Flotte", fields: [{ key: "flotte", label: "Véhicules", type: "list" }] },
};

export const STYLE_SUGGESTIONS = ["Éditorial", "Reportage", "Lumière naturelle", "Cinématographique", "Classique", "Moderne", "Luxe", "Coutumier", "Minimaliste", "Festif"];
