/* Types et constantes : modération, mise en avant de l'accueil, catalogue */

/** Motifs de modération — codes identiques à moderation_reason_ok() en base */
export const MODERATION_REASONS = [
  { code: "inapproprie", label: "Contenu inapproprié" },
  { code: "nudite", label: "Nudité" },
  { code: "violence", label: "Violence ou haine" },
  { code: "droits_auteur", label: "Photo volée (droits d’auteur)" },
  { code: "faux_avis", label: "Faux avis" },
  { code: "spam", label: "Spam ou publicité" },
  { code: "arnaque", label: "Arnaque" },
  { code: "hors_sujet", label: "Hors sujet (pas un mariage)" },
  { code: "informations_fausses", label: "Informations fausses" },
  { code: "doublon", label: "Doublon" },
  { code: "qualite", label: "Qualité insuffisante" },
  { code: "autre", label: "Autre" },
] as const;
export type ModerationReason = (typeof MODERATION_REASONS)[number]["code"];
export const reasonLabel = (code: string) => MODERATION_REASONS.find((r) => r.code === code)?.label ?? code;

export type ReportTarget = "media" | "review" | "story" | "vendor";
export const TARGET_LABEL: Record<ReportTarget, string> = { media: "Photo / vidéo", review: "Avis", story: "Story", vendor: "Vitrine" };

export type VendorRef = { id: string; name: string; slug: string; city?: string; category?: string; avatarUrl?: string; coverUrl?: string };

/** Signalements regroupés par élément visé */
export type ReportGroup = {
  key: string;
  targetType: ReportTarget;
  targetId: string;
  vendor: VendorRef;
  count: number;
  reasons: string[];
  details: string[];
  firstAt: string;
  lastAt: string;
  preview: { url?: string; kind?: "photo" | "video"; text?: string; rating?: number; author?: string; title?: string; hidden?: boolean; missing?: boolean };
};
export type PendingReview = { id: string; vendor: VendorRef; author: string; rating: number; body: string; city?: string; createdAt: string; verified: boolean };
export type HiddenMedia = { id: string; url: string; kind: "photo" | "video"; vendor: VendorRef; reason?: string; moderatedAt?: string };

export type Slide = {
  id: string; vendor: VendorRef; mediaId?: string; imagePath?: string; imageUrl?: string; mediaKind?: "photo" | "video";
  title: string; subtitle: string; startsAt?: string; endsAt?: string; isActive: boolean; sort: number;
};
export type HomePick = { id: string; section: "recommandations" | "a_la_une"; vendor: VendorRef; startsAt?: string; endsAt?: string; sort: number };
export type FeaturedStory = { storyId: string; title: string; coverUrl?: string; vendor: VendorRef; startsAt?: string; endsAt?: string; sort: number };
export type StoryOption = { id: string; title: string; coverUrl?: string; vendor: VendorRef };
export type MediaOption = { id: string; url: string; kind: "photo" | "video" };

export type AdminCategory = { id: number; slug: string; name: string; namePlural: string; icon: string; imagePath?: string; imageUrl?: string; isActive: boolean; sort: number; vendors: number };
export type AdminCity = { id: number; name: string; slug: string; province: string; isActive: boolean; sort: number; vendors: number };

/** Icônes proposées pour les catégories (noms lucide, stockés en base) */
export const CATEGORY_ICONS = ["camera", "video", "plane", "building", "sparkles", "flower", "utensils", "music", "brush", "car", "clipboard", "gem", "cake", "shirt", "mic", "heart", "church", "tent"] as const;

/** Période de diffusion : « en cours », « à venir », « terminée » */
export function periodStatus(startsAt?: string, endsAt?: string, now = Date.now()) {
  if (startsAt && new Date(startsAt).getTime() > now) return "upcoming" as const;
  if (endsAt && new Date(endsAt).getTime() <= now) return "ended" as const;
  return "live" as const;
}
