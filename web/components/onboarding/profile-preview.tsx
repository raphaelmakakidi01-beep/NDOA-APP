"use client";

import { Check, MapPin, MessageCircle, Phone, Tag } from "lucide-react";
import type { Draft } from "@/lib/onboarding/types";
import { useCatalog } from "@/lib/onboarding/use-catalog";
import { BrandMark } from "@/components/brand";
import { cn, formatPrice } from "@/lib/utils";

/**
 * Reproduction fidèle de la page publique (prestataire.html) à partir du brouillon.
 * Toujours rendue en thème sombre, comme le site public.
 */
export function ProfilePreview({ d, compact }: { d: Draft; compact: boolean }) {
  const { categoryName } = useCatalog();
  const cat = categoryName(d.primaryCategory ?? d.categories[0] ?? "");
  const photos = d.photos.filter((p) => p.status === "ready");
  const amount = Number(d.pkg.amount) || 0;
  const words = (d.name || "Votre nom").split(" ");
  const last = words.length > 1 ? words.pop() : undefined;

  return (
    <div className="dark bg-[#0A0A0B] font-sans text-[#F5F0E8]" style={{ colorScheme: "dark" }}>
      {/* Couverture */}
      <div className={cn("relative overflow-hidden", compact ? "h-[300px]" : "h-[440px]")}>
        {d.coverVideo?.url ? (
          <video src={d.coverVideo.url} poster={d.coverVideo.posterUrl} autoPlay muted loop playsInline className="absolute inset-0 size-full object-cover" aria-hidden />
        ) : d.coverVideo?.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.coverVideo.posterUrl} alt="" className="absolute inset-0 size-full object-cover" />
        ) : d.cover?.url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.cover.url} alt="" className="absolute inset-0 size-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-[#0A0A0B]" />
        <div className={cn("absolute top-0 flex w-full items-center justify-between", compact ? "px-4 py-3" : "px-10 py-5")}>
          <BrandMark size="sm" />
          {!compact && <span className="rounded-full bg-gold px-4 py-2 text-xs font-bold text-black">Devenir prestataire</span>}
        </div>
      </div>

      {/* En-tête */}
      <div className={cn("relative", compact ? "-mt-16 px-4" : "-mt-28 px-10")}>
        <div className={cn("grid gap-4", !compact && "grid-cols-[auto_1fr] items-center gap-8")}>
          <span className={cn("block rounded-full bg-[conic-gradient(from_200deg,#8B4026,#E6C694,#C4975A,#fff1cf,#8B4026)] p-1", compact ? "size-24" : "size-36")}>
            {d.avatar?.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={d.avatar.url} alt="" className="size-full rounded-full border-4 border-[#0A0A0B] object-cover" />
            ) : <span className="block size-full rounded-full border-4 border-[#0A0A0B] bg-[#1F1F23]" />}
          </span>
          <div>
            <h3 className={cn("font-display leading-[.95] tracking-tight", compact ? "text-[2rem]" : "text-6xl")}>
              {words.join(" ")} {last && <em className="text-[#E6C694]">{last}</em>}
              <span className="ml-2 inline-grid size-[.4em] place-items-center rounded-full bg-gold align-middle text-black"><Check className="size-[.28em]" strokeWidth={4} aria-label="Vérifié" /></span>
            </h3>
            {d.tagline && <p className={cn("mt-2 text-white/80", compact ? "text-sm" : "text-base")}>{d.tagline}</p>}
            {!!d.styleTags?.length && (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {d.styleTags.slice(0, 5).map((t) => <li key={t} className="rounded-full border border-white/15 px-2.5 py-1 text-[11px] text-white/80">{t}</li>)}
              </ul>
            )}
            <ul className={cn("mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-white/80", compact ? "text-xs" : "text-sm")}>
              <li className="flex items-center gap-1.5"><Tag className="size-3.5 text-gold" aria-hidden />{cat || "Activité"}</li>
              <li className="flex items-center gap-1.5"><MapPin className="size-3.5 text-gold" aria-hidden />{d.city}{d.zones.length ? ` · ${d.zones.slice(0, 2).join(", ")}` : ""}</li>
              <li className="text-gold">Nouveau sur NDOA</li>
            </ul>
          </div>
        </div>
        <div className={cn("mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-5", compact && "grid grid-cols-[1fr_auto_auto]")}>
          <span className="inline-flex h-11 items-center justify-center rounded-full bg-gold px-6 text-sm font-bold text-black">Demander un devis</span>
          <span className="inline-flex h-11 items-center gap-2 rounded-full border border-[#9EE6B4]/40 px-4 text-sm font-semibold text-[#9EE6B4]"><MessageCircle className="size-4" aria-hidden />{!compact && "WhatsApp"}</span>
          <span className="inline-flex h-11 items-center gap-2 rounded-full border border-white/15 px-4 text-sm font-semibold"><Phone className="size-4" aria-hidden />{!compact && "Appeler"}</span>
        </div>
      </div>

      {/* Onglet Réalisations + forfait */}
      <div className={cn("grid gap-8", compact ? "px-4 py-6" : "grid-cols-[1fr_300px] px-10 py-10")}>
        <div>
          <div className="mb-4 flex gap-5 border-b border-white/10 text-sm font-semibold">
            <span className="border-b-2 border-gold pb-3">Réalisations <span className="text-white/50">{photos.length}</span></span>
            <span className="pb-3 text-white/50">Tarifs</span><span className="pb-3 text-white/50">À propos</span>
          </div>
          <div className={cn("gap-2", compact ? "columns-2" : "columns-3")}>
            {photos.slice(0, compact ? 6 : 9).map((p, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p.id} src={p.url} alt="" className={cn("mb-2 w-full rounded-xl object-cover", ["aspect-[3/4]", "aspect-square", "aspect-[4/5]"][i % 3])} />
            ))}
            {photos.length === 0 && <p className="text-sm text-white/50">Vos photos apparaîtront ici.</p>}
          </div>
        </div>
        <div className="rounded-2xl border border-gold/50 bg-[#17171A] p-5">
          <p className="text-[11px] font-bold uppercase tracking-[.2em] text-gold">À partir de</p>
          <p className="font-display mt-1 text-3xl">{amount ? formatPrice(amount, d.pkg.currency) : "—"}</p>
          <p className="font-display mt-3 text-xl italic text-[#E6C694]">{d.pkg.name}</p>
          <ul className="mt-3 grid gap-1.5 text-sm text-white/85">
            {d.pkg.includes.slice(0, 5).map((i) => <li key={i} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />{i}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}
