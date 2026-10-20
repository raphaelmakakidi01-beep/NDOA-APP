"use client";

import { useId, useState } from "react";
import { dateFr } from "@/components/ui/bits";

/**
 * Histogramme quotidien d'une série (dense, lisible sur mobile).
 * Survol / flèches du clavier pour lire chaque jour ; tableau équivalent pour les lecteurs d'écran.
 */
export function DailyBars({ data, label }: { data: { day: string; value: number }[]; label: string }) {
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  const W = 760, H = 220, P = { l: 34, r: 8, t: 12, b: 24 };
  const iw = W - P.l - P.r, ih = H - P.t - P.b;
  const max = Math.max(4, ...data.map((d) => d.value));
  const nice = Math.ceil(max / 4) * 4;
  const step = iw / Math.max(1, data.length);
  const bw = Math.max(2, Math.min(22, step * 0.62));
  const total = data.reduce((s, d) => s + d.value, 0);
  const a = active !== null ? data[active] : null;
  const labelIdx = [...new Set([0, Math.floor((data.length - 1) / 2), data.length - 1])];

  return (
    <div className="relative">
      <div className="mb-2 flex items-baseline justify-between gap-3 px-1 text-[13px]">
        <span className="text-muted">{a ? dateFr(a.day, { weekday: "short", day: "numeric", month: "short" }) : `Total sur ${data.length} jours`}</span>
        <span className="font-semibold tabular">{a ? a.value : total} <span className="font-normal text-muted">{label.toLowerCase()}</span></span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full touch-none select-none" role="img" aria-labelledby={`${id}-t`} tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") { e.preventDefault(); setActive((v) => Math.min(data.length - 1, (v ?? -1) + 1)); }
          if (e.key === "ArrowLeft") { e.preventDefault(); setActive((v) => Math.max(0, (v ?? data.length) - 1)); }
          if (e.key === "Escape") setActive(null);
        }}
        onBlur={() => setActive(null)}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - r.left) / r.width) * W - P.l;
          setActive(Math.max(0, Math.min(data.length - 1, Math.floor(x / step))));
        }}
        onPointerLeave={() => setActive(null)}>
        <title id={`${id}-t`}>{label} par jour. Flèches gauche et droite pour parcourir les jours.</title>
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={P.t + ih - t * ih} y2={P.t + ih - t * ih} stroke="var(--line)" strokeDasharray={t ? "3 5" : undefined} />
            <text x={P.l - 6} y={P.t + ih - t * ih + 4} textAnchor="end" fontSize="11" fill="var(--muted)">{Math.round(nice * t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const h = (d.value / nice) * ih;
          return (
            <rect key={d.day} x={P.l + i * step + (step - bw) / 2} y={P.t + ih - h} width={bw} height={Math.max(h, d.value ? 1.5 : 0)} rx={Math.min(3, bw / 3)}
              fill="var(--gold)" opacity={active === null || active === i ? 0.9 : 0.35} />
          );
        })}
        {labelIdx.map((i) => data[i] && (
          <text key={i} x={P.l + i * step + step / 2} y={H - 6} textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"} fontSize="11" fill="var(--muted)">
            {dateFr(data[i].day, { day: "numeric", month: "short" })}
          </text>
        ))}
      </svg>
      <table className="sr-only">
        <caption>{label} par jour</caption>
        <thead><tr><th scope="col">Jour</th><th scope="col">{label}</th></tr></thead>
        <tbody>{data.map((d) => <tr key={d.day}><td>{dateFr(d.day)}</td><td>{d.value}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
