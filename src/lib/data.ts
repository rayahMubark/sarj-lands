import parcelsJson from "../../data/sarj-lands-riyadh.json";
import inquiriesJson from "../../data/investor-inquiries.json";
import type {
  Parcel,
  Inquiry,
  AreaOfCity,
  LandType,
  ListingType,
  ParcelStatus,
  BudgetBasis,
  Intent,
  Channel,
  InquiryStatus,
} from "./types";

// Shape of the raw JSON rows, before corrections/derived fields are applied.
interface RawParcel {
  parcel_id: string;
  district_en: string;
  district_ar: string;
  area_of_city: AreaOfCity;
  land_type: LandType;
  listing_type: ListingType;
  price_basis: "asking price" | "annual rent";
  area_sqm: number;
  price_per_sqm_sar: number | null;
  total_price_sar: number | null;
  street_width_m: number;
  status: ParcelStatus;
  listed_date: string;
  days_on_market: number;
  lat: number;
  lng: number;
}

interface RawInquiry {
  inquiry_id: string;
  date: string;
  investor_name: string;
  phone: string;
  wants_to: string;
  land_type_wanted: LandType;
  area_of_city_wanted: AreaOfCity;
  prefers: ListingType;
  budget_sar: number;
  budget_basis: BudgetBasis;
  intent: Intent;
  channel: Channel;
  status: InquiryStatus;
}

function toParcel(raw: RawParcel): Parcel {
  let { lat, lng } = raw;

  // COORDINATE FIX: SRE-098 has lat/lng transposed in the source JSON
  // (lat ~46.6, lng ~24.5 — impossible for Riyadh, which sits at ~24.6N,
  // 46.7E). Swap them here, on load, so the source file stays untouched
  // and every consumer sees valid coordinates.
  if (raw.parcel_id === "SRE-098") {
    [lat, lng] = [lng, lat];
  }

  const base = {
    parcel_id: raw.parcel_id,
    district_en: raw.district_en,
    district_ar: raw.district_ar,
    area_of_city: raw.area_of_city,
    land_type: raw.land_type,
    area_sqm: raw.area_sqm,
    street_width_m: raw.street_width_m,
    status: raw.status,
    listed_date: raw.listed_date,
    days_on_market: raw.days_on_market,
    lat,
    lng,
  };

  if (raw.listing_type === "lease") {
    // No lease parcel in the source data has a missing price.
    return {
      ...base,
      listing_type: "lease",
      price_basis: "annual rent",
      priceOnRequest: false,
      price_per_sqm_sar: raw.price_per_sqm_sar as number,
      total_price_sar: raw.total_price_sar as number,
    };
  }

  // MISSING PRICE: SRE-013 has null price_per_sqm_sar / total_price_sar in
  // the source JSON. We do not invent a number. It stays in the portfolio
  // (it's still 'available') but is flagged priceOnRequest so the UI can
  // show "Price on request" and budget-matching code can exclude it instead
  // of treating the missing price as free or dropping the parcel.
  if (raw.total_price_sar === null) {
    return {
      ...base,
      listing_type: "sale",
      price_basis: "asking price",
      priceOnRequest: true,
      price_per_sqm_sar: null,
      total_price_sar: null,
    };
  }

  return {
    ...base,
    listing_type: "sale",
    price_basis: "asking price",
    priceOnRequest: false,
    price_per_sqm_sar: raw.price_per_sqm_sar as number,
    total_price_sar: raw.total_price_sar,
  };
}

function toInquiry(raw: RawInquiry): Inquiry {
  if (raw.prefers === "lease") {
    return { ...raw, prefers: "lease", budget_basis: "annual rent" };
  }
  return { ...raw, prefers: "sale", budget_basis: "total purchase" };
}

export const parcels: Parcel[] = (parcelsJson as RawParcel[]).map(toParcel);
export const inquiries: Inquiry[] = (inquiriesJson as RawInquiry[]).map(
  toInquiry
);

export function getAvailableParcels(): Parcel[] {
  return parcels.filter((p) => p.status === "available");
}

export function getParcelById(id: string): Parcel | undefined {
  return parcels.find((p) => p.parcel_id === id);
}
