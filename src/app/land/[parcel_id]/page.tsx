"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { formatDate, formatNumber, formatTemplate } from "@/lib/format";
import {
  landTypeLabels,
  listingTypeLabels,
  statusLabels,
  useLanguage,
} from "@/lib/i18n";
import { getParcelById } from "@/lib/data";
import { useSanad } from "@/lib/sanad";
import {
  ParcelVisual,
  PriceBlock,
  StatusBadge,
  buildNeighbourhoodLine,
} from "@/components/ParcelCard";
import type { Parcel } from "@/lib/types";

// Leaflet touches `window` at import time, so ParcelDetailMap cannot be
// part of the server-rendered bundle — same reason the browse page lazy-
// loads ParcelMapView (see src/app/page.tsx).
const ParcelDetailMap = dynamic(() => import("@/components/ParcelDetailMap"), {
  ssr: false,
  loading: () => <MapLoadingPlaceholder />,
});

// One parcel's full detail view: hero photo, title, an interactive map
// centered on it, its details, its price, and the two Sanad entry points
// that carry this parcel's id into a request or an inquiry. An unknown
// parcel_id (bad link, typo, a since-removed row) renders a clean
// not-found state instead of crashing — getParcelById returning
// undefined is an expected, handled case, not an error.
export default function LandDetailPage() {
  const { parcel_id: parcelId } = useParams<{ parcel_id: string }>();
  const parcel = getParcelById(parcelId);

  if (!parcel) {
    return <ParcelNotFound />;
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-10">
      <Hero parcel={parcel} />
      <TitleBlock parcel={parcel} />
      <ParcelDetailMap parcel={parcel} />
      <DetailsBlock parcel={parcel} />
      <PriceSection parcel={parcel} />
      <RequestCta parcel={parcel} />
    </div>
  );
}

function MapLoadingPlaceholder() {
  const { t } = useLanguage();

  return (
    <div className="flex h-[360px] w-full items-center justify-center rounded-xl border border-hairline bg-foreground/5">
      <p className="text-sm text-muted">{t("mapLoading")}</p>
    </div>
  );
}

function ParcelNotFound() {
  const { t } = useLanguage();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-3 px-6 py-24 text-center">
      <p className="font-heading text-2xl font-semibold text-primary">
        {t("parcelNotFoundTitle")}
      </p>
      <p className="text-sm text-muted">{t("parcelNotFoundHint")}</p>
      <Link
        href="/"
        className="mt-2 inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-background transition-colors hover:bg-primary/90"
      >
        {t("backToBrowse")}
      </Link>
    </div>
  );
}

// Reuses ParcelCard's own hero building block plus its status badge (see
// src/components/ParcelCard.tsx) so the detail page's photo, "Illustrative"
// disclosure, and status pill are pixel-identical to the browse card's —
// same image, same honesty label, just a bigger stage.
function Hero({ parcel }: { parcel: Parcel }) {
  const { language, t } = useLanguage();

  return (
    <div className="relative overflow-hidden rounded-2xl border border-hairline">
      <ParcelVisual parcel={parcel} t={t} />
      <StatusBadge label={statusLabels[parcel.status][language]} />
    </div>
  );
}

function TitleBlock({ parcel }: { parcel: Parcel }) {
  const { language, t } = useLanguage();
  const district = language === "ar" ? parcel.district_ar : parcel.district_en;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="font-heading text-3xl font-semibold text-primary sm:text-4xl">
          {district}
        </h1>
        {/* font-serif (not font-heading): the parcel_id is a Latin/numeric
            code, always in Playfair Display — see ParcelVisual's own tag. */}
        <span className="font-serif text-sm font-semibold text-muted">
          {parcel.parcel_id}
        </span>
      </div>
      <p className="text-sm text-muted">
        {buildNeighbourhoodLine(parcel, language, t)}
      </p>
    </div>
  );
}

// Every field the brief asks for, each as one of the same "label: value"
// templated sentences the browse card already uses for area/street width
// (see areaValue/streetWidthValue in src/lib/i18n.ts) — one convention for
// every fact about a parcel, rather than a second layout style just for
// this page. The secondary "Ask Sanad" CTA lives here, right against the
// facts a reader would be asking about.
function DetailsBlock({ parcel }: { parcel: Parcel }) {
  const { language, t } = useLanguage();
  const { openSanad } = useSanad();

  const rows = [
    formatTemplate(t("landTypeValue"), {
      value: landTypeLabels[parcel.land_type][language],
    }),
    formatTemplate(t("listingTypeValue"), {
      value: listingTypeLabels[parcel.listing_type][language],
    }),
    formatTemplate(t("areaValue"), { value: formatNumber(parcel.area_sqm) }),
    formatTemplate(t("streetWidthValue"), {
      value: formatNumber(parcel.street_width_m),
    }),
    formatTemplate(t("daysOnMarketValue"), {
      value: formatNumber(parcel.days_on_market),
    }),
    formatTemplate(t("listedDateValue"), {
      value: formatDate(parcel.listed_date, language),
    }),
    formatTemplate(t("statusValue"), {
      value: statusLabels[parcel.status][language],
    }),
  ];

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-hairline p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="section-label">{t("detailsSectionLabel")}</span>
        <button
          type="button"
          onClick={() =>
            openSanad({ parcelId: parcel.parcel_id, mode: "inquiry" })
          }
          className="rounded-full border border-hairline px-3.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:border-primary"
        >
          {t("askSanadAboutLand")}
        </button>
      </div>
      <ul className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm text-foreground sm:grid-cols-2">
        {rows.map((row) => (
          <li key={row}>{row}</li>
        ))}
      </ul>
    </div>
  );
}

// The price is this page's second-most prominent element after the hero
// photo — its own bordered section, not folded into the details grid, so
// it reads at a glance. PriceBlock itself (shared with the browse card)
// already handles every pricing rule: sale total vs. lease annual rent
// vs. SRE-013's "price on request" — untouched here.
function PriceSection({ parcel }: { parcel: Parcel }) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-hairline p-6">
      <span className="section-label">{t("priceSectionLabel")}</span>
      <PriceBlock parcel={parcel} t={t} />
    </div>
  );
}

// The page's single primary call to action — full-width, high-contrast,
// anchored at the very bottom where a reader lands after reviewing every
// fact above. Sanad is the only path from here: no separate form, no
// WhatsApp button (see src/lib/sanad.ts).
function RequestCta({ parcel }: { parcel: Parcel }) {
  const { t } = useLanguage();
  const { openSanad } = useSanad();

  return (
    <button
      type="button"
      onClick={() =>
        openSanad({ parcelId: parcel.parcel_id, mode: "request" })
      }
      className="inline-flex w-full items-center justify-center rounded-full bg-primary px-6 py-4 text-base font-semibold text-background transition-colors hover:bg-primary/90"
    >
      {t("requestThisLand")}
    </button>
  );
}
