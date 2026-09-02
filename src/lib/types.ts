// Types inferred directly from data/sarj-lands-riyadh.json and
// data/investor-inquiries.json. Keep these in sync with the source files.

export type AreaOfCity = "Central" | "East" | "North" | "South" | "West";
export type LandType = "commercial" | "residential";
export type ListingType = "sale" | "lease";
export type ParcelStatus = "available" | "reserved" | "sold" | "leased";

interface ParcelBase {
  parcel_id: string;
  district_en: string;
  district_ar: string;
  area_of_city: AreaOfCity;
  land_type: LandType;
  area_sqm: number;
  street_width_m: number;
  status: ParcelStatus;
  listed_date: string; // "YYYY-MM-DD"
  days_on_market: number;
  lat: number;
  lng: number;
}

// PRICING RULE: sale parcels carry a total asking price; lease parcels carry
// an ANNUAL RENT. These are different scales and must never be mixed,
// sorted, or compared together — price_basis travels with every parcel so
// the UI can label "X SAR" vs "X SAR / year".
//
// SaleParcel is itself split on `priceOnRequest` so the type system enforces
// the missing-price case: when priceOnRequest is true, the price fields are
// `null` (unknown, never 0); when false, they are real numbers.
export type SaleParcel = ParcelBase & {
  listing_type: "sale";
  price_basis: "asking price";
} & (
    | {
        priceOnRequest: true;
        price_per_sqm_sar: null;
        total_price_sar: null;
      }
    | {
        priceOnRequest: false;
        price_per_sqm_sar: number;
        total_price_sar: number;
      }
  );

export type LeaseParcel = ParcelBase & {
  listing_type: "lease";
  price_basis: "annual rent";
  priceOnRequest: false;
  price_per_sqm_sar: number;
  total_price_sar: number; // annual rent, NOT a one-off total
};

export type Parcel = SaleParcel | LeaseParcel;

export type BudgetBasis = "total purchase" | "annual rent";
export type Intent = "ready to move" | "comparing options" | "exploring";
// "sanad" added for Part B: leads captured through the Sanad chat, on top
// of the four channels already present in the original 48 seed inquiries.
export type Channel =
  | "phone call"
  | "whatsapp"
  | "walk-in"
  | "website form"
  | "sanad";
export type InquiryStatus = "new" | "contacted" | "negotiating";

interface InquiryBase {
  inquiry_id: string;
  date: string; // "YYYY-MM-DD"
  investor_name: string;
  phone: string;
  wants_to: string;
  land_type_wanted: LandType;
  area_of_city_wanted: AreaOfCity;
  budget_sar: number;
  intent: Intent;
  channel: Channel;
  status: InquiryStatus;
}

// Mirrors the Parcel split: an inquiry's budget_sar means "total purchase"
// for a sale preference and "annual rent" for a lease preference.
export type SaleInquiry = InquiryBase & {
  prefers: "sale";
  budget_basis: "total purchase";
};

export type LeaseInquiry = InquiryBase & {
  prefers: "lease";
  budget_basis: "annual rent";
};

export type Inquiry = SaleInquiry | LeaseInquiry;

// A lead captured live by Sanad — either genuine interest in a real,
// available parcel, or unmet demand (a parcel_id that doesn't exist, or a
// type/area/budget combination nothing in the portfolio currently
// matches). record_type is what lets the future admin view split the two
// apart.
//
// Deliberately looser than Inquiry above: the 48 seed inquiries are
// complete, known-good data, so every field there is required. What a
// Sanad conversation captures can be genuinely partial — an unmet lead
// might only have a requested_parcel_id and no budget at all — and this
// app never invents a value the investor didn't actually give (the same
// rule SRE-013's priceOnRequest follows), so every field that isn't
// always knowable is nullable here instead of guessed.
export type SanadRecordType = "interest" | "unmet_lead";

export interface SanadInquiryRecord {
  inquiry_id: string; // display label, "INQ-049" onward — see sanadStore.ts
  internal_id: string; // UUIDv7, the true persistent identifier
  date: string; // "YYYY-MM-DD", the day it was captured
  investor_name: string;
  phone: string;
  wants_to: string; // optional free-text note from the form; "" if left blank
  record_type: SanadRecordType;
  parcel_id: string | null; // the real, available parcel this relates to, if any
  requested_parcel_id: string | null; // the raw parcel_id asked for, even when it doesn't exist
  land_type_wanted: LandType | null;
  area_of_city_wanted: AreaOfCity | null;
  prefers: ListingType | null;
  budget_sar: number | null;
  budget_basis: BudgetBasis | null;
  intent: Intent;
  channel: Channel;
  status: InquiryStatus;
}
