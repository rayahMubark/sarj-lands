import type { LandType } from "./types";

const VARIANTS_PER_TYPE = 3;

// Deterministically picks one of the 3 representative images for a
// parcel's land type — the same parcel_id always resolves to the same
// image (stable across re-renders and sessions), rather than a random
// pick on each render. Driven by a hash of the id, not its position in
// any array, so the assignment doesn't shift if the portfolio's row order
// ever changes.
export function getParcelImagePath(parcelId: string, landType: LandType): string {
  const variant = (hashString(parcelId) % VARIANTS_PER_TYPE) + 1;
  return `/parcels/${landType}-${variant}.jpg`;
}

// A small, deterministic string hash (djb2-style). Not cryptographic —
// just needs to spread parcel_ids evenly across the 3 image variants.
function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}
