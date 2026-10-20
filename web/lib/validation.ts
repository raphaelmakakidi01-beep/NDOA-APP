import "@/lib/zod-config";
import { z } from "zod";

/* Schémas partagés client / serveur — messages en français */

export const COUNTRY_CODES = [
  { code: "+243", label: "RDC +243", digits: 9 },
  { code: "+242", label: "Congo +242", digits: 9 },
  { code: "+250", label: "Rwanda +250", digits: 9 },
  { code: "+257", label: "Burundi +257", digits: 8 },
  { code: "+33", label: "France +33", digits: 9 },
  { code: "+32", label: "Belgique +32", digits: 9 },
];

/** Normalise un numéro local en E.164 (+243812345678) */
export function toE164(country: string, local: string) {
  const digits = local.replace(/\D/g, "").replace(/^0+/, "");
  return `${country}${digits}`;
}

export function phoneValid(country: string, local: string) {
  const c = COUNTRY_CODES.find((x) => x.code === country);
  const d = local.replace(/\D/g, "").replace(/^0+/, "");
  return c ? d.length === c.digits : d.length >= 6 && d.length <= 14;
}

export const passwordRules = [
  { id: "len", label: "8 caractères minimum", test: (p: string) => p.length >= 8 },
  { id: "maj", label: "Une majuscule", test: (p: string) => /[A-Z]/.test(p) },
  { id: "num", label: "Un chiffre", test: (p: string) => /\d/.test(p) },
  { id: "sym", label: "Un caractère spécial", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export const signupSchema = z
  .object({
    // contrôles faits dans superRefine pour afficher TOUTES les erreurs d’un coup
    fullName: z.string(),
    method: z.enum(["email", "phone"]),
    email: z.string().trim().optional(),
    country: z.string(),
    phone: z.string().optional(),
    password: z.string(),
    terms: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.fullName.trim().length < 2)
      ctx.addIssue({ code: "custom", path: ["fullName"], message: "Indiquez votre nom (2 caractères minimum)." });
    if (v.method === "email" && !z.email().safeParse(v.email ?? "").success)
      ctx.addIssue({ code: "custom", path: ["email"], message: "Saisissez une adresse e-mail valide (ex. nom@domaine.com)." });
    if (v.method === "phone" && !phoneValid(v.country, v.phone ?? ""))
      ctx.addIssue({ code: "custom", path: ["phone"], message: "Numéro invalide. Exemple : 81 234 5678." });
    const failed = passwordRules.filter((r) => !r.test(v.password));
    if (failed.length) ctx.addIssue({ code: "custom", path: ["password"], message: `Mot de passe trop faible : ${failed.map((r) => r.label.toLowerCase()).join(", ")}.` });
    if (!v.terms) ctx.addIssue({ code: "custom", path: ["terms"], message: "Vous devez accepter les conditions pour continuer." });
  });

export type FieldErrors = Partial<Record<string, string>>;

/** Convertit une erreur Zod en { champ: message } (premier message par champ) */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const k = String(issue.path[0] ?? "_");
    out[k] ??= issue.message;
  }
  return out;
}
