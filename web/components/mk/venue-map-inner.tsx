"use client";

import { Map, MapMarker, MarkerContent, MarkerTooltip } from "@/components/ui/mapcn-marker-content";
import { MapPin } from "@/components/ui/map-pin";

export default function VenueMapInner({ lat, lng, name }: { lat: number; lng: number; name: string }) {
  return (
    <Map center={[lng, lat]} zoom={15} theme="dark" cooperativeGestures>
      <MapMarker longitude={lng} latitude={lat}>
        <MarkerContent><MapPin size={44} /></MarkerContent>
        <MarkerTooltip>{name}</MarkerTooltip>
      </MapMarker>
    </Map>
  );
}
