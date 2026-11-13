"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { LocateFixed, MapPin as MapPinIcon, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cityCenter, formatCoords, parseCoords, type LngLat } from "@/lib/vendor-extras";

// maplibre-gl (≈ 800 Ko) n'est chargé que si la carte s'affiche
const PickerMap = dynamic(() => import("./location-picker-map"), { ssr: false, loading: () => <div className="skeleton h-full w-full" /> });

/** Salle : le prestataire pose le repère sur l'entrée de sa salle (glisser, toucher la carte ou « Me localiser ») */
export function LocationPicker({ value, city, onChange }: { value?: string; city?: string; onChange: (v: string) => void }) {
  const saved = parseCoords(value);
  const [point, setPoint] = useState<LngLat | null>(saved);
  const [locating, setLocating] = useState(false);
  const pick = useCallback((p: LngLat) => { setPoint(p); onChange(formatCoords(p)); }, [onChange]);

  const locate = () => {
    if (!navigator.geolocation) { toast.error("La localisation n’est pas disponible sur cet appareil."); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLocating(false); pick({ lat: pos.coords.latitude, lng: pos.coords.longitude }); toast.success("Repère placé sur votre position actuelle"); },
      () => { setLocating(false); toast.error("Position introuvable : autorisez la localisation ou placez le repère à la main."); },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  return (
    <div className="grid gap-3 sm:col-span-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Localisation de la salle</p>
          <p className="mt-0.5 text-[13px] text-muted">{point ? "Glissez le repère sur l’entrée de la salle, ou touchez la carte pour le déplacer." : "Touchez la carte à l’emplacement de votre salle : les mariés verront la carte et l’itinéraire sur votre fiche."}</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" loading={locating} onClick={locate}><LocateFixed aria-hidden />Me localiser</Button>
          {point && <Button type="button" variant="ghost" size="sm" onClick={() => { setPoint(null); onChange(""); }}><X aria-hidden />Retirer</Button>}
        </div>
      </div>
      <div className="relative h-80 overflow-hidden rounded-2xl border border-line">
        <PickerMap point={point ?? cityCenter(city)} zoom={point ? 15 : 12} onPick={pick} />
        {!point && <div className="pointer-events-none absolute inset-x-0 bottom-3 mx-auto w-fit rounded-full bg-bg/85 px-3 py-1.5 text-[12.5px] font-semibold text-text shadow">Touchez la carte pour placer le repère</div>}
      </div>
      {point && <p className="inline-flex items-center gap-1.5 text-[12.5px] text-muted"><MapPinIcon className="size-3.5" aria-hidden />Repère enregistré : {point.lat.toFixed(5)}, {point.lng.toFixed(5)}</p>}
    </div>
  );
}
