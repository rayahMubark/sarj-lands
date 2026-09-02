// DEMO SEED DATA — these four leads stand in for the server-side database
// a production build of this dashboard would read.
//
// Why they exist: Sanad's captured leads live in the visitor's own
// localStorage (see sanadStore.ts), which is empty for anyone opening the
// deployed link for the first time. Without these, the Requests inbox —
// the whole investor -> leadership loop this product is built around —
// renders as an empty state to every first-time visitor, and admin-Sanad
// is told "no investor has used Sanad's live chat" even though the
// feature works. Seeding a realistic backlog makes the loop legible on
// first load, exactly as a real deployment reading a real database would.
//
// In production this file is deleted and sanadStore.ts reads the same
// shape from the API instead. Anything a real visitor submits is appended
// alongside these and rendered identically (see
// getSanadInquiriesForDisplay), so the inbox never looks staged.
//
// Every person here is fictional; the phone numbers are made up. The
// PARCELS and the gaps they point at are not — each interest record names
// a real, currently-available parcel, and the North-commercial request is
// a real hole in the portfolio (Sarj owns zero North commercial parcels
// of any status, which is also the dashboard's own headline finding).
import type { SanadInquiryRecord } from "./types";

// Fixed dates and fixed internal_ids, never Date.now()/randomUUID():
// these values are rendered during the server prerender and again during
// hydration, so anything non-deterministic here would produce a React
// hydration mismatch. They sit just after the 48 baseline inquiries
// (which end 2026-08-08) and on/just before the data snapshot date of
// 11 August 2026, so the timeline reads consistently with the portfolio.
export const SEED_SANAD_RECORDS: readonly SanadInquiryRecord[] = [
  {
    inquiry_id: "INQ-049",
    internal_id: "0191f2a0-0001-7000-8000-5a726a736565",
    date: "2026-08-09",
    investor_name: "Faisal Al-Dossari",
    phone: "0553114820",
    wants_to: "build a family home",
    record_type: "interest",
    // SRE-041 — Al Rabie / الربيع, North, residential, sale, available.
    parcel_id: "SRE-041",
    requested_parcel_id: null,
    land_type_wanted: "residential",
    area_of_city_wanted: "North",
    prefers: "sale",
    budget_sar: 3284000,
    budget_basis: "total purchase",
    intent: "ready to move",
    channel: "sanad",
    status: "new",
    seed: true,
  },
  {
    inquiry_id: "INQ-050",
    internal_id: "0191f2a0-0002-7000-8000-5a726a736565",
    date: "2026-08-10",
    investor_name: "Hessa Al-Mutairi",
    phone: "0561947305",
    wants_to: "open a warehouse",
    record_type: "interest",
    // SRE-078 — Al Mashael / المشاعل, South, commercial, LEASE, available.
    // budget_sar is therefore an annual rent, not a purchase total.
    parcel_id: "SRE-078",
    requested_parcel_id: null,
    land_type_wanted: "commercial",
    area_of_city_wanted: "South",
    prefers: "lease",
    budget_sar: 3214000,
    budget_basis: "annual rent",
    intent: "comparing options",
    channel: "sanad",
    status: "new",
    seed: true,
  },
  {
    inquiry_id: "INQ-051",
    internal_id: "0191f2a0-0003-7000-8000-5a726a736565",
    date: "2026-08-10",
    investor_name: "Abdulrahman Al-Ghamdi",
    phone: "0544028176",
    wants_to: "open a car showroom",
    record_type: "unmet_lead",
    // The portfolio holds ZERO North commercial parcels, so this is
    // demand Sarj genuinely cannot serve today — the same gap the
    // dashboard's demand-vs-supply section calls out as its top finding.
    parcel_id: null,
    requested_parcel_id: null,
    land_type_wanted: "commercial",
    area_of_city_wanted: "North",
    prefers: "sale",
    budget_sar: 4500000,
    budget_basis: "total purchase",
    intent: "ready to move",
    channel: "sanad",
    status: "new",
    seed: true,
  },
  {
    inquiry_id: "INQ-052",
    internal_id: "0191f2a0-0004-7000-8000-5a726a736565",
    date: "2026-08-11",
    investor_name: "Lama Al-Qahtani",
    phone: "0577360941",
    wants_to: "build apartments to rent",
    record_type: "unmet_lead",
    // The other unmet shape: an investor asking for a parcel_id that
    // isn't in the portfolio at all. requested_parcel_id keeps what they
    // actually asked for rather than discarding it.
    parcel_id: null,
    requested_parcel_id: "SRE-207",
    land_type_wanted: "residential",
    area_of_city_wanted: "West",
    prefers: "lease",
    budget_sar: 240000,
    budget_basis: "annual rent",
    intent: "exploring",
    channel: "sanad",
    status: "new",
    seed: true,
  },
];

// The highest INQ-nnn the seeds occupy. sanadStore.ts numbers newly
// captured leads from here on, so a real submission can never collide
// with a seed's display id.
export const LAST_SEED_SEQUENCE = SEED_SANAD_RECORDS.length + 48;
