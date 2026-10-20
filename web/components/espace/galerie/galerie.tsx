"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { Skeleton } from "@/components/ui/bits";
import { useEspace } from "@/lib/espace/store";
import { PLANS } from "@/lib/espace/types";
import { cn, formatBytes } from "@/lib/utils";
import { AlbumsTab } from "./albums-tab";
import { MediaTab } from "./media-tab";
import { StoriesTab } from "./stories-tab";

const TABS = [
  { id: "medias", label: "Photos et vidéos" },
  { id: "albums", label: "Albums" },
  { id: "stories", label: "Stories" },
] as const;
type TabId = (typeof TABS)[number]["id"];

function Gauge({ label, used, max, display }: { label: string; used: number; max: number; display: string }) {
  const pct = max ? Math.min(100, (used / max) * 100) : 100;
  const tone = !max ? "bg-line-strong" : pct >= 90 ? "bg-danger" : pct >= 75 ? "bg-rose" : "bg-gold";
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[13px]"><span className="text-muted">{label}</span><span className="font-semibold tabular-nums">{display}</span></div>
      <div className="h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-label={label} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <motion.div className={cn("h-full rounded-full", tone)} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
      </div>
    </div>
  );
}

export function Galerie() {
  const { data, usage } = useEspace();
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const initial = (TABS.find((t) => t.id === params.get("onglet"))?.id ?? "medias") as TabId;
  const [tab, setTab] = useState<TabId>(initial);
  const [album, setAlbum] = useState<string | undefined>(params.get("album") ?? undefined);
  const plan = PLANS[data.plan];
  const storagePct = (usage.bytes / (plan.storageMb * 1024 * 1024)) * 100;

  const go = (t: TabId, albumId?: string) => {
    setTab(t);
    setAlbum(albumId);
    const q = new URLSearchParams();
    if (t !== "medias") q.set("onglet", t);
    if (albumId) q.set("album", albumId);
    router.replace(`${path}${q.size ? `?${q}` : ""}`, { scroll: false });
  };

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="font-display text-[2.1rem] leading-tight sm:text-5xl"><em className="text-gold-ink">Galerie</em></h1>
          <p className="mt-1 text-muted">Vos réalisations, albums et stories. L’ordre choisi ici est celui de votre vitrine.</p>
        </div>
        <section aria-label={`Stockage de l’offre ${plan.name}`} className="grid w-full gap-3 rounded-2xl border border-line bg-surface p-4 sm:w-auto sm:min-w-[420px] sm:grid-cols-3">
          <Gauge label="Photos" used={usage.photos} max={plan.maxPhotos} display={`${usage.photos} / ${plan.maxPhotos}`} />
          <Gauge label="Vidéos" used={usage.videos} max={plan.maxVideos} display={plan.maxVideos ? `${usage.videos} / ${plan.maxVideos}` : "Offre Pro"} />
          <Gauge label="Stockage" used={usage.bytes} max={plan.storageMb * 1024 * 1024} display={`${formatBytes(Math.max(usage.bytes, 1))} / ${plan.storageMb >= 1024 ? `${plan.storageMb / 1024} Go` : `${plan.storageMb} Mo`}`} />
          {storagePct >= 80 && (
            <p className="text-[13px] text-rose-ink sm:col-span-3">Votre espace est presque plein. <Link href="/espace/abonnement" className="font-semibold underline underline-offset-4">Passer à l’offre supérieure</Link></p>
          )}
        </section>
      </div>

      <div role="tablist" aria-label="Sections de la galerie" className="relative flex gap-1 border-b border-line"
        onKeyDown={(e) => {
          const i = TABS.findIndex((t) => t.id === tab);
          const n = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
          if (!n) return;
          e.preventDefault();
          const next = TABS[(i + n + TABS.length) % TABS.length].id;
          go(next);
          (e.currentTarget.querySelector(`#tab-${next}`) as HTMLElement | null)?.focus();
        }}>
        {TABS.map((t) => {
          const on = t.id === tab;
          const count = t.id === "albums" ? data.albums.length : t.id === "stories" ? data.stories.filter((s) => !s.archived).length : data.media.length;
          return (
            <button key={t.id} id={`tab-${t.id}`} role="tab" aria-selected={on} aria-controls={`panel-${t.id}`} tabIndex={on ? 0 : -1} onClick={() => go(t.id)}
              className={cn("relative flex h-12 items-center gap-2 px-4 text-sm font-semibold transition-colors", on ? "text-text" : "text-muted hover:text-text")}>
              {t.label}<span className="text-xs text-muted tabular-nums">{count}</span>
              {on && <motion.span layoutId="gal-tab" className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gold" transition={{ type: "spring", bounce: 0.15, duration: 0.45 }} />}
            </button>
          );
        })}
      </div>

      <motion.div key={tab} id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
        {tab === "medias" && <MediaTab key={album ?? "all"} initialAlbum={album} highlightUpload={params.get("ajouter") === "1"} />}
        {tab === "albums" && <AlbumsTab onOpenAlbum={(id) => go("medias", id)} />}
        {tab === "stories" && <StoriesTab openCreate={params.get("nouvelle") === "1"} />}
      </motion.div>
    </div>
  );
}

export function GalerieSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6" aria-busy="true" aria-label="Chargement de la galerie">
      <div className="flex justify-between gap-6"><Skeleton className="h-14 w-56" /><Skeleton className="hidden h-20 w-[420px] rounded-2xl sm:block" /></div>
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-28 rounded-3xl" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="aspect-square rounded-2xl" />)}</div>
    </div>
  );
}
