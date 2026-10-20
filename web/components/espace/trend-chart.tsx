"use client";

import { useId, useMemo, useState } from "react";
import type { DayStat } from "@/lib/espace/types";
import { dateFr } from "@/components/ui/bits";

/**
 * Courbe des vues (aire) + demandes (barres, échelle de droite).
 * Navigable au clavier (flèches) et doublée d’un tableau pour les lecteurs d’écran.
 */
export function TrendChart({ data }: { data: DayStat[] }) {
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  const W = 720, H = 240, P = { l: 36, r: 36, t: 16, b: 28 };
  const iw = W - P.l - P.r, ih = H - P.t - P.b;

  const { maxV, maxQ, path, area, x } = useMemo(() => {
    const maxV = Math.max(10, ...data.map((d) => d.views));
    const maxQ = Math.max(4, ...data.map((d) => d.inquiries));
    const x = (i: number) => P.l + (data.length <= 1 ? iw / 2 : (i * iw) / (data.length - 1));
    const y = (v: number) => P.t + ih - (v / maxV) * ih;
    const pts = data.map((d, i) => [x(i), y(d.views)] as const);
    // courbe lissée (Catmull-Rom → Bézier)
    let path = pts.length ? `M${pts[0][0]},${pts[0][1]}` : "";
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
      path += ` C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`;
    }
    const area = pts.length ? `${path} L${pts[pts.length - 1][0]},${P.t + ih} L${pts[0][0]},${P.t + ih} Z` : "";
    return { maxV, maxQ, path, area, x };
  }, [data, iw, ih, P.l, P.t]);

  const barW = Math.max(3, Math.min(14, (iw / Math.max(1, data.length)) * 0.45));
  const a = active !== null ? data[active] : null;
  const ticks = [0, 0.5, 1];

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full touch-none select-none" role="img" aria-labelledby={`${id}-t`} tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") { e.preventDefault(); setActive((v) => Math.min(data.length - 1, (v ?? -1) + 1)); }
          if (e.key === "ArrowLeft") { e.preventDefault(); setActive((v) => Math.max(0, (v ?? data.length) - 1)); }
          if (e.key === "Escape") setActive(null);
        }}
        onBlur={() => setActive(null)}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          setActive(Math.max(0, Math.min(data.length - 1, Math.round(((px - P.l) / iw) * (data.length - 1)))));
        }}
        onPointerLeave={() => setActive(null)}>
        <title id={`${id}-t`}>Vues du profil et demandes de devis par jour. Utilisez les flèches pour parcourir les jours.</title>
        <defs>
          <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--gold)" stopOpacity=".35" />
            <stop offset="1" stopColor="var(--gold)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={P.t + ih - t * ih} y2={P.t + ih - t * ih} stroke="var(--line)" strokeDasharray={t ? "3 5" : undefined} />
            <text x={P.l - 8} y={P.t + ih - t * ih + 4} textAnchor="end" fontSize="11" fill="var(--muted)">{Math.round(maxV * t)}</text>
            <text x={W - P.r + 8} y={P.t + ih - t * ih + 4} fontSize="11" fill="var(--rose-ink)">{Math.round(maxQ * t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const h = (d.inquiries / maxQ) * ih * 0.55;
          return <rect key={d.day} x={x(i) - barW / 2} y={P.t + ih - h} width={barW} height={h} rx={barW / 3} fill="var(--rose)" opacity={active === null || active === i ? 0.75 : 0.3} />;
        })}
        <path d={area} fill={`url(#${id}-g)`} />
        <path d={path} fill="none" stroke="var(--gold)" strokeWidth="2.5" strokeLinecap="round" />
        {[0, Math.floor((data.length - 1) / 2), data.length - 1].filter((v, i, arr) => arr.indexOf(v) === i && data[v]).map((i) => (
          <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"} fontSize="11" fill="var(--muted)">{dateFr(data[i].day, { day: "numeric", month: "short" })}</text>
        ))}
        {a && active !== null && (
          <g>
            <line x1={x(active)} x2={x(active)} y1={P.t} y2={P.t + ih} stroke="var(--line-strong)" />
            <circle cx={x(active)} cy={P.t + ih - (a.views / maxV) * ih} r="5" fill="var(--gold)" stroke="var(--surface)" strokeWidth="2" />
          </g>
        )}
      </svg>
      {a && active !== null && (
        <div role="status" className="pointer-events-none absolute top-2 rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-xl"
          style={{ left: `clamp(8px, calc(${(x(active) / W) * 100}% - 70px), calc(100% - 150px))` }}>
          <p className="font-semibold capitalize">{dateFr(a.day, { weekday: "long", day: "numeric", month: "long" })}</p>
          <p className="mt-1 flex items-center gap-2"><span className="size-2 rounded-full bg-gold" aria-hidden />{a.views} vues</p>
          <p className="flex items-center gap-2"><span className="size-2 rounded-full bg-rose" aria-hidden />{a.inquiries} demande{a.inquiries > 1 ? "s" : ""}</p>
        </div>
      )}
      <table className="sr-only">
        <caption>Vues et demandes par jour</caption>
        <thead><tr><th>Jour</th><th>Vues</th><th>Demandes</th></tr></thead>
        <tbody>{data.map((d) => <tr key={d.day}><td>{dateFr(d.day)}</td><td>{d.views}</td><td>{d.inquiries}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

/** Mini-courbe décorative pour les cartes KPI */
export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const max = Math.max(...values), min = Math.min(...values), range = max - min || 1;
  const pts = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * 100},${28 - ((v - min) / range) * 24}`).join(" ");
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={className} aria-hidden>
      <polyline points={pts} fill="none" stroke="var(--gold)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}
