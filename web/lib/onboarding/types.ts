export const STEPS = [
  { key: "activite", label: "Activité", title: "Que faites-vous ?" },
  { key: "entreprise", label: "Entreprise", title: "Votre entreprise" },
  { key: "photos", label: "Photos", title: "Vos plus belles images" },
  { key: "tarif", label: "Tarif", title: "Votre premier forfait" },
  { key: "contacts", label: "Contacts", title: "Comment vous joindre" },
  { key: "apercu", label: "Aperçu", title: "Prêt à briller" },
] as const;

export type StepKey = (typeof STEPS)[number]["key"];
export const isStepKey = (s: string): s is StepKey => STEPS.some((x) => x.key === s);

export type MediaRef = {
  id: string;
  /** URL affichable (objet blob, image distante ou URL Supabase) */
  url: string;
  source: "local" | "remote";
  name: string;
  size: number;
  width?: number;
  height?: number;
  status: "uploading" | "ready" | "error";
  progress: number;
  error?: string;
};

export type Draft = {
  vendorId?: string;
  categories: string[];
  primaryCategory?: string;
  name: string;
  slug: string;
  tagline: string;
  bio: string;
  city: string;
  zones: string[];
  languages: string[];
  avatar?: MediaRef;
  cover?: MediaRef;
  photos: MediaRef[];
  pkg: {
    name: string;
    priceMode: "from" | "fixed";
    amount: string;
    currency: "USD" | "CDF";
    duration: string;
    description: string;
    includes: string[];
    excludes: string[];
  };
  contacts: {
    country: string;
    phone: string;
    whatsappSame: boolean;
    whatsapp: string;
    email: string;
    instagram: string;
    tiktok: string;
    facebook: string;
    youtube: string;
    website: string;
  };
  done: Partial<Record<StepKey, boolean>>;
  publishedAt?: string;
  /** Statut de validation par l'équipe NDOA (Supabase) et motif éventuel */
  review?: { status: "draft" | "pending_review" | "published" | "rejected" | "suspended"; reason?: string };
  /* Champs complétés ensuite dans « Ma vitrine » */
  styleTags?: string[];
  /** Champs propres au métier (matériel, capacité…), clés de DETAIL_FIELDS */
  details?: Record<string, string>;
  /** Couverture vidéo facultative (affichée à la place de la photo) */
  coverVideo?: MediaRef & { posterUrl?: string };
};

export const emptyDraft = (): Draft => ({
  categories: [],
  name: "",
  slug: "",
  tagline: "",
  bio: "",
  city: "Kinshasa",
  zones: [],
  languages: ["Français", "Lingala"],
  photos: [],
  pkg: { name: "Essentiel", priceMode: "from", amount: "", currency: "USD", duration: "", description: "", includes: [], excludes: [] },
  contacts: { country: "+243", phone: "", whatsappSame: true, whatsapp: "", email: "", instagram: "", tiktok: "", facebook: "", youtube: "", website: "" },
  done: {},
});

export const MIN_PHOTOS = 6;
