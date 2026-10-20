"use client";

/* Données de démonstration de l'espace admin (mode sans Supabase) — en mémoire, réinitialisées au rechargement */
import { CATEGORIES, U } from "@/lib/onboarding/catalog";
import type { AdminVendorDetail, AuditEntry, Dashboard, PlanId, VendorStatus } from "./types";

let seed = 42;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];
const daysAgo = (d: number, h = 10) => new Date(Date.now() - d * 86400000 - h * 3600000).toISOString();

const PHOTOS = [
  "1519741497674-611481863552", "1511285560929-80b456fea0bc", "1465495976277-4387d4b0b4c6", "1522673607200-164d1b6ce486",
  "1520854221256-17451cc331bf", "1606216794074-735e91aa2c92", "1583939003579-730e3918a45a", "1469371670807-013ccf25f16a",
  "1519225421980-715cb0215aed", "1464366400600-7168b8af9bc3", "1555244162-803834f70033", "1470225620780-dba8ba36b745",
];
const AVATARS = ["1507003211169-0a1dd7228f2d", "1494790108377-be9c29b29330", "1500648767791-00dcc994a43e", "1438761681033-6461ffad8d80", "1506794778202-cad84cf45f1d"];

const RAW: [string, string, string, VendorStatus, PlanId, number][] = [
  ["Studio Lumière Mbala", "photographe", "Kinshasa", "published", "prestige", 4.9],
  ["Kasa Films", "videaste", "Kinshasa", "published", "pro", 4.8],
  ["SkyShot Congo", "drone", "Lubumbashi", "published", "pro", 4.7],
  ["Le Fleuve d’Or", "salle", "Kinshasa", "published", "prestige", 4.6],
  ["Maison Nkosi Déco", "decorateur", "Goma", "published", "pro", 4.8],
  ["Fleurs de Matadi", "fleuriste", "Matadi", "published", "free", 4.5],
  ["Saveurs de Mama Tshala", "traiteur", "Lubumbashi", "published", "pro", 4.9],
  ["DJ Kinoir", "dj", "Kinshasa", "published", "free", 4.4],
  ["Glam by Grâce", "maquilleur", "Goma", "published", "pro", 5],
  ["Prestige Auto Kin", "voiture", "Kinshasa", "published", "free", 4.3],
  ["Ngoma Visuals", "photographe", "Goma", "pending_review", "free", 0],
  ["Élégance Events", "planner", "Lubumbashi", "pending_review", "pro", 0],
  ["Bukavu Sound System", "dj", "Bukavu", "pending_review", "free", 0],
  ["Atelier Zola Fleurs", "fleuriste", "Kinshasa", "pending_review", "free", 0],
  ["Kolwezi Prestige Cars", "voiture", "Kolwezi", "pending_review", "free", 0],
  ["Lens & Love Kisangani", "photographe", "Kisangani", "rejected", "free", 0],
  ["Salle Les Palmiers", "salle", "Boma", "suspended", "pro", 3.9],
  ["Délices du Kasaï", "traiteur", "Kananga", "draft", "free", 0],
];

const slugify = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function build(): AdminVendorDetail[] {
  seed = 42;
  return RAW.map(([name, cat, city, status, plan, rating], i) => {
    const c = CATEGORIES.find((x) => x.slug === cat)!;
    const nPhotos = status === "pending_review" && i === 13 ? 4 : 6 + Math.floor(rnd() * 8);
    const created = status === "pending_review" ? 1 + i - 10 : 20 + Math.floor(rnd() * 200);
    const media = Array.from({ length: nPhotos }, (_, k) => ({
      id: `m-${i}-${k}`, kind: "photo" as const, url: U(PHOTOS[(i + k) % PHOTOS.length], 600), isHidden: status === "suspended" && k === 0,
      hiddenReason: status === "suspended" && k === 0 ? "inapproprie" : undefined,
    }));
    return {
      id: `demo-${i + 1}`, slug: slugify(name), name, city, status, plan,
      isVerified: status === "published" && plan !== "free", isRecommended: i < 4,
      category: { slug: c.slug, name: c.name },
      rating, ratingCount: rating ? 8 + Math.floor(rnd() * 60) : 0,
      createdAt: daysAgo(created), submittedAt: status === "pending_review" ? daysAgo(created - 0.5, 4 + i) : undefined,
      publishedAt: status === "published" ? daysAgo(created - 2) : undefined,
      avatarUrl: i === 12 ? undefined : U(pick(AVATARS), 160, 160),
      coverUrl: U(c.img, 1400),
      tagline: `${c.name} à ${city} — mariages coutumiers et religieux`,
      bio: i === 13 ? "Fleuriste passionnée." : `Depuis ${2012 + (i % 9)}, ${name} accompagne les couples de ${city} avec une approche attentive et soignée. Chaque mariage est préparé avec vous lors d’un rendez-vous, pour que le grand jour vous ressemble : style, budget, timing, tout est cadré à l’avance et confirmé par écrit.`,
      phone: i === 14 ? undefined : `+24381${String(1000000 + i * 7919).slice(0, 7)}`,
      whatsapp: i === 14 ? undefined : `+24381${String(1000000 + i * 7919).slice(0, 7)}`,
      email: `${slugify(name).split("-")[0]}@exemple.cd`,
      zones: [city, "Toute la RDC"], languages: ["Français", "Lingala"], socials: { instagram: `@${slugify(name).replace(/-/g, "")}` },
      categories: [{ slug: c.slug, name: c.name, primary: true }],
      rejectionReason: status === "rejected" ? "Photos de qualité insuffisante (floues, sombres ou pixellisées)" : undefined,
      suspendedReason: status === "suspended" ? "Plusieurs signalements de fausses annonces" : undefined,
      approvedAt: status === "published" || status === "suspended" ? daysAgo(created - 1) : undefined,
      owner: { id: `u-${i}`, name: pick(["Patrick M.", "Grâce K.", "Jonathan B.", "Divine T.", "Hervé L."]), phone: `+24382${String(2000000 + i * 104729).slice(0, 7)}` },
      media,
      packages: i === 14 ? [] : [{ id: `p-${i}`, name: "Formule Essentielle", priceMode: "from", amount: 300 + i * 75, currency: "USD", isVisible: true, duration: "Journée", includes: ["Préparatifs", "Cérémonie", "Réception"] }],
      stats: { inquiries30: Math.floor(rnd() * 40), views30: 200 + Math.floor(rnd() * 3000) },
      history: [],
    } satisfies AdminVendorDetail;
  });
}

export const demo = { vendors: build(), audit: [] as (AuditEntry & { vendorId?: string })[] };

export function demoLog(action: string, vendorId: string | undefined, reason?: string) {
  const e = { id: String(Date.now() + Math.random()), action, actor: "Vous (démo)", actorRole: "admin", reason, createdAt: new Date().toISOString(), vendorId };
  demo.audit.unshift(e);
  const v = demo.vendors.find((x) => x.id === vendorId);
  v?.history?.unshift(e);
}

export function demoDashboard(days: number): Dashboard {
  seed = 7 + days;
  const series = Array.from({ length: days }, (_, i) => {
    const d = new Date(Date.now() - (days - 1 - i) * 86400000);
    const wave = 1 + 0.35 * Math.sin(i / 3);
    return {
      jour: d.toISOString().slice(0, 10),
      inscrits: Math.round((4 + rnd() * 6) * wave),
      prestataires: Math.round(rnd() * 3 * wave),
      demandes: Math.round((6 + rnd() * 10) * wave),
      visites: Math.round((180 + rnd() * 140) * wave + i * 3),
    };
  });
  const sum = (k: "inscrits" | "demandes" | "visites") => series.reduce((s, p) => s + p[k], 0);
  const pending = demo.vendors.filter((v) => v.status === "pending_review").length;
  return {
    periode_jours: days,
    inscrits: 1284,
    inscrits_periode: sum("inscrits"),
    prestataires_actifs: demo.vendors.filter((v) => v.status === "published").length,
    en_attente: pending,
    demandes_periode: sum("demandes"),
    visites_periode: sum("visites"),
    revenus_mois: { USD: 418000, CDF: 2350000 },
    alertes: { medias_signales: 3, avis_signales: 2, vitrines_signalees: 1, avis_en_attente: 4, prestataires_en_attente: pending },
    series,
  };
}
