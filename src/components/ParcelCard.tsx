import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  formatArabicIndicNumber,
  formatNumber,
  formatTemplate,
} from "@/lib/format";
import {
  areaOfCityCompoundLabels,
  areaOfCityLabels,
  landTypeLabels,
  listingTypeLabels,
  statusLabels,
  useLanguage,
  type Language,
  type TranslationKey,
} from "@/lib/i18n";
import { getParcelImagePath } from "@/lib/parcelImage";
import type { Parcel } from "@/lib/types";

// One parcel in the browse grid: a representative image, district + a
// data-derived character line, a price block, and secondary size details.
// The whole card links to the parcel's detail page at /land/[parcel_id];
// a "View on map" link inside it makes the map affordance explicit ahead
// of that page's real map.
export function ParcelCard({ parcel }: { parcel: Parcel }) {
  const { language, t } = useLanguage();
  const isAvailable = parcel.status === "available";
  const district = language === "ar" ? parcel.district_ar : parcel.district_en;
  const href = `/land/${parcel.parcel_id}`;

  return (
    <div
      className={`relative flex flex-col overflow-hidden rounded-xl border border-hairline bg-background transition-[translate,box-shadow] duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_24px_48px_-16px_rgba(59,46,126,0.35)] ${
        isAvailable ? "" : "opacity-60"
      }`}
    >
      {/* Stretched link: makes the whole card clickable without nesting an
          <a> inside the "View on map" link below (invalid HTML — browsers
          silently mangle nested anchors). Both links share the same href,
          so there's no ambiguity about where a click on the card lands. */}
      <Link href={href} aria-label={district} className="absolute inset-0 z-0">
        <span className="sr-only">{district}</span>
      </Link>

      <div className="pointer-events-none relative">
        <ParcelVisual parcel={parcel} t={t} />
        <StatusBadge label={statusLabels[parcel.status][language]} />
      </div>

      <div className="pointer-events-none relative flex flex-1 flex-col gap-4 p-5">
        <div className="flex flex-col gap-1">
          <h3 className="font-heading text-xl font-semibold text-primary">
            {district}
          </h3>
          <p className="text-xs text-muted">
            {buildNeighbourhoodLine(parcel, language, t)}
          </p>
          <div className="flex flex-wrap gap-1.5 pt-0.5 text-[11px]">
            <Tag>{areaOfCityLabels[parcel.area_of_city][language]}</Tag>
            <Tag>{landTypeLabels[parcel.land_type][language]}</Tag>
            <Tag>{listingTypeLabels[parcel.listing_type][language]}</Tag>
          </div>
        </div>

        <PriceBlock parcel={parcel} t={t} />

        <div className="mt-auto flex flex-col gap-2 border-t border-hairline pt-3">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            <span>
              {formatTemplate(t("areaValue"), {
                value: formatNumber(parcel.area_sqm),
              })}
            </span>
            <span>
              {formatTemplate(t("streetWidthValue"), {
                value: formatNumber(parcel.street_width_m),
              })}
            </span>
          </div>

          <Link
            href={href}
            className="pointer-events-auto relative z-10 inline-flex w-fit items-center gap-1.5 text-xs font-medium text-primary underline decoration-hairline underline-offset-4 hover:decoration-primary"
          >
            <MapPinIcon className="h-3.5 w-3.5" />
            {t("viewOnMap")}
          </Link>
        </div>
      </div>
    </div>
  );
}

// Exported alongside ParcelCard so the map view's side panel (a different
// layout, same visual language) can reuse these instead of re-implementing
// them — see src/components/ParcelSidePanel.tsx.

// The neighbourhood-character line is composed only from real fields —
// land_type, area_of_city, and street_width_m — never an invented
// description. Street width renders in Arabic-Indic numerals in AR mode
// ("شارع ١٥م"): an intentional exception to the app's usual Western-digit
// convention (see formatNumber), for this one editorial/prose line.
export function buildNeighbourhoodLine(
  parcel: Parcel,
  language: Language,
  t: (key: TranslationKey) => string
): string {
  const width =
    language === "ar"
      ? formatArabicIndicNumber(parcel.street_width_m)
      : formatNumber(parcel.street_width_m);

  return formatTemplate(t("neighbourhoodLine"), {
    landType: landTypeLabels[parcel.land_type][language],
    area: areaOfCityCompoundLabels[parcel.area_of_city][language],
    width,
  });
}

// PRICING RULE: a sale parcel's number is a one-off total; a lease
// parcel's is annual rent. They're never rendered as the same kind of
// figure — lease always carries the "/year" suffix, sale never does.
export function PriceBlock({
  parcel,
  t,
}: {
  parcel: Parcel;
  t: (key: TranslationKey) => string;
}) {
  if (parcel.priceOnRequest) {
    return (
      <p className="font-heading text-2xl font-semibold text-primary">
        {t("priceOnRequest")}
      </p>
    );
  }

  const suffix = parcel.listing_type === "lease" ? ` ${t("perYearSuffix")}` : "";

  // The price is the strongest element in the card body — deliberately
  // larger and bolder than the district heading above it.
  return (
    <div>
      <p className="font-heading text-3xl font-bold text-primary">
        {formatNumber(parcel.total_price_sar)}
        <span className="ms-1.5 font-sans text-sm font-normal text-muted">
          {t("sar")}
          {suffix}
        </span>
      </p>
      <p className="text-xs text-muted">
        {formatTemplate(t("perSqmValue"), {
          value: formatNumber(parcel.price_per_sqm_sar),
        })}
      </p>
    </div>
  );
}

// The card hero: a representative image for the parcel's land type (see
// getParcelImagePath — deterministic per parcel_id, so this is stable
// across re-renders), the parcel_id as a small tag, and an "Illustrative"
// disclosure tag so it's never mistaken for a photo of the actual plot.
// The status badge is layered on top by the caller (ParcelCard), not
// here, since ParcelSidePanel reuses this without one.
export function ParcelVisual({
  parcel,
  t,
}: {
  parcel: Parcel;
  t: (key: TranslationKey) => string;
}) {
  return (
    <div className="relative aspect-4/3 w-full overflow-hidden bg-hairline">
      <Image
        src={getParcelImagePath(parcel.parcel_id, parcel.land_type)}
        alt=""
        fill
        sizes="(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw"
        className="object-cover"
      />

      {/* font-serif (not font-heading): the parcel_id is a Latin/numeric
          code, so it always renders in Playfair Display, even in Arabic. */}
      <span className="absolute top-3 end-3 rounded-full border border-background/30 bg-background/20 px-2 py-0.5 font-serif text-[11px] font-semibold text-background backdrop-blur-sm">
        {parcel.parcel_id}
      </span>

      <span className="absolute bottom-2 start-2 rounded bg-foreground/70 px-1.5 py-0.5 text-[9px] font-medium tracking-wide text-background backdrop-blur-sm">
        {t("illustrativeLabel")}
      </span>
    </div>
  );
}

// Logical positioning (start/top): this badge is UI chrome layered over
// the generated art, not part of an image, so it mirrors with the rest of
// the interface in RTL. A frosted glass pill reads cleanly against the
// rich dark hero — a solid fill would either vanish into it or fight it.
// Exported so the land detail page's hero (a different layout, same
// visual language) can reuse it instead of re-implementing it.
export function StatusBadge({ label }: { label: string }) {
  return (
    <span className="absolute top-3 start-3 rounded-full border border-background/30 bg-background/20 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-background uppercase backdrop-blur-sm">
      {label}
    </span>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-hairline px-2 py-0.5 text-muted">
      {children}
    </span>
  );
}

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}
