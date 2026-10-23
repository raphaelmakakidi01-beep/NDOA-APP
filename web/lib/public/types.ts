/* Modèle des pages publiques (marketplace). Toutes les images sont des URL prêtes à afficher. */

export type Card = {
  id: string;
  slug: string;
  name: string;
  cat: string;
  catName: string;
  city: string;
  tagline: string;
  rating: number;
  reviews: number;
  followers: number;
  /** « à partir de », en dollars ; null = sur devis */
  price: number | null;
  verified: boolean;
  recommended: boolean;
  avatar: string;
  cover: string;
  gallery: string[];
};

export type Category = { slug: string; name: string; plural: string; image: string; count: number };
export type Slide = { image: string; title: string; subtitle: string; video: boolean; vendor: Card };
export type Story = { id: string; title: string; ring: string; frames: { image: string; caption: string }[]; vendor: Card };
export type Testimonial = { names: string; city: string; date: string; rating: number; text: string; vendor: { slug: string; name: string } };

export type Home = {
  slides: Slide[];
  feature: Card | null;
  picks: Card[];
  stories: Story[];
  categories: Category[];
  cities: string[];
  vendors: Card[];
  testimonials: Testimonial[];
};

export type GalleryItem = { image: string; width: number; height: number; alt: string; album: string; video: { src: string; duration: string } | null };
export type Package = { id: string | null; name: string; description: string; price: number; currency: "USD" | "CDF"; fixed: boolean; featured: boolean; includes: string[]; excludes: string[] };
export type Review = { names: string; image: string | null; date: string; city: string; rating: number; text: string; reply: string };

export type Profile = Card & {
  bio: string[];
  styleTags: string[];
  zone: string;
  languages: string[];
  coverImage: string;
  gallery2: GalleryItem[];
  packages: Package[];
  options: { id: string | null; name: string; price: number; currency: "USD" | "CDF" }[];
  reviewList: Review[];
  dist: number[];
  facts: string[];
  keyFigures: [string, string][];
  address: string;
  access: string;
  highlights: { title: string; frames: string[]; caption: string }[];
  /** jour ISO → « booked » ou « option » ; les autres jours sont libres */
  availability: Record<string, "booked" | "option">;
  response: string;
  hasPhone: boolean;
  hasWhatsapp: boolean;
};

export type InspirationItem = { image: string; width: number; height: number; alt: string; vendor: { slug: string; name: string; catName: string; city: string } };

export type DirectoryQuery = {
  q?: string;
  categorie?: string;
  ville?: string;
  budget?: string;
  note?: string;
  date?: string;
  tri?: string;
  page?: number;
};
