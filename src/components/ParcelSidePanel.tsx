import Link from "next/link";
import { formatNumber, formatTemplate } from "@/lib/format";
import {
  areaOfCityLabels,
  landTypeLabels,
  listingTypeLabels,
  useLanguage,
} from "@/lib/i18n";
import type { Parcel } from "@/lib/types";
import {
  ParcelVisual,
  PriceBlock,
  Tag,
  buildNeighbourhoodLine,
} from "@/components/ParcelCard";

// The map's selected-parcel panel. Slides in from the trailing edge on
// desktop (the right in LTR, the left in RTL) and becomes a bottom sheet on
// small screens. Reuses ParcelCard's visual/price building blocks so the
// map view and the card grid never drift apart visually.
export function ParcelSidePanel({
  parcel,
  onClose,
}: {
  parcel: Parcel;
  onClose: () => void;
}) {
  const { language, direction, t } = useLanguage();
  const district = language === "ar" ? parcel.district_ar : parcel.district_en;

  // Plays once on mount via CSS (see the panel-slide-* keyframes in
  // globals.css) — the parent gives this component a `key` of the
  // parcel_id, so selecting a different pin remounts it and the animation
  // replays. Physical direction, not logical: "in from the trailing edge"
  // is a different physical side in RTL vs LTR, unlike ordinary layout.
  const slideInAnimation =
    direction === "rtl"
      ? "animate-[panel-slide-up_300ms_ease-out] sm:animate-[panel-slide-from-start_300ms_ease-out]"
      : "animate-[panel-slide-up_300ms_ease-out] sm:animate-[panel-slide-from-end_300ms_ease-out]";

  return (
    <div
      // z-[1003]: above Leaflet's own controls (z-index 1000, see
      // leaflet.css) and above MapLegend's z-[1002], so the panel wins
      // when a pin is selected while the legend is also open.
      className={`absolute inset-x-0 bottom-0 z-[1003] flex max-h-[75%] flex-col overflow-hidden rounded-t-xl border-t border-hairline bg-background shadow-2xl sm:inset-x-auto sm:inset-y-0 sm:end-0 sm:top-0 sm:bottom-auto sm:h-full sm:max-h-none sm:w-full sm:max-w-sm sm:rounded-none sm:border-t-0 sm:border-s ${slideInAnimation}`}
    >
      {/* start (not end) so it never collides with ParcelVisual's own
          parcel_id tag, which anchors to the end. */}
      <button
        type="button"
        onClick={onClose}
        aria-label={t("closePanel")}
        className="absolute top-3 start-3 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-background/30 bg-background/20 text-background backdrop-blur-sm hover:bg-background/30"
      >
        <CloseIcon className="h-4 w-4" />
      </button>

      <ParcelVisual parcel={parcel} t={t} />

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
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

        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-hairline pt-3 text-xs text-muted">
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
          href={`/land/${parcel.parcel_id}`}
          className="mt-auto inline-flex items-center justify-center rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-background transition-colors hover:bg-primary/90"
        >
          {t("viewDetails")}
        </Link>
      </div>
    </div>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
