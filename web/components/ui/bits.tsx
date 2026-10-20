import { cn } from "@/lib/utils";

/* Petits éléments partagés de l’espace prestataire */

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLElement> & { as?: "section" | "div" | "article" }) {
  return (
    <section className={cn("min-w-0 rounded-3xl border border-line bg-surface p-5 sm:p-6", className)} {...props}>
      {children}
    </section>
  );
}

export function CardHeader({ title, action, sub, id }: { title: React.ReactNode; action?: React.ReactNode; sub?: React.ReactNode; id?: string }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <h2 id={id} className="font-display text-xl leading-tight sm:text-2xl">{title}</h2>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

const TONES = {
  rose: "bg-rose/15 text-rose-ink",
  gold: "bg-gold/15 text-gold-ink",
  muted: "bg-surface-2 text-muted",
  success: "bg-success/15 text-success",
  danger: "bg-danger/10 text-danger",
} as const;

/** Statut lisible (texte + teinte), jamais la couleur seule */
export function StatusTag({ tone, children, className }: { tone: keyof typeof TONES; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-md px-2 text-xs font-semibold", TONES[tone], className)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {children}
    </span>
  );
}

export function EmptyState({ icon, title, children, action, className }: { icon?: React.ReactNode; title: string; children?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid justify-items-center gap-3 rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center", className)}>
      {icon && <span className="grid size-12 place-items-center rounded-2xl bg-gold/12 text-gold-ink [&_svg]:size-5">{icon}</span>}
      <p className="font-display text-xl">{title}</p>
      {children && <p className="max-w-sm text-sm text-muted">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-xl", className)} aria-hidden />;
}

export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex gap-0.5 text-gold", className)} role="img" aria-label={`${value} sur 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} viewBox="0 0 24 24" className={cn("size-3.5", i >= Math.round(value) && "opacity-25")} fill="currentColor" aria-hidden>
          <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z" />
        </svg>
      ))}
    </span>
  );
}

export function timeAgo(isoDate: string) {
  const s = (Date.now() - new Date(isoDate).getTime()) / 1000;
  if (s < 60) return "à l’instant";
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
  const d = Math.round(s / 86400);
  return d === 1 ? "hier" : `il y a ${d} j`;
}

export const dateFr = (isoDate: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" }) =>
  new Date(isoDate.length === 10 ? `${isoDate}T12:00` : isoDate).toLocaleDateString("fr-FR", opts);
