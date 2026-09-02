// The persistence layer for leads Sanad captures: genuine interest and
// unmet demand alike (see SanadInquiryRecord in ./types). Backed by
// localStorage — the original 48 seed inquiries stay static JSON
// (data.ts); this is the separate, growing store a future admin view
// reads to see what's come in live. Browser-only by nature (there is no
// server-side database here), so every export assumes it's called from a
// Client Component after hydration.
import { generateUuidV7 } from "./id";
import { LAST_SEED_SEQUENCE, SEED_SANAD_RECORDS } from "./sanadSeed";
import type { SanadInquiryRecord } from "./types";

// Exported so the admin dashboard's live feed (src/app/admin/page.tsx)
// can recognize this key in "storage" events fired by other tabs,
// without duplicating the literal string.
export const STORAGE_KEY = "sarj:sanad-inquiries";
// The 48 baseline inquiries occupy INQ-001..INQ-048 and the demo seeds
// continue to LAST_SEED_SEQUENCE — newly captured leads carry on from
// there rather than starting a numbering that collides with either.
const FIRST_SEQUENCE = LAST_SEED_SEQUENCE + 1;

// All Sanad-captured leads persisted so far, newest-last. Returns an
// empty list rather than throwing on any storage error (corrupted JSON,
// private-browsing restrictions) — a read failure should degrade to "no
// leads yet," never crash a caller.
export function getAllSanadInquiries(): SanadInquiryRecord[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// What the dashboard and admin-Sanad should actually SEE: the demo seed
// backlog (sanadSeed.ts) followed by everything this browser has really
// captured, oldest-first, matching getAllSanadInquiries' own ordering so
// callers can keep treating the list as newest-last.
//
// Deliberately separate from getAllSanadInquiries above, which stays a
// pure localStorage read: saveSanadInquiry writes that list straight back
// to storage, and merging seeds into it would persist the demo rows into
// the visitor's browser and re-save them on every submission.
//
// Safe to call during a server render — the seeds are static, and the
// localStorage half degrades to [] off the browser, so the prerendered
// HTML already contains the seeded inbox instead of an empty state.
export function getSanadInquiriesForDisplay(): SanadInquiryRecord[] {
  return [...SEED_SANAD_RECORDS, ...getAllSanadInquiries()];
}

// Persists one new lead and returns it with its ids assigned. Unlike the
// read above, this does NOT swallow errors: a failed write must not be
// reported to the investor as a successful "your request is logged" —
// the caller (SanadPanel) only shows that confirmation once this
// resolves without throwing.
export function saveSanadInquiry(
  input: Omit<SanadInquiryRecord, "inquiry_id" | "internal_id">
): SanadInquiryRecord {
  const existing = getAllSanadInquiries();
  const record: SanadInquiryRecord = {
    ...input,
    internal_id: generateUuidV7(),
    inquiry_id: buildDisplayId(existing),
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, record]));
  return record;
}

function buildDisplayId(existing: SanadInquiryRecord[]): string {
  const maxSequence = existing.reduce((max, record) => {
    const sequence = parseInt(record.inquiry_id.split("-")[1] ?? "", 10);
    return Number.isFinite(sequence) ? Math.max(max, sequence) : max;
  }, FIRST_SEQUENCE - 1);

  return `INQ-${String(maxSequence + 1).padStart(3, "0")}`;
}
