"use client";

import confetti from "canvas-confetti";

/** Confettis dorés discrets, coupés si l’utilisateur réduit les animations */
export function goldConfetti() {
  if (typeof window === "undefined" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const colors = ["#C4975A", "#E6C694", "#8B4026", "#F5F0E8", "#E8A2B4"];
  const base = { colors, ticks: 220, gravity: 0.9, scalar: 0.9, disableForReducedMotion: true } as const;
  confetti({ ...base, particleCount: 70, spread: 70, startVelocity: 42, origin: { x: 0.5, y: 0.55 } });
  setTimeout(() => {
    confetti({ ...base, particleCount: 40, angle: 60, spread: 55, origin: { x: 0, y: 0.7 } });
    confetti({ ...base, particleCount: 40, angle: 120, spread: 55, origin: { x: 1, y: 0.7 } });
  }, 220);
}
