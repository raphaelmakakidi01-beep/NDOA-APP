"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

const VenueMapInner = dynamic(() => import("./venue-map-inner"), { ssr: false, loading: () => <div className="venue-map-ph" /> });

/** Carte de la salle : chargée seulement quand la section approche de l'écran (maplibre-gl est lourd) */
export function VenueMap({ lat, lng, name }: { lat: number; lng: number; name: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) { setNear(true); io.disconnect(); } }, { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className="venue-map">{near ? <VenueMapInner lat={lat} lng={lng} name={name} /> : <div className="venue-map-ph" />}</div>;
}
