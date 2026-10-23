"use client";

import { DEMO, DEMO_OTP } from "@/lib/config";

/** supabase-js (≈ 260 Ko) n’est chargé qu’au premier appel : les pages de connexion et d’inscription s’affichent plus vite. */
const loadSupabase = async () => (DEMO ? null : (await import("@/lib/supabase/client")).getSupabase());

/* =========================================================
   Authentification — même interface en mode démo et avec Supabase
   ========================================================= */
export type Method = "email" | "phone";
export type Channel = "sms" | "whatsapp";
export type SessionUser = { id: string; fullName: string; email?: string; phone?: string };
export type Pending = { method: Method; email?: string; phone?: string; fullName: string; channel: Channel; purpose: "signup" | "login"; /** page après vérification (compte couple : /mon-compte) */ next?: string };

const K_USER = "eclat.demo.user";
const K_PENDING = "eclat.auth.pending";

const read = <T,>(k: string): T | null => {
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : null; } catch { return null; }
};
const write = (k: string, v: unknown) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify(v));
  } catch { /* stockage indisponible */ }
};

export const getPending = () => read<Pending>(K_PENDING);

/** Messages d’erreur Supabase traduits pour l’utilisateur */
function fr(message: string) {
  const m = message.toLowerCase();
  if (m.includes("already registered") || m.includes("already exists")) return "Un compte existe déjà avec cet identifiant. Connectez-vous plutôt.";
  if (m.includes("invalid login")) return "Identifiant ou mot de passe incorrect.";
  if (m.includes("expired") || (m.includes("invalid") && m.includes("otp"))) return "Ce code est incorrect ou a expiré.";
  if (m.includes("rate limit") || m.includes("too many")) return "Trop de tentatives. Patientez une minute avant de réessayer.";
  if (m.includes("not authorized") || m.includes("sending confirmation"))
    return "L’e-mail de confirmation n’a pas pu être envoyé à cette adresse. Réessayez plus tard ou inscrivez-vous par téléphone.";
  if (m.includes("password")) return "Le mot de passe ne respecte pas les règles demandées.";
  return "Une erreur est survenue. Vérifiez votre connexion et réessayez.";
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Lien de confirmation de l’e-mail : retour sur /auth/callback, puis création de la vitrine */
const emailRedirectTo = (next = "/onboarding/activite") => `${location.origin}/auth/callback?source=email&suite=${encodeURIComponent(next)}`;

export async function signUp(input: { method: Method; email?: string; phone?: string; password: string; fullName: string; channel: Channel; next?: string }) {
  const pending: Pending = { method: input.method, email: input.email, phone: input.phone, fullName: input.fullName, channel: input.channel, purpose: "signup", next: input.next };
  const sb = await loadSupabase();
  if (!sb) {
    await wait(700);
    write(K_PENDING, pending);
    return { ok: true as const };
  }
  const { error } =
    input.method === "email"
      ? await sb.auth.signUp({ email: input.email!, password: input.password, options: { data: { full_name: input.fullName }, emailRedirectTo: emailRedirectTo(input.next) } })
      : await sb.auth.signUp({ phone: input.phone!, password: input.password, options: { data: { full_name: input.fullName }, channel: input.channel } });
  if (error) return { ok: false as const, error: fr(error.message) };
  write(K_PENDING, pending);
  return { ok: true as const };
}

export async function signIn(input: { identifier: string; password: string }) {
  const isEmail = input.identifier.includes("@");
  const sb = await loadSupabase();
  if (!sb) {
    await wait(600);
    const u = read<SessionUser>(K_USER);
    const match = u && (isEmail ? u.email === input.identifier.toLowerCase() : u.phone === input.identifier);
    if (!match) return { ok: false as const, error: "Aucun compte démo avec cet identifiant. Créez d’abord un compte." };
    return { ok: true as const };
  }
  const { error } = isEmail
    ? await sb.auth.signInWithPassword({ email: input.identifier, password: input.password })
    : await sb.auth.signInWithPassword({ phone: input.identifier, password: input.password });
  return error ? { ok: false as const, error: fr(error.message) } : { ok: true as const };
}

export async function verifyOtp(code: string) {
  const p = getPending();
  if (!p) return { ok: false as const, error: "Session expirée. Recommencez l’inscription." };
  const sb = await loadSupabase();
  if (!sb) {
    await wait(600);
    if (code !== DEMO_OTP) return { ok: false as const, error: "Ce code est incorrect ou a expiré." };
    write(K_USER, { id: "demo-user", fullName: p.fullName, email: p.email?.toLowerCase(), phone: p.phone } satisfies SessionUser);
    write(K_PENDING, null);
    return { ok: true as const };
  }
  const { error } =
    p.method === "email"
      ? await sb.auth.verifyOtp({ email: p.email!, token: code, type: "signup" })
      : await sb.auth.verifyOtp({ phone: p.phone!, token: code, type: "sms" });
  if (error) return { ok: false as const, error: fr(error.message) };
  write(K_PENDING, null);
  return { ok: true as const };
}

export async function resendOtp(channel: Channel) {
  const p = getPending();
  if (!p) return { ok: false as const, error: "Session expirée." };
  write(K_PENDING, { ...p, channel });
  const sb = await loadSupabase();
  if (!sb) { await wait(500); return { ok: true as const }; }
  const { error } =
    p.method === "email"
      ? await sb.auth.resend({ type: "signup", email: p.email!, options: { emailRedirectTo: emailRedirectTo(p.next) } })
      : await sb.auth.resend({ type: "sms", phone: p.phone!, options: { channel } as never });
  return error ? { ok: false as const, error: fr(error.message) } : { ok: true as const };
}

/** Vrai si une session existe (ex. : e-mail confirmé via le lien dans un autre onglet) ; efface l’inscription en attente */
export async function confirmedBySession() {
  const sb = await loadSupabase();
  if (!sb) return false;
  const { data } = await sb.auth.getUser();
  if (data.user?.email_confirmed_at) { write(K_PENDING, null); return true; }
  return false;
}

export async function signInWithGoogle(next = "/onboarding") {
  const sb = await loadSupabase();
  if (!sb) {
    write(K_USER, { id: "demo-user", fullName: "Compte Google démo", email: "demo@gmail.com" } satisfies SessionUser);
    return { ok: true as const, redirectTo: next };
  }
  const { error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${location.origin}/auth/callback?suite=${encodeURIComponent(next)}` },
  });
  return error ? { ok: false as const, error: fr(error.message) } : { ok: true as const };
}

export async function requestPasswordReset(identifier: string) {
  const sb = await loadSupabase();
  if (!sb) { await wait(600); return { ok: true as const }; }
  const { error } = identifier.includes("@")
    ? await sb.auth.resetPasswordForEmail(identifier, { redirectTo: `${location.origin}/connexion` })
    : await sb.auth.signInWithOtp({ phone: identifier });
  return error ? { ok: false as const, error: fr(error.message) } : { ok: true as const };
}

export async function getUser(): Promise<SessionUser | null> {
  const sb = await loadSupabase();
  if (!sb) return read<SessionUser>(K_USER);
  const { data } = await sb.auth.getUser();
  if (!data.user) return null;
  return { id: data.user.id, fullName: (data.user.user_metadata?.full_name as string) ?? "", email: data.user.email, phone: data.user.phone };
}

export async function signOut() {
  const sb = await loadSupabase();
  if (!sb) { write(K_USER, null); return; }
  await sb.auth.signOut();
}

/* ---------- Paramètres du compte (étape 5) ---------- */

/** Nom, e-mail, téléphone. Un changement d’e-mail est confirmé par un lien envoyé à la nouvelle adresse. */
export async function updateAccount(next: { fullName: string; email?: string; phone?: string }) {
  const sb = await loadSupabase();
  if (!sb) {
    await wait(500);
    const u = read<SessionUser>(K_USER);
    if (!u) return { ok: false as const, error: "Session expirée." };
    const user: SessionUser = { ...u, fullName: next.fullName, email: next.email?.toLowerCase() || undefined, phone: next.phone || undefined };
    write(K_USER, user);
    return { ok: true as const, user, emailPending: false };
  }
  const { data: cur } = await sb.auth.getUser();
  const emailChanged = !!next.email && next.email.toLowerCase() !== cur.user?.email;
  const { data, error } = await sb.auth.updateUser({ ...(emailChanged ? { email: next.email } : {}), data: { full_name: next.fullName } });
  if (error) return { ok: false as const, error: fr(error.message) };
  if (data.user) await sb.from("profiles").update({ full_name: next.fullName, phone: next.phone ?? null }).eq("id", data.user.id);
  return { ok: true as const, user: { id: data.user!.id, fullName: next.fullName, email: data.user!.email, phone: next.phone }, emailPending: emailChanged };
}

/** Vérifie l’ancien mot de passe avant d’enregistrer le nouveau */
export async function changePassword(identifier: string, current: string, next: string) {
  const sb = await loadSupabase();
  if (!sb) { await wait(700); return current.length >= 1 ? { ok: true as const } : { ok: false as const, error: "Mot de passe actuel incorrect." }; }
  const check = identifier.includes("@")
    ? await sb.auth.signInWithPassword({ email: identifier, password: current })
    : await sb.auth.signInWithPassword({ phone: identifier, password: current });
  if (check.error) return { ok: false as const, error: "Mot de passe actuel incorrect." };
  const { error } = await sb.auth.updateUser({ password: next });
  return error ? { ok: false as const, error: fr(error.message) } : { ok: true as const };
}

/** Déconnecte tous les autres appareils (révoque leurs jetons de rafraîchissement) */
export async function signOutOthers() {
  const sb = await loadSupabase();
  if (!sb) { await wait(500); return { ok: true as const }; }
  const { error } = await sb.auth.signOut({ scope: "others" });
  return error ? { ok: false as const, error: fr(error.message) } : { ok: true as const };
}

/** Double authentification par SMS : envoi du code puis vérification */
export async function startTwoFactor(phone: string) {
  const sb = await loadSupabase();
  if (!sb) { await wait(600); return { ok: true as const, factorId: "demo", challengeId: "demo" }; }
  const enroll = await sb.auth.mfa.enroll({ factorType: "phone", phone });
  if (enroll.error) return { ok: false as const, error: fr(enroll.error.message) };
  const ch = await sb.auth.mfa.challenge({ factorId: enroll.data.id });
  if (ch.error) return { ok: false as const, error: fr(ch.error.message) };
  return { ok: true as const, factorId: enroll.data.id, challengeId: ch.data.id };
}
export async function confirmTwoFactor(factorId: string, challengeId: string, code: string) {
  const sb = await loadSupabase();
  if (!sb) { await wait(500); return code === DEMO_OTP ? { ok: true as const } : { ok: false as const, error: "Ce code est incorrect ou a expiré." }; }
  const { error } = await sb.auth.mfa.verify({ factorId, challengeId, code });
  return error ? { ok: false as const, error: fr(error.message) } : { ok: true as const };
}
export async function disableTwoFactor() {
  const sb = await loadSupabase();
  if (!sb) { await wait(400); return { ok: true as const }; }
  const { data } = await sb.auth.mfa.listFactors();
  for (const f of data?.phone ?? []) await sb.auth.mfa.unenroll({ factorId: f.id });
  return { ok: true as const };
}
