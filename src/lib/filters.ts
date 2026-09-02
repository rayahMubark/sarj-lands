import type {
  AreaOfCity,
  LandType,
  ListingType,
  Parcel,
  ParcelStatus,
} from "./types";

export interface FilterState {
  areaOfCity: AreaOfCity | "all";
  landType: LandType | "all";
  listingType: ListingType | "all";
  status: ParcelStatus | "all";
  saleMaxPrice: number | null; // total asking price cap, SAR — null = no cap
  leaseMaxPrice: number | null; // annual rent cap, SAR/year — null = no cap
  minAreaSqm: number | null;
  maxAreaSqm: number | null;
}

// The browse page opens showing the whole 120-parcel portfolio — Map view
// is the default landing view, and the point of a map is to show the full
// distribution (color-coded by status) rather than pre-narrowing it. The
// Status filter still narrows from here in either view.
export const DEFAULT_FILTERS: FilterState = {
  areaOfCity: "all",
  landType: "all",
  listingType: "all",
  status: "all",
  saleMaxPrice: null,
  leaseMaxPrice: null,
  minAreaSqm: null,
  maxAreaSqm: null,
};

export interface NumericBounds {
  min: number;
  max: number;
}

// Applies every browse-page filter to a parcel list. Pure and synchronous —
// the whole portfolio is 120 rows, so re-filtering on every keystroke or
// slider tick is effectively instant; no debouncing needed.
export function filterParcels(
  allParcels: Parcel[],
  filters: FilterState
): Parcel[] {
  return allParcels.filter((parcel) => {
    if (filters.status !== "all" && parcel.status !== filters.status) {
      return false;
    }
    if (
      filters.areaOfCity !== "all" &&
      parcel.area_of_city !== filters.areaOfCity
    ) {
      return false;
    }
    if (filters.landType !== "all" && parcel.land_type !== filters.landType) {
      return false;
    }
    if (
      filters.listingType !== "all" &&
      parcel.listing_type !== filters.listingType
    ) {
      return false;
    }
    if (filters.minAreaSqm !== null && parcel.area_sqm < filters.minAreaSqm) {
      return false;
    }
    if (filters.maxAreaSqm !== null && parcel.area_sqm > filters.maxAreaSqm) {
      return false;
    }
    return matchesBudget(parcel, filters);
  });
}

// The min/max known total_price_sar among parcels of one listing type —
// sizes that type's budget slider. Sale and lease are read from separate
// pools on purpose: sale prices are one-off totals, lease prices are
// annual rent, and the two scales must never be blended into one range.
// Returns null if no parcel of that type has a resolvable price.
export function getPriceBoundsSar(
  allParcels: Parcel[],
  listingType: ListingType
): NumericBounds | null {
  const prices = allParcels
    .filter(
      (parcel) => parcel.listing_type === listingType && !parcel.priceOnRequest
    )
    .map((parcel) => parcel.total_price_sar as number);

  if (prices.length === 0) return null;
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

// The min/max area_sqm across every parcel — sizes the size filter.
export function getAreaBoundsSqm(allParcels: Parcel[]): NumericBounds {
  const areas = allParcels.map((parcel) => parcel.area_sqm);
  return { min: Math.min(...areas), max: Math.max(...areas) };
}

// A sale parcel's price is a one-off total; a lease parcel's is annual
// rent. Each budget cap is matched only against parcels of its own
// listing_type, so a sale cap can never filter out a lease parcel or vice
// versa. A priceOnRequest parcel (SRE-013) has no verifiable price: it
// stays visible until a cap is actually set for its listing type, at which
// point it's excluded rather than assumed to fit the budget.
function matchesBudget(parcel: Parcel, filters: FilterState): boolean {
  if (parcel.listing_type === "sale") {
    if (filters.saleMaxPrice === null) return true;
    if (parcel.priceOnRequest) return false;
    return parcel.total_price_sar <= filters.saleMaxPrice;
  }

  if (filters.leaseMaxPrice === null) return true;
  return parcel.total_price_sar <= filters.leaseMaxPrice;
}
