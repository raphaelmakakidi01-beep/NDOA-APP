"use client";

/*
 * Catégories et villes gérées depuis l'admin (tables `categories` et `cities` : actives, triées par `sort`).
 * Mode démo, chargement ou erreur : catalogue en dur de catalog.ts. Les textes d'aide (`hint`) et visuels
 * par défaut restent ceux de catalog.ts pour les catégories connues.
 */
import { useEffect, useSyncExternalStore } from "react";
import { CATEGORIES, CITIES, U } from "@/lib/onboarding/catalog";
import { getSupabase } from "@/lib/supabase/client";

export type CatalogCategory = { slug: string; name: string; hint?: string; imageUrl: string };
export type Catalog = { categories: CatalogCategory[]; cities: string[]; categoryName: (slug: string) => string };

const build = (categories: CatalogCategory[], cities: string[]): Catalog => ({
  categories, cities,
  categoryName: (slug) => categories.find((c) => c.slug === slug)?.name ?? CATEGORIES.find((c) => c.slug === slug)?.name ?? slug,
});
const FALLBACK = build(CATEGORIES.map((c) => ({ slug: c.slug, name: c.name, hint: c.hint, imageUrl: U(c.img, 500) })), CITIES);

let state = FALLBACK;
let loadedAt = 0;
let pending: Promise<void> | null = null;
const listeners = new Set<() => void>();
const MAX_AGE = 30_000; // un changement fait dans l'admin apparaît au prochain écran ouvert

async function load() {
  const sb = getSupabase();
  if (!sb) return;
  const [cats, cities] = await Promise.all([
    sb.from("categories").select("slug, name, image_path").eq("is_active", true).order("sort").order("name"),
    sb.from("cities").select("name").eq("is_active", true).order("sort").order("name"),
  ]);
  loadedAt = Date.now();
  if (cats.error || cities.error) return;
  const categories = (cats.data ?? []).map((c) => {
    const known = CATEGORIES.find((k) => k.slug === c.slug);
    const imageUrl = c.image_path ? sb.storage.from("site-media").getPublicUrl(c.image_path).data.publicUrl : U(known?.img ?? CATEGORIES[10].img, 500);
    return { slug: c.slug as string, name: c.name as string, hint: known?.hint, imageUrl };
  });
  const names = (cities.data ?? []).map((c) => c.name as string);
  state = build(categories.length ? categories : FALLBACK.categories, names.length ? names : FALLBACK.cities);
  listeners.forEach((l) => l());
}

function refresh() {
  if (pending || Date.now() - loadedAt < MAX_AGE) return;
  pending = load().catch(() => { loadedAt = Date.now(); }).finally(() => { pending = null; });
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** Catalogue courant ; se met à jour dès que la base répond */
export function useCatalog(): Catalog {
  useEffect(refresh, []);
  return useSyncExternalStore(subscribe, () => state, () => FALLBACK);
}

/** Ajoute la valeur actuelle si elle n'est plus proposée (ville désactivée entre-temps) */
export const withCurrent = (list: string[], current?: string) => (current && !list.includes(current) ? [current, ...list] : list);
