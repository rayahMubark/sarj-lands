// Number/string formatting shared by anything that renders parcel data.

import type { Language } from "./i18n";

// Thousands-grouped number, e.g. 2200000 -> "2,200,000". Western numerals
// on purpose — Saudi real-estate/fintech products conventionally keep
// digits in Western form even inside Arabic copy, so prices read the same
// in both languages.
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

// Fills "{key}" placeholders in a translated template string, e.g.
// formatTemplate("{count} results", { count: 12 }) -> "12 results".
export function formatTemplate(
  template: string,
  params: Record<string, string | number>
): string {
  return Object.entries(params).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template
  );
}

// Eastern Arabic-Indic digits (e.g. 15 -> "١٥"), for the rare spot where
// Arabic-numeral typography is wanted on purpose. Most of the app
// deliberately keeps Western digits even in Arabic copy (see formatNumber)
// — only use this where an editorial/prose line calls for it.
export function formatArabicIndicNumber(value: number): string {
  return new Intl.NumberFormat("ar", { numberingSystem: "arab" }).format(
    value
  );
}

// A "YYYY-MM-DD" date string as a long localized date, e.g. "12 يناير 2025"
// / "January 12, 2025". timeZone: "UTC" matters here: a date-only ISO
// string parses as UTC midnight, so formatting in the reader's local zone
// could roll the displayed day back by one west of UTC. numberingSystem:
// "latn" keeps the day/year in Western digits even in Arabic, per this
// app's numeral convention (see formatNumber above).
export function formatDate(isoDate: string, language: Language): string {
  return new Intl.DateTimeFormat(language === "ar" ? "ar" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
    numberingSystem: "latn",
  }).format(new Date(isoDate));
}
