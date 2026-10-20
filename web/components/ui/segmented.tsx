"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

/* Sélecteur à segments (radio accessible) avec indicateur animé */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
  layoutId,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
  label: string;
  className?: string;
  layoutId: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex rounded-full border border-line bg-surface-2 p-1", className)}
      onKeyDown={(e) => {
        const i = options.findIndex((o) => o.value === value);
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          e.preventDefault();
          const n = options[(i + (e.key === "ArrowRight" ? 1 : -1) + options.length) % options.length];
          onChange(n.value);
          (e.currentTarget.querySelector(`[data-v="${n.value}"]`) as HTMLElement | null)?.focus();
        }
      }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} data-v={o.value}
            onClick={() => onChange(o.value)}
            className={cn("relative flex-1 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors", on ? "text-on-gold" : "text-muted hover:text-text")}>
            {on && <motion.span layoutId={layoutId} className="absolute inset-0 rounded-full bg-gold" transition={{ type: "spring", bounce: 0.15, duration: 0.45 }} />}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
