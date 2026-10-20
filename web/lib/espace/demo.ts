import { U } from "@/lib/onboarding/catalog";
import type { Draft } from "@/lib/onboarding/types";
import type { Album, Benchmark, DayEntry, DayStat, DeviceSession, EspaceData, Invoice, Member, NotifPrefs, ReviewRequest, TopPhoto, TrafficSource, Inquiry, MediaItem, Message, Notification, Package, PackageOption, Promotion, QuickReply, Review, Story } from "./types";

/* =========================================================
   Données de démonstration réalistes et stables
   (générateur pseudo-aléatoire à graine fixe)
   ========================================================= */

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysFrom = (n: number) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d; };
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

const EXTRA = [
  { id: "1606216794074-735e91aa2c92", album: "a2" }, { id: "1583939003579-730e3918a45a", album: "a1" },
  { id: "1478146896981-b80fe463b330", album: "a3" }, { id: "1464366400600-7168b8af9bc3", album: "a3" },
  { id: "1530103862676-de8c9debad1d", album: "a2" }, { id: "1490750967868-88aa4486c946", album: "a3" },
];
const VIDEOS = [
  { poster: "1492684223066-81342ee5ff30", name: "teaser-divine-jonathan.mp4", duration: 64, album: "a2" },
  { poster: "1519225421980-715cb0215aed", name: "drone-cortege.mp4", duration: 48, album: "a1" },
];

export function seedEspace(draft: Draft, empty = false): EspaceData {
  const now = new Date().toISOString();

  // Médias : photos de l’onboarding + réalisations de démonstration
  const fromDraft: MediaItem[] = draft.photos.filter((p) => p.status === "ready").map((p, i) => ({
    id: p.id, kind: "photo", url: p.url, source: p.source, name: p.name, size: p.size, width: p.width, height: p.height,
    albumId: i % 2 ? "a1" : "a2", featured: i < 6, alt: "", status: "ready", progress: 100, createdAt: hoursAgo(72 + i),
  }));
  const extra: MediaItem[] = empty ? [] : EXTRA.map((e, i) => ({
    id: `demo-p${i}`, kind: "photo", url: U(e.id, 1400), source: "remote", name: `realisation-${i + 10}.webp`, size: 380_000 + i * 21_000,
    albumId: e.album, featured: false, alt: "", status: "ready", progress: 100, createdAt: hoursAgo(200 + i * 5),
  }));
  const videos: MediaItem[] = empty ? [] : VIDEOS.map((v, i) => ({
    id: `demo-v${i}`, kind: "video", url: "", posterUrl: U(v.poster, 1200), source: "remote", name: v.name, size: 48_000_000 + i * 9_000_000,
    duration: v.duration, albumId: v.album, featured: i === 0, alt: "", status: "ready", progress: 100, createdAt: hoursAgo(120 + i),
  }));
  const media = [...fromDraft, ...extra, ...videos];

  const albums: Album[] = empty ? [] : [
    { id: "a1", title: "Grâce & Patrick", kind: "wedding", date: iso(daysFrom(-125)), coverId: media.find((m) => m.albumId === "a1")?.id, createdAt: now },
    { id: "a2", title: "Divine & Jonathan", kind: "wedding", date: iso(daysFrom(-176)), coverId: media.find((m) => m.albumId === "a2")?.id, createdAt: now },
    { id: "a3", title: "Décors & détails", kind: "theme", coverId: "demo-p2", createdAt: now },
  ];

  const stories: Story[] = empty || media.length < 4 ? [] : [
    { id: "s1", title: "Coulisses", mediaIds: media.slice(0, 3).map((m) => m.id), durationSec: 5, kind: "highlight", archived: false, createdAt: hoursAgo(300) },
    { id: "s2", title: "Samedi à la Gombe", mediaIds: media.slice(3, 5).map((m) => m.id), durationSec: 5, kind: "story", expiresAt: new Date(Date.now() + 17 * 3600_000).toISOString(), archived: false, createdAt: hoursAgo(7) },
    { id: "s3", title: "Saison 2025", mediaIds: media.slice(1, 3).map((m) => m.id), durationSec: 6, kind: "highlight", archived: true, createdAt: hoursAgo(2400) },
  ];

  const stats = seedStats(empty);

  const inquiries: Inquiry[] = empty ? [] : [
    { id: "q1", couple: "Ornella & Junior", phone: "+243810000001", email: "ornella.junior@example.com", contactPref: "whatsapp", venue: "Le Fleuve d’Or", weddingDate: iso(daysFrom(41)), city: "Kinshasa", guests: 320, packageName: "Premium", status: "new", unread: true, createdAt: hoursAgo(1.5), message: "Bonjour, nous nous marions au Fleuve d’Or. Êtes-vous disponibles pour le coutumier et la soirée ?" },
    { id: "q2", couple: "Christelle & Arnold", phone: "+243810000002", contactPref: "call", weddingDate: iso(daysFrom(68)), city: "Kinshasa", guests: 250, packageName: "Essentiel", status: "new", unread: true, createdAt: hoursAgo(5), message: "Pouvez-vous nous envoyer un devis pour la mairie et l’église ?" },
    { id: "q3", couple: "Bénédicte & Serge", phone: "+243810000003", email: "benedicte.serge@example.com", contactPref: "whatsapp", weddingDate: iso(daysFrom(23)), city: "Matadi", guests: 180, status: "discussing", unread: false, createdAt: hoursAgo(26), message: "Merci pour votre réponse. Le déplacement à Matadi est-il inclus ?" },
    { id: "q4", couple: "Gloria & Fabrice", email: "gloria.fabrice@example.com", contactPref: "email", venue: "Hôtel du Fleuve", weddingDate: iso(daysFrom(96)), city: "Kinshasa", guests: 400, packageName: "Prestige", status: "quote_sent", unread: false, createdAt: hoursAgo(50), message: "Nous attendons votre devis détaillé." },
    { id: "q5", couple: "Naomie & Yannick", phone: "+243810000005", contactPref: "whatsapp", venue: "Jardin de la Gombe", weddingDate: iso(daysFrom(12)), city: "Kinshasa", guests: 220, packageName: "Premium", status: "confirmed", unread: false, createdAt: hoursAgo(400), message: "Acompte versé, à très vite !" },
    { id: "q6", couple: "Esther & Joël", phone: "+243810000006", contactPref: "whatsapp", venue: "Pullman Lubumbashi", weddingDate: iso(daysFrom(33)), city: "Lubumbashi", guests: 300, packageName: "Premium", status: "confirmed", unread: false, createdAt: hoursAgo(700), message: "Billets d’avion réservés pour l’équipe." },
    { id: "q8", couple: "Rebecca & Daniel", phone: "+243810000008", email: "rebecca.daniel@example.com", contactPref: "whatsapp", venue: "Salle Okapi", weddingDate: iso(daysFrom(-9)), city: "Kinshasa", guests: 280, packageName: "Premium", status: "confirmed", unread: false, createdAt: hoursAgo(1500), message: "Merci encore, la journée était parfaite !" },
    { id: "q7", couple: "Sarah & Ben", email: "sarah.ben@example.com", contactPref: "email", lostReason: "Budget", weddingDate: iso(daysFrom(150)), city: "Kinshasa", guests: 150, status: "lost", unread: false, createdAt: hoursAgo(900), message: "Nous avons choisi un autre prestataire, merci." },
  ];

  const reviews: Review[] = empty ? [] : [
    { id: "r1", names: "Grâce & Patrick", photo: U("1465495976277-4387d4b0b4c6", 160, 160), rating: 5, weddingDate: iso(daysFrom(-125)), createdAt: hoursAgo(30), status: "published", verified: true, city: "Kinshasa", text: "Ils ont capturé chaque regard, chaque larme. Nos photos ressemblent à un magazine de mode." },
    { id: "r2", names: "Divine & Jonathan", photo: U("1606216794074-735e91aa2c92", 160, 160), rating: 5, weddingDate: iso(daysFrom(-176)), createdAt: hoursAgo(260), text: "Déplacement à Lubumbashi sans frais cachés. Teaser prêt deux jours après !", reply: "Merci pour votre confiance !", repliedAt: hoursAgo(250), status: "published", verified: true, city: "Lubumbashi" },
    { id: "r4", names: "Mireille & Hervé", photo: U("1519741497674-611481863552", 160, 160), rating: 5, weddingDate: iso(daysFrom(-240)), createdAt: hoursAgo(1300), status: "published", verified: true, city: "Kinshasa", text: "Professionnels du début à la fin. Les photos du coutumier sont nos préférées, toute la famille les a demandées.", reply: "Quel bonheur d’avoir partagé votre coutumier. Merci Mireille et Hervé !", repliedAt: hoursAgo(1290) },
    { id: "r5", names: "Prisca & Olivier", photo: "", rating: 3, weddingDate: iso(daysFrom(-300)), createdAt: hoursAgo(2000), status: "published", verified: false, city: "Matadi", text: "Belles images mais nous aurions aimé plus de photos de groupe avec la famille élargie." },
    { id: "r3", names: "Sarah & Ben", photo: U("1511285560929-80b456fea0bc", 160, 160), rating: 4, weddingDate: iso(daysFrom(-210)), createdAt: hoursAgo(700), status: "published", verified: true, city: "Kinshasa", text: "Magnifique, livraison un peu plus longue que prévu." },
  ];

  const notifications: Notification[] = empty ? [] : [
    { id: "n1", type: "new_inquiry", title: "Nouvelle demande de devis", body: "Ornella & Junior · mariage dans 41 jours", link: "/espace/demandes", read: false, createdAt: hoursAgo(1.5) },
    { id: "n2", type: "new_inquiry", title: "Nouvelle demande de devis", body: "Christelle & Arnold", link: "/espace/demandes", read: false, createdAt: hoursAgo(5) },
    { id: "n3", type: "new_review", title: "Nouvel avis 5 étoiles", body: "Grâce & Patrick vous ont laissé un avis", link: "/espace/avis", read: false, createdAt: hoursAgo(30) },
    { id: "n4", type: "tip", title: "Astuce", body: "Les profils avec 12 photos ou plus reçoivent 2× plus de demandes.", link: "/espace/galerie", read: true, createdAt: hoursAgo(80) },
  ];

  return { plan: "pro", media, albums, stories, stats, inquiries, reviews, notifications, followers: empty ? 0 : 1248, ...seedStep4(draft, inquiries, empty), ...seedStep5({ media }, empty) };
}

/* ---------------------------------------------------------
   Étape 4 : forfaits, options, promotions, conversations,
   réponses rapides, devis et disponibilités
   --------------------------------------------------------- */
export function seedStep4(draft: Draft, inquiries: Inquiry[], empty = false): Pick<EspaceData, "packages" | "options" | "promotions" | "messages" | "quickReplies" | "quotes" | "availability"> {
  const base = Number(draft.pkg.amount) || 850;
  const cur = draft.pkg.currency;
  const first: Package = {
    id: "p1", name: draft.pkg.name || "Essentiel", description: draft.pkg.description, priceMode: draft.pkg.priceMode, amount: base, currency: cur,
    duration: draft.pkg.duration || "6 h", includes: draft.pkg.includes.length ? draft.pkg.includes : ["Prestation le jour J"], excludes: draft.pkg.excludes, featured: false, visible: true,
  };
  const packages: Package[] = empty ? [first] : [
    first,
    { id: "p2", name: "Premium", description: "Photo et vidéo pour revivre chaque émotion, du coutumier à la soirée.", priceMode: "from", amount: Math.round((base * 1.9) / 50) * 50, currency: cur, duration: "10 h", includes: ["Photographe + vidéaste", "500 photos retouchées", "Film de 5 min + teaser", "Séance couple"], excludes: ["Album imprimé"], featured: true, visible: true },
    { id: "p3", name: "Prestige", description: "L’expérience complète, sur toutes vos cérémonies.", priceMode: "from", amount: Math.round((base * 3.4) / 50) * 50, currency: cur, duration: "Journée complète", includes: ["Équipe de 3", "Coutumier + civil + religieux + soirée", "Film de 15 min", "Plans drone", "Album 30×30"], excludes: [], featured: false, visible: true },
  ];
  const options: PackageOption[] = empty ? [] : [
    { id: "o1", name: "Plans drone", amount: 250, currency: "USD" },
    { id: "o2", name: "Album supplémentaire pour les parents", amount: 180, currency: "USD" },
    { id: "o3", name: "Livraison express en 72 h", amount: 150, currency: "USD" },
    { id: "o4", name: "Heure supplémentaire", amount: 90, currency: "USD" },
  ];
  const promotions: Promotion[] = empty ? [] : [
    { id: "pr1", label: "Saison sèche", kind: "seasonal", discount: "percent", value: 10, startsAt: iso(daysFrom(-10)), endsAt: iso(daysFrom(42)), packageId: "p2" },
    { id: "pr2", label: "Mariages de janvier", kind: "limited", discount: "amount", value: 200, startsAt: iso(daysFrom(75)), endsAt: iso(daysFrom(105)) },
  ];
  const msg = (inquiryId: string, sender: Message["sender"], body: string, h: number, quoteId?: string): Message => ({ id: `${inquiryId}-${Math.round(h * 10)}`, inquiryId, sender, body, createdAt: hoursAgo(h), quoteId });
  const messages: Message[] = empty ? [] : inquiries.flatMap((q) => {
    const h = (Date.now() - +new Date(q.createdAt)) / 3600_000;
    const list = [msg(q.id, "couple", q.message, h)];
    if (q.status === "discussing") list.push(msg(q.id, "vendor", "Bonjour et félicitations ! Oui, nous nous déplaçons volontiers à Matadi.", h - 4), msg(q.id, "couple", "Super ! Le déplacement est-il inclus dans le forfait Premium ?", h - 6));
    if (q.status === "quote_sent") list.push(msg(q.id, "vendor", "Avec plaisir, voici notre proposition détaillée pour votre journée.", h - 3), msg(q.id, "system", "Devis ECL-2026-0041 envoyé", h - 3.1, "qt1"));
    if (q.status === "confirmed") list.push(msg(q.id, "vendor", "C’est confirmé, nous bloquons votre date. Merci pour votre confiance !", h - 20), msg(q.id, "system", "Statut : Confirmé", h - 20.1));
    if (q.status === "lost") list.push(msg(q.id, "system", "Statut : Perdu (Budget)", h - 10));
    return list;
  });
  const quickReplies: QuickReply[] = [
    { id: "r1", title: "Remerciement", body: "Bonjour {prenoms}, merci pour votre message et félicitations pour votre mariage ! Je regarde notre disponibilité pour le {date} et je reviens vers vous très vite." },
    { id: "r2", title: "Date disponible", body: "Bonne nouvelle {prenoms} : nous sommes disponibles le {date}. Souhaitez-vous que je vous envoie un devis détaillé ?" },
    { id: "r3", title: "Date prise", body: "Merci {prenoms}. Malheureusement, le {date} est déjà réservé. Je peux vous recommander un confrère de confiance si vous le souhaitez." },
    { id: "r4", title: "Rendez-vous", body: "Avec plaisir {prenoms} ! Je vous propose un appel vidéo de 20 minutes pour parler de votre journée. Quel créneau vous arrange ?" },
  ];
  const quotes = empty ? [] : [{
    id: "qt1", inquiryId: "q4", number: "ECL-2026-0041", packageId: "p3", currency: cur, discount: 0, notes: "Acompte de 30 % à la signature.", status: "sent" as const,
    lines: [{ label: "Forfait Prestige", qty: 1, unit: packages[2].amount }, { label: "Plans drone", qty: 1, unit: 250 }],
    validUntil: iso(daysFrom(28)), sentAt: hoursAgo(47), createdAt: hoursAgo(47),
  }];
  const availability: Record<string, DayEntry> = {};
  if (!empty) {
    inquiries.forEach((q) => {
      if (q.status === "confirmed") availability[q.weddingDate] = { status: "booked", inquiryId: q.id };
      if (q.status === "quote_sent") availability[q.weddingDate] = { status: "option", inquiryId: q.id };
    });
    // réservations prises hors NDOA et congés
    [5, 19, 26, 54].forEach((n) => { const d = iso(nextSaturday(n)); availability[d] ??= { status: "booked", note: "Mariage réservé hors NDOA" }; });
    [60, 61, 62].forEach((n) => { availability[iso(daysFrom(n))] ??= { status: "blocked", note: "Congés de l’équipe" }; });
  }
  return { packages, options, promotions, messages, quickReplies, quotes, availability };
}

function nextSaturday(fromDays: number) {
  const d = daysFrom(fromDays);
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7));
  return d;
}

/* ---------------------------------------------------------
   Étape 5 : 180 jours de statistiques avec sources, liens
   d’avis, abonnement, factures, équipe et préférences
   --------------------------------------------------------- */
const SOURCE_MIX: [TrafficSource, number][] = [["recherche", 0.34], ["categorie", 0.22], ["instagram", 0.18], ["recommandations", 0.1], ["whatsapp", 0.1], ["direct", 0.06]];

export function seedStats(empty = false): DayStat[] {
  const r = rng(20261019);
  return Array.from({ length: 180 }, (_, k) => {
    const i = k - 120; // tendance montante sur les 60 derniers jours
    const d = daysFrom(k - 179);
    const weekend = [0, 5, 6].includes(d.getDay()) ? 1.35 : 1;
    const views = empty ? 0 : Math.round(Math.max(14, 38 + i * 1.1) * weekend * (0.8 + r() * 0.45));
    const sources: Partial<Record<TrafficSource, number>> = {};
    SOURCE_MIX.forEach(([s, w]) => { sources[s] = Math.round(views * w * (0.8 + r() * 0.4)); });
    return {
      day: iso(d), views,
      whatsapp: Math.round(views * (0.07 + r() * 0.04)),
      calls: Math.round(views * (0.02 + r() * 0.02)),
      inquiries: Math.round(views * (0.025 + r() * 0.02)),
      followers: empty ? 0 : Math.round(r() * 4 + Math.max(0, i) / 25),
      photoViews: Math.round(views * (2.2 + r())),
      sources,
    };
  });
}

export const DEFAULT_PREFS: NotifPrefs = {
  new_inquiry: { in_app: true, email: true, sms: false, whatsapp: true },
  new_message: { in_app: true, email: false, sms: false, whatsapp: true },
  new_review: { in_app: true, email: true, sms: false, whatsapp: false },
  reminder: { in_app: true, email: true, sms: true, whatsapp: false },
  billing: { in_app: true, email: true, sms: true, whatsapp: false },
  tips: { in_app: true, email: false, sms: false, whatsapp: false },
};

export function seedStep5(src: Pick<EspaceData, "media">, empty = false): Pick<EspaceData, "reviewRequests" | "subscription" | "invoices" | "members" | "notifPrefs" | "settings" | "topPhotos" | "benchmark"> {
  const r = rng(5);
  const reviewRequests: ReviewRequest[] = empty ? [] : [
    { token: "demo-rv-grace", couple: "Grâce & Patrick", channel: "whatsapp", sentTo: "+243 81 000 00 11", createdAt: hoursAgo(80), expiresAt: daysFrom(57).toISOString(), usedAt: hoursAgo(30) },
    { token: "demo-rv-lydie", couple: "Lydie & Marc", channel: "email", sentTo: "lydie.marc@example.com", createdAt: hoursAgo(240), expiresAt: daysFrom(50).toISOString() },
    { token: "demo-rv-ruth", couple: "Ruth & Samuel", channel: "lien", createdAt: hoursAgo(1700), expiresAt: daysFrom(-11).toISOString() },
  ];
  const photos = src.media.filter((m) => m.kind === "photo" && m.status === "ready");
  const topPhotos: TopPhoto[] = empty ? [] : photos
    .map((m, i) => ({ mediaId: m.id, views: Math.round((1800 - i * 110) * (0.7 + r() * 0.6)), contacts: Math.round((60 - i * 4) * (0.6 + r() * 0.8)) }))
    .sort((a, b) => b.views - a.views).slice(0, 8);
  const benchmark: Benchmark = { views: 1450, ctr: 0.085, responseHours: 9, conversion: 0.18, rating: 4.5, vendors: 42 };
  const at = (n: number) => iso(daysFrom(n));
  const invoices: Invoice[] = empty ? [] : [0, 1, 2].map((k) => ({
    id: `inv${k}`, number: `FAC-2026-${String(318 - k * 41).padStart(6, "0")}`, plan: "pro" as const, months: 1,
    amount: 19, currency: "USD" as const, method: k === 1 ? ("orange_money" as const) : ("mpesa" as const), status: k === 1 ? ("failed" as const) : ("paid" as const),
    periodStart: at(-18 - k * 30), periodEnd: at(12 - k * 30), paidAt: k === 1 ? undefined : daysFrom(-18 - k * 30).toISOString(), createdAt: daysFrom(-18 - k * 30).toISOString(),
  }));
  const members: Member[] = [
    { id: "m-you", role: "owner", status: "active", email: "", you: true, invitedAt: hoursAgo(4000), lastActiveAt: new Date().toISOString() },
    ...(empty ? [] : [
      { id: "m2", name: "Patrick Ilunga", email: "patrick.ilunga@example.com", role: "manager" as const, status: "active" as const, invitedAt: hoursAgo(2200), lastActiveAt: hoursAgo(3) },
      { id: "m3", email: "sandra.k@example.com", role: "editor" as const, status: "invited" as const, invitedAt: hoursAgo(50) },
    ]),
  ];
  const sessions: DeviceSession[] = [
    { id: "sess-current", device: "Ce navigateur", place: "Kinshasa, RDC", lastActiveAt: new Date().toISOString(), current: true },
    ...(empty ? [] : [
      { id: "sess-2", device: "iPhone · Safari", place: "Kinshasa, RDC", lastActiveAt: hoursAgo(2) },
      { id: "sess-3", device: "Android · Chrome", place: "Lubumbashi, RDC", lastActiveAt: hoursAgo(150) },
    ]),
  ];
  return {
    reviewRequests, topPhotos, benchmark, invoices, members,
    subscription: empty
      ? { plan: "pro", status: "trialing", currency: "USD", periodEnd: at(14), cancelAtPeriodEnd: false }
      : { plan: "pro", status: "active", currency: "USD", periodEnd: at(12), cancelAtPeriodEnd: false, method: "mpesa", account: "•••• 45 67" },
    notifPrefs: DEFAULT_PREFS,
    settings: { locale: "fr", displayCurrency: "USD", twoFactor: false, sessions, paused: false },
  };
}
