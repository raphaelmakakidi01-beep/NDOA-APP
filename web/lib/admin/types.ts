export type VendorStatus = "draft" | "pending_review" | "published" | "rejected" | "suspended";
export type PlanId = "free" | "pro" | "prestige";

export const STATUS_META: Record<VendorStatus, { label: string; tone: "gold" | "success" | "muted" | "danger" | "rose" }> = {
  pending_review: { label: "En attente", tone: "gold" },
  published: { label: "En ligne", tone: "success" },
  draft: { label: "Brouillon", tone: "muted" },
  rejected: { label: "À corriger", tone: "rose" },
  suspended: { label: "Suspendue", tone: "danger" },
};
export const PLAN_LABEL: Record<PlanId, string> = { free: "Gratuit", pro: "Pro", prestige: "Prestige" };

/** Motifs de refus prédéfinis (envoyés par e-mail au prestataire, complétés si besoin) */
export const REJECT_REASONS = [
  "Photos de qualité insuffisante (floues, sombres ou pixellisées)",
  "Photos sans rapport avec l’activité déclarée",
  "Présentation trop courte ou incomplète",
  "Tarifs manquants ou incohérents",
  "Coordonnées invalides ou injoignables",
  "Vitrine en double avec un autre compte",
  "Informations trompeuses",
];

export type AdminVendorRow = {
  id: string;
  slug: string;
  name: string;
  city: string;
  status: VendorStatus;
  isVerified: boolean;
  isRecommended: boolean;
  category?: { slug: string; name: string };
  plan: PlanId;
  rating: number;
  ratingCount: number;
  createdAt: string;
  submittedAt?: string;
  publishedAt?: string;
  avatarUrl?: string;
};

export type AdminMedia = { id: string; url: string; kind: "photo" | "video"; isHidden: boolean; hiddenReason?: string };
export type AdminPackage = { id: string; name: string; priceMode: "from" | "fixed"; amount: number; currency: "USD" | "CDF"; isVisible: boolean; duration?: string; includes: string[] };
export type AuditEntry = { id: string; action: string; actor: string; actorRole?: string; reason?: string; createdAt: string };

export type AdminVendorDetail = AdminVendorRow & {
  tagline?: string;
  bio?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  zones: string[];
  languages: string[];
  socials: Record<string, string>;
  coverUrl?: string;
  categories: { slug: string; name: string; primary: boolean }[];
  rejectionReason?: string;
  suspendedReason?: string;
  approvedAt?: string;
  reviewedAt?: string;
  owner?: { id: string; name?: string; phone?: string };
  media: AdminMedia[];
  packages: AdminPackage[];
  /** Admin uniquement (null pour un modérateur : données réservées) */
  stats: { inquiries30: number; views30: number } | null;
  history: AuditEntry[] | null;
};

export type VendorFilters = {
  q: string;
  category: string;
  city: string;
  status: VendorStatus | "";
  plan: PlanId | "";
  sort: "created_at" | "name" | "rating_avg" | "submitted_at";
  dir: "asc" | "desc";
  page: number;
  pageSize: number;
};
export const DEFAULT_FILTERS: VendorFilters = { q: "", category: "", city: "", status: "", plan: "", sort: "created_at", dir: "desc", page: 1, pageSize: 25 };

export type DashboardPoint = { jour: string; inscrits: number; prestataires: number; demandes: number; visites: number };
export type Dashboard = {
  periode_jours: number;
  inscrits: number;
  inscrits_periode: number;
  prestataires_actifs: number;
  en_attente: number;
  demandes_periode: number;
  visites_periode: number;
  revenus_mois: Record<string, number> | null;
  alertes: { medias_signales: number; avis_signales: number; vitrines_signalees: number; avis_en_attente: number; prestataires_en_attente: number };
  series: DashboardPoint[];
};

export type ReviewResult = { ok: number; errors: { id: string; error: string }[] };

/** Checklist de publication (mêmes règles que la base) */
export function readiness(v: Pick<AdminVendorDetail, "media" | "packages" | "phone" | "whatsapp" | "categories" | "bio" | "avatarUrl" | "coverUrl">) {
  const photos = v.media.filter((m) => m.kind === "photo" && !m.isHidden).length;
  return [
    { label: `${photos} photo${photos > 1 ? "s" : ""} (6 minimum)`, ok: photos >= 6, required: true },
    { label: "Au moins un forfait visible", ok: v.packages.some((p) => p.isVisible), required: true },
    { label: "Téléphone ou WhatsApp", ok: !!(v.phone || v.whatsapp), required: true },
    { label: "Activité choisie", ok: v.categories.length > 0, required: true },
    { label: "Présentation (200 caractères ou plus)", ok: (v.bio ?? "").length >= 200, required: false },
    { label: "Photo de profil", ok: !!v.avatarUrl, required: false },
    { label: "Photo de couverture", ok: !!v.coverUrl, required: false },
  ];
}
