"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { FilterBar, type PriceBoundsByListing } from "@/components/FilterBar";
import { ParcelCard } from "@/components/ParcelCard";
import type { ViewMode } from "@/components/ViewToggle";
import { portfolioStats, type PortfolioStats } from "@/lib/analytics";
import { formatArabicIndicNumber, formatNumber } from "@/lib/format";
import {
  DEFAULT_FILTERS,
  filterParcels,
  getAreaBoundsSqm,
  getPriceBoundsSar,
  type FilterState,
} from "@/lib/filters";
import { useLanguage } from "@/lib/i18n";
import { parcels } from "@/lib/data";
import { sortParcelsForDisplay } from "@/lib/sort";
import type { Parcel } from "@/lib/types";

// The results region the hero's primary CTA scrolls to — see
// scrollToLands in HeroBand below.
const LANDS_SECTION_ID = "lands";

// Leaflet touches `window` at import time, so it cannot be part of the
// server-rendered bundle. ssr:false plus only rendering <ParcelMapView>
// while viewMode is "map" (below) means its whole module — Leaflet,
// react-leaflet, the CSS — is still code-split into its own lazily-fetched
// chunk, not bundled into the initial page load, even though Map is the
// default view a reader lands on. Switching to List never re-fetches it.
const ParcelMapView = dynamic(() => import("@/components/ParcelMapView"), {
  ssr: false,
  loading: () => <MapLoadingPlaceholder />,
});

// The investor's main discovery experience: a branded header band, a
// sticky filter bar, and a List/Map toggle over the results. Filtering
// runs entirely client-side against the static 120-parcel portfolio, and
// the same filtered list drives both the card grid and the map's pins.
export default function Home() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [viewMode, setViewMode] = useState<ViewMode>("map");

  const priceBounds = useMemo<PriceBoundsByListing>(
    () => ({
      sale: getPriceBoundsSar(parcels, "sale"),
      lease: getPriceBoundsSar(parcels, "lease"),
    }),
    []
  );
  const areaBounds = useMemo(() => getAreaBoundsSqm(parcels), []);
  // Same portfolio-wide counts the admin dashboard's own overview reads
  // (see src/lib/analytics.ts) — one source of truth for "how big is the
  // portfolio," rather than the hero recomputing its own availableCount.
  const stats = useMemo(() => portfolioStats(), []);
  const filteredParcels = useMemo(
    () => filterParcels(parcels, filters),
    [filters]
  );
  // List view only — pin placement on the map doesn't have a "reading
  // order," so there's nothing for this to affect there. See
  // sortParcelsForDisplay for why available leads and sold trails.
  const sortedListParcels = useMemo(
    () => sortParcelsForDisplay(filteredParcels),
    [filteredParcels]
  );

  return (
    <div className="flex flex-1 flex-col">
      <HeroBand stats={stats} />
      <div id={LANDS_SECTION_ID} className="flex flex-1 flex-col">
        <FilterBar
          filters={filters}
          onChange={setFilters}
          priceBounds={priceBounds}
          areaBounds={areaBounds}
          resultCount={filteredParcels.length}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
        {viewMode === "map" ? (
          <ParcelMapView parcels={filteredParcels} />
        ) : (
          <ResultsGrid parcels={sortedListParcels} />
        )}
      </div>
    </div>
  );
}

function MapLoadingPlaceholder() {
  const { t } = useLanguage();

  return (
    <div className="flex h-[70vh] min-h-[420px] w-full items-center justify-center border-y border-hairline bg-foreground/5">
      <p className="text-sm text-muted">{t("mapLoading")}</p>
    </div>
  );
}

// The site's front door: eyebrow, serif headline, subtext, three live
// portfolio stats as their own badges (not folded into one sentence, so
// each number reads as its own fact — see StatBadge), and a single path
// forward into the listings. `brand-grain` is the same textured violet
// wash the about page's own intro band opens with (see IntroSection in
// src/app/about/page.tsx), so the two read as one consistent treatment
// rather than an arbitrary tinted section unique to this page.
//
// Deliberately one button, not two: this used to also carry a "Talk to
// Sanad" button, but Sanad already has a persistent floating launcher on
// every page (see SanadPanel.tsx) — repeating it here just diluted both.
function HeroBand({ stats }: { stats: PortfolioStats }) {
  const { t, language } = useLanguage();

  // Eastern Arabic-Indic digits in Arabic (١٢٠), Western in English (120)
  // — see formatArabicIndicNumber's own docstring for why this is the one
  // deliberate exception to the app's usual Western-digits-everywhere rule:
  // this is prose ("120 lands"), not a price or a form value.
  const formatStat = language === "ar" ? formatArabicIndicNumber : formatNumber;

  function scrollToLands() {
    document
      .getElementById(LANDS_SECTION_ID)
      ?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="brand-grain border-b border-hairline px-6 py-20 sm:py-28">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 text-center">
        <p className="section-label">{t("heroEyebrow")}</p>
        <h1 className="font-heading text-4xl font-semibold leading-tight text-primary sm:text-5xl">
          {t("heroHeadline")}
        </h1>
        <p className="max-w-xl text-sm text-foreground/80 sm:text-base">
          {t("heroSubtext")}
        </p>

        <div className="mt-4 flex items-center justify-center gap-6 sm:gap-10">
          <StatBadge value={formatStat(stats.totalParcels)} label={t("heroStatLandsLabel")} />
          <StatDivider />
          <StatBadge
            value={formatStat(stats.uniqueDistrictCount)}
            label={t("heroStatDistrictsLabel")}
          />
          <StatDivider />
          <StatBadge value={formatStat(stats.availableCount)} label={t("heroStatAvailableLabel")} />
        </div>

        <button
          type="button"
          onClick={scrollToLands}
          className="mt-4 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-background transition-colors hover:bg-primary/90"
        >
          {t("heroPrimaryCta")}
        </button>
      </div>
    </div>
  );
}

// One portfolio fact as its own badge — a large serif number over a
// small muted label — rather than one run-on sentence, so "120", "88",
// and "62" each land as a distinct, scannable claim.
function StatBadge({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="font-heading text-2xl font-semibold text-primary sm:text-3xl">
        {value}
      </span>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}

function StatDivider() {
  return <div aria-hidden="true" className="h-8 w-px bg-hairline" />;
}

function ResultsGrid({ parcels: results }: { parcels: Parcel[] }) {
  const { t } = useLanguage();

  if (results.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center gap-2 px-6 py-24 text-center">
        <p className="font-heading text-xl font-semibold text-primary">
          {t("noResults")}
        </p>
        <p className="text-sm text-muted">{t("noResultsHint")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 px-6 py-10 sm:grid-cols-2 lg:grid-cols-3">
      {results.map((parcel) => (
        <ParcelCard key={parcel.parcel_id} parcel={parcel} />
      ))}
    </div>
  );
}
