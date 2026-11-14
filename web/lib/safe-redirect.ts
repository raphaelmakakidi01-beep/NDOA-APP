/**
 * Destination après connexion (`?suite=`) : uniquement un chemin interne.
 * Refuse « //site.com », « /\site.com » et les caractères de contrôle (tabulation, retour à la ligne) :
 * les navigateurs les suppriment, si bien que « /<tab>/site.com » devient « //site.com »,
 * une autre origine (redirection ouverte exploitable pour l’hameçonnage).
 */
export function safeNext(value: string | null | undefined, fallback = "/onboarding") {
  if (!value || value.length > 512 || !value.startsWith("/")) return fallback;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\\]/.test(value) || value.startsWith("//")) return fallback;
  try {
    const base = "https://ndoa.invalid";
    const url = new URL(value, base);
    if (url.origin !== base) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
