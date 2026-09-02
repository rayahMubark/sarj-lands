import type { Parcel, ParcelStatus } from "./types";

// Display priority when a mixed-status list is shown: the most actionable
// inventory leads, sold trails last since it's no longer purchasable.
const STATUS_DISPLAY_PRIORITY: Record<ParcelStatus, number> = {
  available: 0,
  reserved: 1,
  leased: 2,
  sold: 3,
};

// Orders parcels for display wherever a mixed-status list is shown (e.g.
// the browse page's card grid): available first, then reserved, then
// leased, sold last. Within a status group, breaks ties by area_sqm
// ascending — not price, which would mean comparing a sale parcel's total
// against a lease parcel's annual rent, the exact mixing the rest of this
// app is careful never to do (see PriceBlock in ParcelCard.tsx). When the
// list is already narrowed to one status (e.g. the Status filter isn't
// "all"), every parcel ties on the status key and this is just an area
// sort — harmless, and exactly what "this ordering is moot" describes.
//
// Pure and non-mutating: returns a new array, doesn't reorder its input.
export function sortParcelsForDisplay(parcelsToSort: Parcel[]): Parcel[] {
  return [...parcelsToSort].sort((a, b) => {
    const statusDelta =
      STATUS_DISPLAY_PRIORITY[a.status] - STATUS_DISPLAY_PRIORITY[b.status];
    if (statusDelta !== 0) return statusDelta;
    return a.area_sqm - b.area_sqm;
  });
}
