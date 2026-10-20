/**
 * Destination après connexion (`?suite=`) : uniquement un chemin interne.
 * Refuse « //site.com » et « /\site.com », interprétés par les navigateurs comme une autre origine
 * (redirection ouverte exploitable pour l’hameçonnage).
 */
export function safeNext(value: string | null | undefined, fallback = "/onboarding") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
