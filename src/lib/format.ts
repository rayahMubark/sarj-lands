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

// A large SAR figure as a short editorial number — 126523000 -> "126.5" /
// "١٢٦٫٥", 2054000 -> "2.0" / "٢٫٠" — for the dashboard's headline
// "money on the gap" lines, where the exact riyal is noise and the order
// of magnitude is the whole point. Returns the NUMBER only; the caller
// supplies the "million SAR" unit from the dictionary so the wording stays
// translatable (see demandMoneySale / demandMoneyLease in ./i18n).
//
// Arabic gets Arabic-Indic digits and its own decimal mark (٫), unlike the
// app's usual Western-digits rule: this is an editorial prose sentence,
// the same exception the browse hero's "١٢٠ أرضًا" stat badges make (see
// formatArabicIndicNumber). Precise figures elsewhere on this dashboard —
// the KPI cards, the tables — keep formatNumber's exact grouped digits.
//
// Precision is magnitude-dependent, and that is the point. One decimal
// place is right for a large figure (126,523,000 -> "126.5"), but on a
// small one it silently overstates: 2,054,000 would round to "2.1", a
// number 46,000 SAR larger than the truth, printed next to a claim about
// money Sarj is missing. Below 10 million the second decimal costs one
// character and removes that ("2.05"). This is the display-side twin of
// the PRECISION rule admin-Sanad follows in src/lib/sanadAdminPrompt.ts —
// never round a figure up past what the data actually says.
//
// Worst-case error is then ~5,000 SAR under 10M and ~50,000 SAR above it
// (under 0.5% of the figure either way), and the exact riyal is always
// still reachable through the per-segment data behind these headlines.
const MILLIONS_TWO_DECIMAL_CEILING = 10;

export function formatMillionsSar(valueSar: number, language: Language): string {
  const millions = valueSar / 1_000_000;
  const fractionDigits =
    Math.abs(millions) < MILLIONS_TWO_DECIMAL_CEILING ? 2 : 1;

  return new Intl.NumberFormat(language === "ar" ? "ar" : "en-US", {
    numberingSystem: language === "ar" ? "arab" : "latn",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(millions);
}

// The same millions figure for a COMPACT data chip rather than an
// editorial sentence — always Western digits, matching formatNumber and
// therefore the counts such a chip sits beside. Without this, a gap's pill
// row renders "8 مستثمرين · ١٧٫٨ مليون ريال · 0 متاح", mixing two numeral
// systems inside one line; the editorial headline above it stays
// Arabic-Indic because it is prose, not a chip.
export function formatMillionsSarCompact(valueSar: number): string {
  return formatMillionsSar(valueSar, "en");
}

// The same editorial treatment for a plain count ("6 of 17"): Arabic-Indic
// in Arabic, Western in English. Separate from formatNumber, which stays
// Western in both languages for prices and table cells.
export function formatEditorialCount(value: number, language: Language): string {
  return language === "ar" ? formatArabicIndicNumber(value) : formatNumber(value);
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
