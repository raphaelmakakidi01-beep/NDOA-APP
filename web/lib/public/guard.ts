import "server-only";
import type { NextRequest } from "next/server";

/** Adresse IP du visiteur (derrière le proxy Vercel) */
export const clientIp = (req: NextRequest) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "inconnue";

/**
 * Limite d'envois par IP, en mémoire de l'instance : un filet en plus des limites tenues par la base
 * (submit_inquiry : 3 demandes / 24 h par contact et par prestataire, 20 / h par prestataire).
 */
const hits = new Map<string, number[]>();
export function rateLimited(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= max) { hits.set(key, list); return true; }
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  return false;
}

/**
 * Vérification Cloudflare Turnstile. Sans TURNSTILE_SECRET_KEY (développement local), la vérification est ignorée ;
 * en production, la clé est exigée au build (voir next.config.ts).
 */
export async function verifyTurnstile(token: unknown, ip: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return process.env.NODE_ENV !== "production";
  if (typeof token !== "string" || !token) return false;
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(8000),
    });
    const j = (await r.json()) as { success?: boolean };
    return !!j.success;
  } catch {
    return false;
  }
}
