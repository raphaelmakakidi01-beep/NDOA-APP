"use client";

import { useEffect } from "react";
import { Map, MapMarker, MarkerContent, useMap } from "@/components/ui/mapcn-marker-content";
import { MapPin } from "@/components/ui/map-pin";
import type { LngLat } from "@/lib/vendor-extras";

/** Un toucher ou un clic sur la carte déplace le repère */
function ClickToMove({ onPick }: { onPick: (p: LngLat) => void }) {
  const { map } = useMap();
  useEffect(() => {
    if (!map) return;
    const h = (e: { lngLat: { lng: number; lat: number } }) => onPick({ lng: e.lngLat.lng, lat: e.lngLat.lat });
    map.on("click", h);
    return () => { map.off("click", h); };
  }, [map, onPick]);
  return null;
}

/** Recentre la carte quand le point change hors de la carte (bouton « Me localiser ») */
function FollowPoint({ point }: { point: LngLat }) {
  const { map } = useMap();
  useEffect(() => {
    if (!map) return;
    const c = map.getCenter();
    if (Math.abs(c.lng - point.lng) > 0.002 || Math.abs(c.lat - point.lat) > 0.002) map.easeTo({ center: [point.lng, point.lat], zoom: Math.max(map.getZoom(), 15) });
  }, [map, point]);
  return null;
}

export default function LocationPickerMap({ point, onPick, zoom }: { point: LngLat; onPick: (p: LngLat) => void; zoom: number }) {
  return (
    <Map center={[point.lng, point.lat]} zoom={zoom} cooperativeGestures>
      <ClickToMove onPick={onPick} />
      <FollowPoint point={point} />
      <MapMarker longitude={point.lng} latitude={point.lat} draggable onDragEnd={onPick}>
        <MarkerContent><MapPin size={38} /></MarkerContent>
      </MapMarker>
    </Map>
  );
}
