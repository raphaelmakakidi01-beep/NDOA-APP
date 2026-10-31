"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const stilled = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Fine barre dorée pendant un changement de page, et défilement doux vers les ancres de la page en cours.
 * Elle n'apparaît qu'après 120 ms : une page déjà préchargée s'affiche sans flash.
 */
export function RouteProgress() {
  const pathname = usePathname();
  const bar = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
    const finish = () => {
      clear();
      if (!bar.current?.classList.contains("run")) return;
      bar.current.classList.replace("run", "end");
      timers.current.push(setTimeout(() => bar.current?.classList.remove("end"), 320));
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element).closest?.("a");
      if (!a || !a.href || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname) {
        const target = url.hash && document.getElementById(decodeURIComponent(url.hash.slice(1)));
        if (!target) return;
        // En capture, avant le routeur : le saut instantané vers l'ancre est remplacé par un défilement doux
        e.preventDefault();
        e.stopPropagation();
        history.pushState(history.state, "", url.hash);
        const behavior = stilled() ? "auto" : "smooth";
        target.scrollIntoView({ behavior });
        // Les sections encore non rendues (content-visibility) décalent l'arrivée : on recale une fois
        timers.current.push(setTimeout(() => target.scrollIntoView({ behavior }), 700));
        return;
      }
      clear();
      timers.current.push(setTimeout(() => {
        bar.current?.classList.remove("end");
        bar.current?.classList.add("run");
      }, 120));
      timers.current.push(setTimeout(finish, 10000));
    };
    document.addEventListener("click", onClick, true);
    return () => { document.removeEventListener("click", onClick, true); clear(); };
  }, []);

  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (!bar.current?.classList.contains("run")) return;
    bar.current.classList.replace("run", "end");
    timers.current.push(setTimeout(() => bar.current?.classList.remove("end"), 320));
  }, [pathname]);

  return <div ref={bar} className="route-bar" aria-hidden="true" />;
}

const CATEGORY = "#categories .cat";
const REVEAL = [".section-head", ".home-soon .container", ".budget-teaser .container", "#categories .cat", "#recommandations .feature", "#recommandations .pick", "#feed .card", ".step", ".counters", ".cta-actions"].map((s) => `.mk main ${s}`).join(",");

/**
 * Apparition au défilement sur l'accueil, avec l'API Web Animations : aucune classe n'est ajoutée au HTML
 * (il n'est peut-être pas encore hydraté), et les effets de survol reprennent la main à la fin de l'animation.
 * Seuls les éléments encore sous l'écran sont concernés ; avec « réduire les animations », tout reste visible.
 */
export function ScrollReveal() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname !== "/" || stilled() || !("IntersectionObserver" in window)) return;
    const anims = new Map<Element, Animation[]>();
    const io = new IntersectionObserver((entries) => {
      entries.filter((en) => en.isIntersecting).forEach((en, i) => {
        io.unobserve(en.target);
        const delay = Math.min(i, 5) * (!compact && en.target.matches(CATEGORY) ? 110 : 60);
        anims.get(en.target)?.forEach((a) => { a.effect?.updateTiming({ delay }); a.play(); });
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    const timing = { easing: "cubic-bezier(.22,1,.36,1)", fill: "backwards" } as const;
    // Téléphone : effets plus courts, et rien sur le carrousel du feed dont les cartes arrivent au glissement
    const compact = matchMedia("(max-width: 699px)").matches;
    document.querySelectorAll(REVEAL).forEach((el) => {
      if (el.getBoundingClientRect().top <= innerHeight * 0.9 || (compact && el.matches("#feed .card"))) return;
      // Les catégories entrent plus franchement : la carte monte pendant que sa photo se recadre
      const img = !compact && el.matches(CATEGORY) ? el.querySelector("img") : null;
      const list = img
        ? [
            el.animate([{ opacity: 0, transform: "translateY(56px) scale(.96)" }, { opacity: 1, transform: "none" }], { ...timing, duration: 1000 }),
            img.animate([{ transform: "scale(1.18)" }, { transform: "none" }], { ...timing, duration: 1400 }),
          ]
        : [el.animate([{ opacity: 0, transform: "translateY(18px)" }, { opacity: 1, transform: "none" }], { ...timing, duration: compact ? 450 : 700 })];
      list.forEach((a) => a.pause());
      anims.set(el, list);
      io.observe(el);
    });
    return () => { io.disconnect(); anims.forEach((list) => list.forEach((a) => a.cancel())); };
  }, [pathname]);
  return null;
}
