/* =========================================================
   Espace prestataire — modèles côté interface
   (miroir simplifié des tables media, albums, stories,
   vendor_stats_daily, inquiries, reviews, notifications)
   ========================================================= */

export type PlanId = "free" | "pro" | "prestige";

export const PLANS: Record<PlanId, { name: string; maxPhotos: number; maxVideos: number; storageMb: number; maxVideoMb: number; stories: boolean }> = {
  free: { name: "Gratuit", maxPhotos: 30, maxVideos: 0, storageMb: 500, maxVideoMb: 0, stories: false },
  pro: { name: "Pro", maxPhotos: 300, maxVideos: 10, storageMb: 5120, maxVideoMb: 200, stories: true },
  prestige: { name: "Prestige", maxPhotos: 1500, maxVideos: 50, storageMb: 25600, maxVideoMb: 500, stories: true },
};

export type MediaItem = {
  id: string;
  kind: "photo" | "video";
  url: string;
  /** Vignette des vidéos */
  posterUrl?: string;
  source: "local" | "remote";
  name: string;
  size: number;
  width?: number;
  height?: number;
  /** Durée des vidéos, en secondes */
  duration?: number;
  albumId?: string;
  featured: boolean;
  alt: string;
  status: "uploading" | "processing" | "ready" | "error";
  progress: number;
  error?: string;
  createdAt: string;
};

export type Album = { id: string; title: string; kind: "wedding" | "theme"; date?: string; coverId?: string; createdAt: string };

export type Story = {
  id: string;
  title: string;
  mediaIds: string[];
  /** Durée d’affichage de chaque image */
  durationSec: number;
  /** story = 24 h ; highlight = permanent sur la vitrine */
  kind: "story" | "highlight";
  expiresAt?: string;
  archived: boolean;
  createdAt: string;
};

export type InquiryStatus = "new" | "discussing" | "quote_sent" | "confirmed" | "lost";
export const INQUIRY_STATUS: Record<InquiryStatus, { label: string; tone: "rose" | "gold" | "muted" | "success" | "danger" }> = {
  new: { label: "Nouveau", tone: "rose" },
  discussing: { label: "En discussion", tone: "gold" },
  quote_sent: { label: "Devis envoyé", tone: "muted" },
  confirmed: { label: "Confirmé", tone: "success" },
  lost: { label: "Perdu", tone: "danger" },
};

export type Inquiry = {
  id: string;
  couple: string;
  email?: string;
  phone?: string;
  contactPref?: "whatsapp" | "call" | "email";
  venue?: string;
  lostReason?: string;
  weddingDate: string;
  city: string;
  guests?: number;
  packageName?: string;
  budget?: number;
  status: InquiryStatus;
  message: string;
  unread: boolean;
  createdAt: string;
};

export type Review = {
  id: string; names: string; photo: string; rating: number; text: string; weddingDate: string; reply?: string; createdAt: string;
  /* Étape 5 */
  status?: "pending" | "published" | "hidden";
  /** Lié à une demande confirmée via un lien de collecte */
  verified?: boolean;
  city?: string;
  repliedAt?: string;
  inquiryId?: string;
};

export type Notification = { id: string; type: "new_inquiry" | "new_message" | "new_review" | "quota" | "tip"; title: string; body?: string; link: string; read: boolean; createdAt: string };

export type DayStat = {
  day: string; views: number; whatsapp: number; calls: number; inquiries: number; followers: number;
  /** Étape 5 : vues de photos et provenance des visites */
  photoViews?: number;
  sources?: Partial<Record<TrafficSource, number>>;
};
export type TrafficSource = "recherche" | "categorie" | "recommandations" | "instagram" | "whatsapp" | "direct";
export const SOURCES: Record<TrafficSource, string> = {
  recherche: "Recherche NDOA", categorie: "Pages catégorie", recommandations: "« Nos recommandations »",
  instagram: "Instagram et TikTok", whatsapp: "Partages WhatsApp", direct: "Lien direct",
};

/* ---------- Étape 4 : tarifs, messagerie, devis, disponibilités ---------- */
export type Currency = "USD" | "CDF";

export type Package = {
  id: string;
  name: string;
  description: string;
  priceMode: "from" | "fixed";
  /** Montant en unités (dollars ou francs), converti en centimes côté base pour l’USD */
  amount: number;
  currency: Currency;
  duration: string;
  includes: string[];
  excludes: string[];
  featured: boolean;
  visible: boolean;
};

export type PackageOption = { id: string; name: string; amount: number; currency: Currency; packageId?: string };

export type Promotion = {
  id: string;
  label: string;
  kind: "seasonal" | "limited";
  discount: "percent" | "amount" | "override";
  value: number;
  startsAt: string;
  endsAt: string;
  packageId?: string;
};

export type Message = { id: string; inquiryId: string; sender: "vendor" | "couple" | "system"; body: string; quoteId?: string; createdAt: string };
export type QuickReply = { id: string; title: string; body: string };

export type QuoteLine = { label: string; qty: number; unit: number };
export type Quote = {
  id: string;
  inquiryId: string;
  number: string;
  packageId?: string;
  lines: QuoteLine[];
  discount: number;
  currency: Currency;
  validUntil: string;
  notes: string;
  status: "draft" | "sent" | "accepted" | "declined";
  sentAt?: string;
  createdAt: string;
};
export const quoteTotal = (q: Pick<Quote, "lines" | "discount">) => Math.max(0, q.lines.reduce((s, l) => s + l.qty * l.unit, 0) - q.discount);

export type DayStatus = "booked" | "option" | "blocked";
export type DayEntry = { status: DayStatus; inquiryId?: string; note?: string };

export type EspaceData = {
  plan: PlanId;
  packages: Package[];
  options: PackageOption[];
  promotions: Promotion[];
  messages: Message[];
  quickReplies: QuickReply[];
  quotes: Quote[];
  /** Clé : date ISO (AAAA-MM-JJ) */
  availability: Record<string, DayEntry>;
  /* Étape 5 */
  reviewRequests: ReviewRequest[];
  subscription: Subscription;
  invoices: Invoice[];
  members: Member[];
  notifPrefs: NotifPrefs;
  settings: Settings;
  topPhotos: TopPhoto[];
  /** Moyennes de la catégorie sur 30 jours (anonymisées) */
  benchmark: Benchmark;
  media: MediaItem[];
  albums: Album[];
  stories: Story[];
  stats: DayStat[];
  inquiries: Inquiry[];
  reviews: Review[];
  notifications: Notification[];
  followers: number;
};

export const PLAN_MAX_PACKAGES: Record<PlanId, number> = { free: 1, pro: 10, prestige: 99 };

/** Promotion active pour un forfait à une date donnée */
export function activePromo(promos: Promotion[], packageId: string, day: string) {
  return promos.find((p) => (!p.packageId || p.packageId === packageId) && p.startsAt <= day && day <= p.endsAt);
}
export function promoPrice(amount: number, p?: Promotion) {
  if (!p) return amount;
  if (p.discount === "percent") return Math.round(amount * (1 - p.value / 100));
  if (p.discount === "amount") return Math.max(0, amount - p.value);
  return p.value;
}

/* ---------- Étape 5 : avis, statistiques, abonnement, paramètres ---------- */
export type ReviewRequest = {
  token: string;
  inquiryId?: string;
  couple: string;
  channel: "whatsapp" | "email" | "lien";
  sentTo?: string;
  expiresAt: string;
  usedAt?: string;
  createdAt: string;
};

export type TopPhoto = { mediaId: string; views: number; contacts: number };
export type Benchmark = { views: number; ctr: number; responseHours: number; conversion: number; rating: number; vendors: number };

export type PaymentMethod = "mpesa" | "orange_money" | "airtel_money" | "card";
export const PAYMENT_METHODS: Record<PaymentMethod, { label: string; short: string; prefix?: string[] }> = {
  mpesa: { label: "M-Pesa (Vodacom)", short: "M-Pesa", prefix: ["81", "82", "83"] },
  orange_money: { label: "Orange Money", short: "Orange Money", prefix: ["84", "85", "89"] },
  airtel_money: { label: "Airtel Money", short: "Airtel Money", prefix: ["97", "98", "99"] },
  card: { label: "Carte bancaire (Visa, Mastercard)", short: "Carte" },
};

export type Subscription = {
  plan: PlanId;
  status: "trialing" | "active" | "past_due" | "canceled";
  currency: Currency;
  /** Fin de la période payée (AAAA-MM-JJ) */
  periodEnd?: string;
  cancelAtPeriodEnd: boolean;
  method?: PaymentMethod;
  /** Numéro Mobile Money masqué, ex. « •••• 45 67 » */
  account?: string;
};

export type Invoice = {
  id: string;
  number: string;
  plan: PlanId;
  months: number;
  amount: number;
  currency: Currency;
  method: PaymentMethod;
  status: "pending" | "paid" | "failed" | "refunded";
  periodStart: string;
  periodEnd: string;
  paidAt?: string;
  createdAt: string;
};

/** Offres commerciales (miroir de la table plans) */
export const OFFERS: Record<PlanId, { price: Record<Currency, number>; seats: number; verified: boolean; recommended: boolean; advancedStats: boolean; pitch: string }> = {
  free: { price: { USD: 0, CDF: 0 }, seats: 1, verified: false, recommended: false, advancedStats: false, pitch: "Pour démarrer et tester NDOA Wedding." },
  pro: { price: { USD: 19, CDF: 55000 }, seats: 3, verified: true, recommended: false, advancedStats: true, pitch: "Pour les prestataires qui signent chaque mois." },
  prestige: { price: { USD: 49, CDF: 140000 }, seats: 10, verified: true, recommended: true, advancedStats: true, pitch: "Pour les maisons qui veulent la première place." },
};
/** Engagement annuel : 12 mois au prix de 10 */
export const offerPrice = (plan: PlanId, currency: Currency, months: 1 | 12) => OFFERS[plan].price[currency] * (months === 12 ? 10 : 1);

export type MemberRole = "owner" | "manager" | "editor" | "viewer";
export const ROLES: Record<MemberRole, { label: string; can: string }> = {
  owner: { label: "Propriétaire", can: "Tout, y compris l’abonnement et la suppression de la vitrine" },
  manager: { label: "Gérant", can: "Vitrine, demandes, devis, statistiques détaillées et équipe" },
  editor: { label: "Éditeur", can: "Galerie, tarifs, calendrier, demandes et avis" },
  viewer: { label: "Lecteur", can: "Consultation uniquement" },
};
export type Member = { id: string; name?: string; email: string; role: MemberRole; status: "invited" | "active" | "revoked"; invitedAt: string; lastActiveAt?: string; you?: boolean };

export type NotifType = "new_inquiry" | "new_message" | "new_review" | "reminder" | "billing" | "tips";
export type NotifChannel = "in_app" | "email" | "sms" | "whatsapp";
export type NotifPrefs = Record<NotifType, Record<NotifChannel, boolean>>;
export const NOTIF_TYPES: Record<NotifType, { label: string; hint: string }> = {
  new_inquiry: { label: "Nouvelle demande", hint: "Un couple vous demande un devis" },
  new_message: { label: "Nouveau message", hint: "Réponse d’un couple dans une conversation" },
  new_review: { label: "Nouvel avis", hint: "Un couple publie un avis sur votre vitrine" },
  reminder: { label: "Rappels de mariage", hint: "La veille et 7 jours avant chaque date réservée" },
  billing: { label: "Abonnement et factures", hint: "Paiements, renouvellements, échecs" },
  tips: { label: "Conseils et nouveautés", hint: "Astuces pour recevoir plus de demandes" },
};
export const NOTIF_CHANNELS: Record<NotifChannel, string> = { in_app: "Dans l’app", email: "E-mail", sms: "SMS", whatsapp: "WhatsApp" };

export type Locale = "fr" | "en" | "ln" | "sw";
export type DeviceSession = { id: string; device: string; place: string; lastActiveAt: string; current?: boolean };
export type Settings = { locale: Locale; displayCurrency: Currency; twoFactor: boolean; sessions: DeviceSession[]; paused: boolean };
