/**
 * Mode « Bientôt disponible » : le public voit /bientot à la place de la marketplace ;
 * l'équipe NDOA (admin, modérateur) voit le site complet grâce à un laissez-passer signé
 * (cookie ndoa_apercu, 30 jours), posé par le proxy quand elle ouvre /admin, /espace ou /onboarding.
 *
 * Pour OUVRIR le site au public : mettre COMING_SOON à false (ou NDOA_LANCEMENT=ouvert sur Vercel).
 */
export const COMING_SOON =
  process.env.NDOA_LANCEMENT !== "ouvert" && (process.env.NODE_ENV === "production" || process.env.NDOA_BIENTOT === "1");

export const PREVIEW_COOKIE = "ndoa_apercu";
export const PREVIEW_DAYS = 30;

/** Pages accessibles à tous pendant le mode « Bientôt » (le reste affiche /bientot) */
const OPEN = /^\/(bientot|connexion|inscription|verification|auth|admin|espace|onboarding|api|pro|avis|mentions-legales|cgu|confidentialite)(\/|$)/;
export const isOpenDuringSoon = (path: string) => OPEN.test(path);

const enc = new TextEncoder();
const b64url = (buf: ArrayBuffer) => {
  let s = "";
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

// Clé de signature dérivée d'un secret serveur déjà présent (jamais exposé au navigateur)
async function key(): Promise<CryptoKey | null> {
  const secret = process.env.NDOA_APERCU_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return null;
  return crypto.subtle.importKey("raw", enc.encode(`ndoa-apercu-v1:${secret}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

async function sign(payload: string) {
  const k = await key();
  return k ? b64url(await crypto.subtle.sign("HMAC", k, enc.encode(payload))) : null;
}

/** Laissez-passer : « idUtilisateur.expiration.signature » */
export async function makePreviewToken(userId: string) {
  const exp = Math.floor(Date.now() / 1000) + PREVIEW_DAYS * 86400;
  const sig = await sign(`${userId}.${exp}`);
  return sig ? `${userId}.${exp}.${sig}` : null;
}

export async function isValidPreviewToken(token: string | undefined) {
  if (!token) return false;
  const [id, exp, sig] = token.split(".");
  if (!id || !exp || !sig || !/^[0-9a-f-]{36}$/.test(id) || !/^\d{10}$/.test(exp)) return false;
  if (Number(exp) < Date.now() / 1000) return false;
  const expected = await sign(`${id}.${exp}`);
  if (!expected || expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
