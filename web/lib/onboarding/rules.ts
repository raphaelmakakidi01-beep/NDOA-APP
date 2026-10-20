import "@/lib/zod-config";
import { z } from "zod";
import { phoneValid } from "@/lib/validation";
import { MIN_PHOTOS, type Draft, type StepKey } from "./types";

/* =========================================================
   Validation par étape + score de complétude
   (mêmes pondérations que la fonction SQL vendor_completeness)
   ========================================================= */

const optionalUrl = z.union([z.literal(""), z.url({ message: "Lien invalide (commencez par https://)." })]);
const handle = z.string().regex(/^@?[A-Za-z0-9._]{0,30}$/, "Identifiant invalide (lettres, chiffres, point, tiret bas).");

export const stepSchemas = {
  activite: z.object({ categories: z.array(z.string()).min(1, "Choisissez au moins une activité.") }),
  entreprise: z.object({
    name: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères.").max(80, "80 caractères maximum."),
    slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Adresse invalide : lettres minuscules, chiffres et tirets."),
    tagline: z.string().max(120, "120 caractères maximum."),
    bio: z.string().max(3000, "3 000 caractères maximum."),
    city: z.string().min(1, "Choisissez votre ville."),
    zones: z.array(z.string()).min(1, "Ajoutez au moins une zone d’intervention."),
    languages: z.array(z.string()).min(1, "Choisissez au moins une langue."),
  }),
  photos: z.object({
    cover: z.object({ status: z.literal("ready") }, { error: "Ajoutez une photo de couverture." }),
    photos: z.array(z.object({ status: z.string() })).refine((p) => p.filter((x) => x.status === "ready").length >= MIN_PHOTOS, `Ajoutez au moins ${MIN_PHOTOS} photos.`),
  }),
  tarif: z.object({
    name: z.string().trim().min(2, "Donnez un nom à votre forfait.").max(40, "40 caractères maximum."),
    amount: z.string().regex(/^\d+$/, "Indiquez un prix en chiffres, sans espace.").refine((v) => Number(v) > 0, "Le prix doit être supérieur à 0."),
    includes: z.array(z.string()).min(1, "Ajoutez au moins un élément inclus."),
    description: z.string().max(400, "400 caractères maximum."),
  }),
  contacts: z
    .object({
      country: z.string(),
      phone: z.string(),
      whatsappSame: z.boolean(),
      whatsapp: z.string(),
      email: z.union([z.literal(""), z.email({ message: "Adresse e-mail invalide." })]),
      instagram: handle,
      tiktok: handle,
      facebook: z.string().max(100),
      youtube: z.string().max(100),
      website: optionalUrl,
    })
    .superRefine((v, ctx) => {
      if (!phoneValid(v.country, v.phone)) ctx.addIssue({ code: "custom", path: ["phone"], message: "Numéro invalide. Exemple : 81 234 5678." });
      if (!v.whatsappSame && !phoneValid(v.country, v.whatsapp)) ctx.addIssue({ code: "custom", path: ["whatsapp"], message: "Numéro WhatsApp invalide." });
    }),
} as const;

export function validateStep(step: StepKey, d: Draft) {
  switch (step) {
    case "activite": return stepSchemas.activite.safeParse(d);
    case "entreprise": return stepSchemas.entreprise.safeParse(d);
    case "photos": return stepSchemas.photos.safeParse(d);
    case "tarif": return stepSchemas.tarif.safeParse(d.pkg);
    case "contacts": return stepSchemas.contacts.safeParse(d.contacts);
    case "apercu": return { success: true as const };
  }
}

export type Tip = { label: string; gain: number; step: StepKey; done: boolean };

export function completeness(d: Draft) {
  const ready = d.photos.filter((p) => p.status === "ready").length;
  const hasSocial = [d.contacts.instagram, d.contacts.tiktok, d.contacts.facebook, d.contacts.youtube, d.contacts.website].some(Boolean);
  const tips: Tip[] = [
    { label: "Choisir votre activité", gain: 5, step: "activite", done: d.categories.length > 0 },
    { label: "Ajouter une photo de profil", gain: 10, step: "entreprise", done: d.avatar?.status === "ready" },
    { label: "Écrire une bio d’au moins 200 caractères", gain: 15, step: "entreprise", done: d.bio.trim().length >= 200 },
    { label: "Préciser vos zones d’intervention", gain: 5, step: "entreprise", done: d.zones.length > 0 },
    { label: "Ajouter une photo de couverture", gain: 10, step: "photos", done: d.cover?.status === "ready" },
    { label: `Publier 12 réalisations (${Math.min(ready, 12)}/12)`, gain: 20, step: "photos", done: ready >= 12 },
    { label: "Créer un premier forfait", gain: 15, step: "tarif", done: d.done.tarif === true },
    { label: "Ajouter un numéro de contact", gain: 10, step: "contacts", done: !!d.contacts.phone && d.done.contacts === true },
    { label: "Lier un réseau social", gain: 5, step: "contacts", done: hasSocial },
  ];
  const photoPoints = Math.min(20, Math.floor((ready * 20) / 12));
  const score = tips.reduce((s, t) => {
    if (t.step === "photos" && t.gain === 20) return s + photoPoints;
    return s + (t.done ? t.gain : 0);
  }, 0);
  // 5 points restants : publier une story (disponible après la publication)
  return { score: Math.min(100, score), max: 95, tips };
}

export function publishChecklist(d: Draft) {
  const ready = d.photos.filter((p) => p.status === "ready").length;
  return [
    { label: "Au moins une activité", ok: d.categories.length > 0, step: "activite" as StepKey },
    { label: "Nom, ville et zones", ok: d.done.entreprise === true, step: "entreprise" as StepKey },
    { label: `Couverture + ${MIN_PHOTOS} photos (${ready}/${MIN_PHOTOS})`, ok: d.cover?.status === "ready" && ready >= MIN_PHOTOS, step: "photos" as StepKey },
    { label: "Un forfait", ok: d.done.tarif === true, step: "tarif" as StepKey },
    { label: "Un numéro de contact", ok: d.done.contacts === true, step: "contacts" as StepKey },
  ];
}
