"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, Marker, TileLayer } from "react-leaflet";
import {
  ESRI_ATTRIBUTION,
  ESRI_DARK_BASE_URL,
  ESRI_DARK_LABELS_URL,
  buildPinIcon,
} from "@/components/ParcelMapView";
import type { Parcel } from "@/lib/types";

// Close enough to see the parcel's immediate street context without the
// map opening on a near-featureless single block.
const DETAIL_ZOOM = 15;

// The land detail page's map: one parcel, one marker, no selection state
// and no side panel — the whole page already *is* that parcel's detail.
// Reuses the browse map's exact basemap and pin icon (see
// src/components/ParcelMapView.tsx) so the two never drift apart
// visually. Loaded via next/dynamic with ssr:false from the detail page,
// same reason as ParcelMapView: Leaflet touches `window` at import time
// and cannot run during server rendering.
export default function ParcelDetailMap({ parcel }: { parcel: Parcel }) {
  const position: [number, number] = [parcel.lat, parcel.lng];

  return (
    <div className="h-[360px] w-full overflow-hidden rounded-xl border border-hairline">
      <MapContainer
        center={position}
        zoom={DETAIL_ZOOM}
        scrollWheelZoom
        className="h-full w-full"
        style={{ background: "#2b2b30" }}
      >
        <TileLayer url={ESRI_DARK_BASE_URL} attribution={ESRI_ATTRIBUTION} />
        <TileLayer url={ESRI_DARK_LABELS_URL} />
        <Marker position={position} icon={buildPinIcon(parcel, false)} />
      </MapContainer>
    </div>
  );
}
