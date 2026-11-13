/**
 * Données propres à certains métiers, rangées dans vendors.details (texte, comme les autres détails) :
 * - salles : « coordonnees » = "latitude,longitude" (repère posé sur la carte) ;
 * - vidéastes et pilotes de drone : « liens_videos » = un lien par ligne (YouTube, Vimeo, Instagram, TikTok, Facebook).
 */

/** Métiers dont la fiche affiche la carte de localisation */
export const LOCATION_CATEGORIES = ["salle"];
/** Métiers vidéo : une seule vidéo de présentation (30 s max) en couverture, le reste en liens */
export const VIDEO_CATEGORIES = ["videaste", "drone"];
export const COVER_VIDEO_MAX_S = 30;
/** taille maximale de la vidéo de présentation (vidéastes, drone), en Mo */
export const COVER_VIDEO_MAX_MB = 100;
export const MAX_VIDEO_LINKS = 8;

export const isLocationCategory = (cat?: string | null) => !!cat && LOCATION_CATEGORIES.includes(cat);
export const isVideoCategory = (cat?: string | null) => !!cat && VIDEO_CATEGORIES.includes(cat);

/* ------------------------------------------------------------------ */
/* Localisation                                                         */
/* ------------------------------------------------------------------ */
export type LngLat = { lng: number; lat: number };

/** Centre des principales villes (point de départ du repère) */
export const CITY_CENTERS: Record<string, LngLat> = {
  Kinshasa: { lng: 15.3125, lat: -4.3217 },
  Lubumbashi: { lng: 27.4794, lat: -11.6609 },
  Goma: { lng: 29.2203, lat: -1.6585 },
  Matadi: { lng: 13.45, lat: -5.8167 },
  Bukavu: { lng: 28.8428, lat: -2.5083 },
  Kisangani: { lng: 25.1911, lat: 0.5153 },
  "Mbuji-Mayi": { lng: 23.5895, lat: -6.136 },
  Kananga: { lng: 22.4166, lat: -5.8962 },
  Kolwezi: { lng: 25.4723, lat: -10.7148 },
  Boma: { lng: 13.05, lat: -5.85 },
};
export const cityCenter = (city?: string | null): LngLat => (city && CITY_CENTERS[city]) || CITY_CENTERS.Kinshasa;

/** "lat,lng" → coordonnées, ou null si absent ou invalide */
export function parseCoords(s?: unknown): LngLat | null {
  if (typeof s !== "string" || !s.trim()) return null;
  const [a, b] = s.split(",").map((x) => Number(x.trim()));
  if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) > 90 || Math.abs(b) > 180) return null;
  return { lat: a, lng: b };
}
export const formatCoords = (p: LngLat) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
/** Itinéraire dans Google Maps (ouvre l'application sur téléphone) */
export const directionsUrl = (p: LngLat) => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;

/* ------------------------------------------------------------------ */
/* Liens vidéo                                                          */
/* ------------------------------------------------------------------ */
export type VideoLink =
  | { kind: "youtube"; url: string; id: string }
  | { kind: "vimeo"; url: string; id: string }
  | { kind: "instagram" | "tiktok" | "facebook" | "other"; url: string };

export const VIDEO_LINK_LABELS: Record<VideoLink["kind"], string> = {
  youtube: "YouTube", vimeo: "Vimeo", instagram: "Instagram", tiktok: "TikTok", facebook: "Facebook", other: "Lien",
};

/** Reconnaît un lien de vidéo ; null si ce n'est pas une adresse web */
export function parseVideoLink(raw: string): VideoLink | null {
  const v = raw.trim();
  if (!v) return null;
  let u: URL;
  try { u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`); } catch { return null; }
  if (!/\./.test(u.hostname)) return null;
  const host = u.hostname.replace(/^www\.|^m\./, "");
  const url = u.toString();
  if (host === "youtu.be") { const id = u.pathname.slice(1).split("/")[0]; if (/^[\w-]{11}$/.test(id)) return { kind: "youtube", url, id }; }
  if (host.endsWith("youtube.com")) {
    const id = u.searchParams.get("v") ?? u.pathname.match(/\/(?:shorts|embed|live)\/([\w-]{11})/)?.[1];
    if (id && /^[\w-]{11}$/.test(id)) return { kind: "youtube", url, id };
  }
  if (host.endsWith("vimeo.com")) { const id = u.pathname.match(/\/(\d{6,})/)?.[1]; if (id) return { kind: "vimeo", url, id }; }
  if (host.endsWith("instagram.com")) return { kind: "instagram", url };
  if (host.endsWith("tiktok.com")) return { kind: "tiktok", url };
  if (host.endsWith("facebook.com") || host === "fb.watch") return { kind: "facebook", url };
  return { kind: "other", url };
}
/** Texte « un lien par ligne » → liens reconnus (sans doublons, limité) */
export function parseVideoLinks(text?: unknown): VideoLink[] {
  if (typeof text !== "string") return [];
  const seen = new Set<string>();
  return text.split(/\s*\n\s*/).map(parseVideoLink).filter((l): l is VideoLink => !!l && !seen.has(l.url) && !!seen.add(l.url)).slice(0, MAX_VIDEO_LINKS);
}

/* ------------------------------------------------------------------ */
/* Réseaux sociaux (vendors.socials : identifiant ou lien)               */
/* ------------------------------------------------------------------ */
const SOCIAL_BASE: Record<string, string> = {
  instagram: "https://www.instagram.com/", tiktok: "https://www.tiktok.com/@", facebook: "https://www.facebook.com/", youtube: "https://www.youtube.com/@",
};
export const SOCIAL_LABELS: Record<string, string> = { instagram: "Instagram", tiktok: "TikTok", facebook: "Facebook", youtube: "YouTube", site: "Site web" };
/** Identifiant ou lien saisi par le prestataire → lien complet */
export function socialUrl(network: string, value: string): string | null {
  const v = value.trim().replace(/^@/, "");
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (/\.[a-z]{2,}(\/|$)/i.test(v)) return `https://${v}`;
  return SOCIAL_BASE[network] ? SOCIAL_BASE[network] + v : null;
}
