import type { ParcelStatus } from "./types";

// Single source of truth for status -> pin color, read by both the
// Leaflet markers (ParcelMapView) and the on-map legend (MapLegend) — so
// a legend swatch is always the exact pin color, never an approximation
// that could quietly drift out of sync. Values are CSS custom properties
// (defined in globals.css) rather than raw hex, for the same reason: one
// definition, two consumers.
export const STATUS_PIN_COLORS: Record<ParcelStatus, string> = {
  available: "var(--status-available)",
  reserved: "var(--status-reserved)",
  sold: "var(--status-sold)",
  leased: "var(--status-leased)",
};
