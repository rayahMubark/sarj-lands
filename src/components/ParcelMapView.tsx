"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import { useLanguage } from "@/lib/i18n";
import { STATUS_PIN_COLORS } from "@/lib/mapTheme";
import type { Parcel } from "@/lib/types";
import { MapLegend } from "@/components/MapLegend";
import { ParcelSidePanel } from "@/components/ParcelSidePanel";

const RIYADH_CENTER: [number, number] = [24.7136, 46.6753];
const DEFAULT_ZOOM = 11;

// CARTO's classic anonymous "dark_all" basemap (the usual no-key dark-tile
// recommendation) now serves a watermarked "API KEY REQUIRED" placeholder
// instead of real tiles — verified directly, not assumed. Esri's Dark Gray
// Canvas is still genuinely free with no key: a base layer plus a
// transparent reference layer of place labels (in Arabic *and* English —
// a nice fit for this app) stacked on top. Less inky than CARTO's black,
// but still a clear dark, premium departure from a default light map.
// Exported alongside buildPinIcon below so the land detail page's
// single-parcel map (src/components/ParcelDetailMap.tsx) renders the exact
// same basemap and pin style instead of re-implementing them.
export const ESRI_DARK_BASE_URL =
  "https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}";
export const ESRI_DARK_LABELS_URL =
  "https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}";
// Kept short on purpose: Leaflet's attribution control sits bottom-right
// at z-index 1000 (Leaflet's own default — see the .leaflet-top/.leaflet-
// bottom rule in leaflet.css), and a long attribution string wraps wide
// on narrow viewports, which was overlapping and eating clicks meant for
// MapLegend's bottom-start toggle button. "Tiles © Esri" is still a
// compliant, commonly-used attribution for Esri's own basemap tiles.
export const ESRI_ATTRIBUTION = "Tiles &copy; Esri";

// The Map half of the browse page's List/Map toggle. Loaded via
// next/dynamic with ssr:false from src/app/page.tsx — Leaflet touches
// `window` and cannot run during server rendering. Renders one pin per
// parcel in `parcels`, the exact same filtered list the card grid uses, so
// switching filters updates both views identically.
export default function ParcelMapView({ parcels }: { parcels: Parcel[] }) {
  const { t } = useLanguage();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // If a filter change drops the selected parcel out of the list, this is
  // simply null again — the panel below is conditionally rendered on it,
  // so it closes on its own without any extra effect to reconcile state.
  const selectedParcel = useMemo(
    () => parcels.find((parcel) => parcel.parcel_id === selectedId) ?? null,
    [parcels, selectedId]
  );

  return (
    <div className="relative h-[70vh] min-h-[420px] w-full overflow-hidden border-y border-hairline">
      <MapContainer
        center={RIYADH_CENTER}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom
        className="h-full w-full"
        style={{ background: "#2b2b30" }}
      >
        <TileLayer url={ESRI_DARK_BASE_URL} attribution={ESRI_ATTRIBUTION} />
        <TileLayer url={ESRI_DARK_LABELS_URL} />
        <FitToParcels parcels={parcels} />
        {parcels.map((parcel) => (
          <ParcelMarker
            key={parcel.parcel_id}
            parcel={parcel}
            isSelected={parcel.parcel_id === selectedId}
            onSelect={() => setSelectedId(parcel.parcel_id)}
          />
        ))}
      </MapContainer>

      {parcels.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="rounded-full bg-background/90 px-4 py-2 text-sm text-muted shadow">
            {t("mapEmptyState")}
          </p>
        </div>
      )}

      <MapLegend />

      {selectedParcel && (
        // key: force a fresh mount when a different pin is selected, so
        // the panel's CSS entrance animation (see ParcelSidePanel) replays
        // instead of silently no-op'ing on an already-open instance.
        <ParcelSidePanel
          key={selectedParcel.parcel_id}
          parcel={selectedParcel}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}

// Keeps the map framed around whatever parcels are currently filtered in —
// re-fits every time the list changes, not just once on mount.
function FitToParcels({ parcels }: { parcels: Parcel[] }) {
  const map = useMap();

  useEffect(() => {
    if (parcels.length === 0) {
      map.setView(RIYADH_CENTER, DEFAULT_ZOOM);
      return;
    }

    const bounds = L.latLngBounds(
      parcels.map((parcel): [number, number] => [parcel.lat, parcel.lng])
    );
    map.fitBounds(bounds, { padding: [32, 32], maxZoom: 15 });
  }, [parcels, map]);

  return null;
}

function ParcelMarker({
  parcel,
  isSelected,
  onSelect,
}: {
  parcel: Parcel;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const icon = useMemo(
    () => buildPinIcon(parcel, isSelected),
    [parcel, isSelected]
  );

  return (
    <Marker
      position={[parcel.lat, parcel.lng]}
      icon={icon}
      eventHandlers={{ click: onSelect }}
    />
  );
}

// A teardrop pin colored by status (see STATUS_PIN_COLORS — the same map
// MapLegend's swatches read, so they always match exactly) and shaped by
// land type: a square glyph (echoing the "▪" section-label motif used
// across the app) for commercial, a circle for residential. Selection is
// shown by size and a light outline ring rather than a color change, so
// the status color stays meaningful even on the selected pin. "sold"
// additionally renders at reduced opacity so it visibly recedes next to
// the more saturated statuses, as intended.
// Exported for ParcelDetailMap's single, always-unselected marker, so
// the land detail page's pin matches the browse map's exactly.
export function buildPinIcon(parcel: Parcel, isSelected: boolean): L.DivIcon {
  const height = isSelected ? 38 : 28;
  const width = Math.round(height * 0.75);
  const fill = STATUS_PIN_COLORS[parcel.status];
  const opacity = parcel.status === "sold" ? 0.72 : 1;
  const ring = isSelected
    ? ` stroke="var(--color-background)" stroke-width="1.5"`
    : "";
  const glyph =
    parcel.land_type === "commercial"
      ? `<rect x="9" y="9" width="6" height="6" fill="var(--color-background)" />`
      : `<circle cx="12" cy="12" r="3.4" fill="var(--color-background)" />`;

  const html = `
    <svg width="${width}" height="${height}" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg" style="display:block;opacity:${opacity};filter:drop-shadow(0 2px 4px rgb(0 0 0 / 0.5));">
      <path
        d="M12 0C5.4 0 0 5.4 0 12c0 8.5 10.6 18.8 11 19.2a1.4 1.4 0 0 0 2 0C13.4 30.8 24 20.5 24 12 24 5.4 18.6 0 12 0Z"
        style="fill:${fill}"${ring}
      />
      ${glyph}
    </svg>
  `;

  return L.divIcon({
    html,
    className: "", // strip Leaflet's default marker box/background
    iconSize: [width, height],
    iconAnchor: [width / 2, height], // the pin's point touches the coordinate
  });
}
