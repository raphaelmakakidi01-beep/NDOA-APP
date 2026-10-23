"use client";

/*
 * Compte couple facultatif : favoris et prestataires suivis (tables favorites et followers, RLS « soi-même »).
 * Sans compte, un clic sur ♥ ou « Suivre » renvoie vers la connexion puis revient sur la page.
 * Mode démo (local) : tout reste dans ce navigateur.
 */
import { useEffect, useSyncExternalStore } from "react";
import { DEMO } from "@/lib/config";
import { getSupabase } from "@/lib/supabase/client";

type State = { ready: boolean; userId: string | null; favorites: Set<string>; follows: Set<string> };
let state: State = { ready: false, userId: null, favorites: new Set(), follows: new Set() };
const SERVER: State = state;
const listeners = new Set<() => void>();
const set = (next: Partial<State>) => { state = { ...state, ...next }; listeners.forEach((l) => l()); };
const K = "ndoa.couple.demo";
let loading: Promise<void> | null = null;

async function load() {
  if (DEMO) {
    let saved: { favorites?: string[]; follows?: string[] } = {};
    try { saved = JSON.parse(localStorage.getItem(K) ?? "{}"); } catch { /* stockage indisponible */ }
    return set({ ready: true, userId: "demo", favorites: new Set(saved.favorites), follows: new Set(saved.follows) });
  }
  const sb = getSupabase()!;
  const { data } = await sb.auth.getUser();
  if (!data.user) return set({ ready: true, userId: null });
  const [fav, fol] = await Promise.all([
    sb.from("favorites").select("vendor_id").eq("user_id", data.user.id),
    sb.from("followers").select("vendor_id").eq("user_id", data.user.id),
  ]);
  set({ ready: true, userId: data.user.id,
    favorites: new Set((fav.data ?? []).map((r) => r.vendor_id as string)), follows: new Set((fol.data ?? []).map((r) => r.vendor_id as string)) });
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export function useCouple() {
  useEffect(() => { loading ??= load().catch(() => set({ ready: true })); }, []);
  return useSyncExternalStore(subscribe, () => state, () => SERVER);
}

/** Ajoute ou retire un favori / un suivi. Renvoie false si une connexion est nécessaire. */
export async function toggle(kind: "favorites" | "follows", vendorId: string): Promise<boolean> {
  if (!state.userId) {
    location.href = `/connexion?suite=${encodeURIComponent(location.pathname + location.search)}&compte=couple`;
    return false;
  }
  const on = !state[kind].has(vendorId);
  const next = new Set(state[kind]);
  if (on) next.add(vendorId); else next.delete(vendorId);
  set({ [kind]: next });
  if (DEMO) {
    try { localStorage.setItem(K, JSON.stringify({ favorites: [...state.favorites], follows: [...state.follows] })); } catch { /* stockage indisponible */ }
    return true;
  }
  const table = kind === "favorites" ? "favorites" : "followers";
  const sb = getSupabase()!;
  const { error } = on
    ? await sb.from(table).insert({ user_id: state.userId, vendor_id: vendorId })
    : await sb.from(table).delete().eq("user_id", state.userId).eq("vendor_id", vendorId);
  if (error) { // retour arrière si la base refuse
    const back = new Set(state[kind]);
    if (on) back.delete(vendorId); else back.add(vendorId);
    set({ [kind]: back });
  }
  return !error;
}
