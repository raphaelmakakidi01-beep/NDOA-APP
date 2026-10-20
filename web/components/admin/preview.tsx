"use client";

import { ProfilePreview } from "@/components/onboarding/profile-preview";
import type { AdminVendorDetail } from "@/lib/admin/types";
import type { Draft, MediaRef } from "@/lib/onboarding/types";

const ref = (id: string, url: string): MediaRef => ({ id, url, source: "remote", name: id, size: 0, status: "ready", progress: 100 });

/** Vitrine telle qu'elle apparaîtra sur le site public (même rendu que l'aperçu de l'onboarding) */
export function toDraft(v: AdminVendorDetail): Draft {
  const pkg = v.packages.find((p) => p.isVisible) ?? v.packages[0];
  const primary = v.categories.find((c) => c.primary) ?? v.categories[0];
  return {
    vendorId: v.id, categories: v.categories.map((c) => c.slug), primaryCategory: primary?.slug,
    name: v.name, slug: v.slug, tagline: v.tagline ?? "", bio: v.bio ?? "", city: v.city, zones: v.zones, languages: v.languages,
    avatar: v.avatarUrl ? ref("avatar", v.avatarUrl) : undefined,
    cover: v.coverUrl ? ref("cover", v.coverUrl) : undefined,
    photos: v.media.filter((m) => m.kind === "photo" && !m.isHidden).map((m) => ref(m.id, m.url)),
    pkg: {
      name: pkg?.name ?? "", priceMode: pkg?.priceMode ?? "from", amount: pkg ? String(pkg.amount) : "", currency: pkg?.currency ?? "USD",
      duration: pkg?.duration ?? "", description: "", includes: pkg?.includes ?? [], excludes: [],
    },
    contacts: {
      country: "CD", phone: v.phone ?? "", whatsappSame: v.whatsapp === v.phone, whatsapp: v.whatsapp ?? "", email: v.email ?? "",
      instagram: v.socials.instagram ?? "", tiktok: v.socials.tiktok ?? "", facebook: v.socials.facebook ?? "", youtube: v.socials.youtube ?? "", website: v.socials.site ?? "",
    },
    done: {},
  };
}

export function PublicPreview({ v, compact = true }: { v: AdminVendorDetail; compact?: boolean }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line" aria-label={`Aperçu public de ${v.name}`} role="img">
      <div className="pointer-events-none max-h-[560px] overflow-hidden [mask-image:linear-gradient(to_bottom,black_85%,transparent)]" aria-hidden>
        <ProfilePreview d={toDraft(v)} compact={compact} />
      </div>
    </div>
  );
}
