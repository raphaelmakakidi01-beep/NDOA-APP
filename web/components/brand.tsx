"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { DEMO } from "@/lib/config";

const LOGOS = {
  wordmark: { light: "/brand/ndoa.webp", dark: "/brand/ndoa-ivoire.webp", ratio: 560 / 231 },
  full: { light: "/brand/ndoa-wedding.webp", dark: "/brand/ndoa-wedding-ivoire.webp", ratio: 720 / 339 },
  mark: { light: "/brand/ndoa-monogramme.webp", dark: "/brand/ndoa-monogramme-ivoire.webp", ratio: 256 / 223 },
} as const;
const HEIGHTS = { sm: 26, md: 32, lg: 44, xl: 64 } as const;

/** Image de marque NDOA Wedding : version brun et or en clair, ivoire et or en sombre */
/** `on="dark"` : toujours la version ivoire (fond photo ou sombre quel que soit le thème) */
export function BrandMark({ variant = "wordmark", size = "md", on = "auto", className }: { variant?: keyof typeof LOGOS; size?: keyof typeof HEIGHTS; on?: "auto" | "dark"; className?: string }) {
  const l = LOGOS[variant], h = HEIGHTS[size], w = Math.round(h * l.ratio);
  return (
    <span className={cn("inline-flex shrink-0", className)} style={{ height: h, width: w }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {on === "auto" && <img src={l.light} alt="" width={w} height={h} className="h-full w-full object-contain dark:hidden" />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={l.dark} alt="" width={w} height={h} className={cn("h-full w-full object-contain", on === "auto" && "hidden dark:block")} />
    </span>
  );
}

export function Logo({ className, href = "/", variant = "wordmark", size = "md", on = "auto" }: { className?: string; href?: string; variant?: keyof typeof LOGOS; size?: keyof typeof HEIGHTS; on?: "auto" | "dark" }) {
  return (
    <Link href={href} className={cn("inline-flex items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60", className)} aria-label="NDOA Wedding — accueil">
      <BrandMark variant={variant} size={size} on={on} />
    </Link>
  );
}

const subscribe = () => () => {};
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const dark = !mounted || resolvedTheme !== "light";
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      className={cn("grid size-10 place-items-center rounded-full border border-line text-muted transition-colors hover:border-gold hover:text-text", className)}
      aria-label={dark ? "Passer en mode clair" : "Passer en mode sombre"}
    >
      {dark ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
    </button>
  );
}

export function DemoBanner({ className, children }: { className?: string; children?: React.ReactNode }) {
  if (!DEMO) return null;
  return (
    <div role="note" className={cn("flex items-start gap-2 text-[13px] leading-snug text-muted", className)}>
      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-gold" aria-hidden />
      <span><b className="font-semibold text-gold-ink">Mode démo</b> · rien n’est envoyé, tout reste dans ce navigateur.
      {children && <> {children}</>}</span>
    </div>
  );
}
