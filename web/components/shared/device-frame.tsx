"use client";

import { useEffect, useRef, useState } from "react";
import { PUBLIC_HOST } from "@/lib/config";

/** Cadre d’aperçu : le rendu desktop (1200 px) est réduit pour tenir dans la colonne */
export function DeviceFrame({ device, children, mobileHeight }: { device: "desktop" | "mobile"; children: React.ReactNode; mobileHeight?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [height, setHeight] = useState(1200);
  useEffect(() => {
    const ro = new ResizeObserver(() => {
      if (box.current) setScale(Math.min(1, box.current.clientWidth / 1200));
      if (inner.current) setHeight(inner.current.offsetHeight);
    });
    if (box.current) ro.observe(box.current);
    if (inner.current) ro.observe(inner.current);
    return () => ro.disconnect();
  }, [device]);
  if (device === "mobile")
    return (
      <div className="mx-auto w-[min(100%,390px)] rounded-[44px] border border-line-strong bg-black p-3 shadow-2xl">
        <div className={`${mobileHeight ?? "h-[700px]"} overflow-y-auto overflow-x-hidden rounded-[34px]`} tabIndex={0} aria-label="Aperçu mobile (défilable)">{children}</div>
      </div>
    );
  return (
    <div ref={box} className="overflow-hidden rounded-2xl border border-line-strong bg-black shadow-2xl">
      <div className="flex items-center gap-1.5 border-b border-white/10 bg-[#17171A] px-4 py-2.5" aria-hidden>
        <span className="size-2.5 rounded-full bg-white/20" /><span className="size-2.5 rounded-full bg-white/20" /><span className="size-2.5 rounded-full bg-white/20" />
        <span className="ml-3 rounded-full bg-black/40 px-3 py-1 text-[11px] text-white/60">{PUBLIC_HOST}/prestataires/…</span>
      </div>
      <div className="h-[560px] overflow-y-auto overflow-x-hidden" tabIndex={0} aria-label="Aperçu ordinateur (défilable)">
        {/* le contenu transformé n’occupe pas d’espace : on réserve sa hauteur réduite */}
        <div style={{ height: height * scale, position: "relative" }}>
          <div ref={inner} style={{ width: 1200, transform: `scale(${scale})`, transformOrigin: "top left", position: "absolute", top: 0, left: 0 }}>{children}</div>
        </div>
      </div>
    </div>
  );
}

