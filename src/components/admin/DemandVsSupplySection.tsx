"use client";

import { formatNumber, formatTemplate } from "@/lib/format";
import {
  areaOfCityCompoundLabels,
  landTypeLabels,
  useLanguage,
  type Language,
  type TranslationKey,
} from "@/lib/i18n";
import type { DemandVsSupply, UnmetSegment } from "@/lib/analytics";
import type { AreaOfCity, LandType, Parcel } from "@/lib/types";
import { DonutChart, DonutLegend, type DonutSegment } from "@/components/admin/charts";

// Deliberately distinct from the brand's map-pin status palette
// (STATUS_PIN_COLORS in src/lib/mapTheme.ts) — this section is about
// unmet DEMAND, not parcel status, so it gets its own small warm-alert
// pair: a stronger brick red for the structural "no inventory at all"
// gap, the existing reserved-amber token for the softer "priced out"
// one.
const UNMET_NO_INVENTORY_COLOR = "#b0453a";
const UNMET_OVER_BUDGET_COLOR = "var(--status-reserved)";

interface AggregatedGap {
  areaOfCity: AreaOfCity;
  landType: LandType;
  investorCount: number;
  availableCount: number;
}

// The dashboard's headline insight: how much of investor demand today's
// inventory can actually serve, and — the sharpest single finding —
// which area+type combination has the most unmet demand and the least
// (often zero) supply. `demand` and `parcels` are both computed once in
// the admin page from analytics.ts/data.ts and passed down; this
// component only aggregates already-computed segment counts for display
// grouping (see aggregateGapsByAreaAndType below) — it never re-derives
// the servable/unmet split itself.
export function DemandVsSupplySection({
  demand,
  parcels,
}: {
  demand: DemandVsSupply;
  parcels: Parcel[];
}) {
  const { language, t } = useLanguage();
  const gaps = aggregateGapsByAreaAndType(demand.topUnmetSegments, parcels);
  const [topGap, ...remainingGaps] = gaps;

  const donutSegments: DonutSegment[] = [
    { label: t("servableLabel"), value: demand.servable, color: "var(--color-accent)" },
    {
      label: t("unmetNoInventoryLabel"),
      value: demand.unmetNoInventory,
      color: UNMET_NO_INVENTORY_COLOR,
    },
    {
      label: t("unmetOverBudgetLabel"),
      value: demand.unmetOverBudget,
      color: UNMET_OVER_BUDGET_COLOR,
    },
  ];

  return (
    <section className="flex flex-col gap-6 rounded-2xl border border-hairline bg-background p-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-xl font-semibold text-primary">
          {t("demandSectionTitle")}
        </h2>
        <p className="text-sm text-muted">
          {formatTemplate(t("demandSectionSubtitle"), {
            total: formatNumber(demand.totalInquiries),
          })}
        </p>
      </div>

      {/* Two columns filling the card: the chart on one side, the written
          analysis on the other, so the card's width is put to use instead
          of everything stacking into one long column. Both columns are
          plain flex items (flex-1 + a basis floor) with no direction-
          specific classes — the chart column is first in source order, so
          it lands on the leading edge (right in RTL, left in LTR) and the
          analysis column trails it, the same mirroring convention used
          throughout this dashboard. items-start keeps both tops aligned
          even when one column runs taller than the other, and flex-wrap
          drops the analysis column below the chart once a row can't fit
          both at a readable width — the mobile fallback, with no fixed
          breakpoint to keep in sync with content width. */}
      <div className="flex flex-wrap items-start gap-8">
        {/* Chart column: donut + legend, kept side by side within
            themselves exactly as previously arranged. */}
        <div className="flex flex-1 basis-80 flex-wrap items-center gap-6 min-w-72">
          <DonutChart
            segments={donutSegments}
            centerValue={formatNumber(demand.servable)}
            centerLabel={t("servableLabel")}
          />
          <DonutLegend segments={donutSegments} />
        </div>

        {/* Analysis column: the top-gap highlight plus the remaining
            takeaway lines, stacked together. */}
        <div className="flex-1 basis-80 min-w-72">
          {topGap && <TopGapCallout gap={topGap} language={language} t={t} />}

          {remainingGaps.length > 0 && (
            <ul className="flex flex-col gap-2 border-t border-hairline pt-4 text-sm text-foreground">
              {remainingGaps.map((gap) => (
                <li key={`${gap.areaOfCity}-${gap.landType}`}>
                  {buildTakeaway(gap, language, t)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

// UnmetSegment (from demandVsSupply) is grouped by area+type+listing_type
// — finer than this headline needs, since an investor counts toward the
// same gap whether they want to buy or lease. Re-grouping already-
// computed counts by area+type only, purely for display, is not
// recomputing the underlying match — that logic lives entirely in
// demandVsSupply().
function aggregateGapsByAreaAndType(
  segments: UnmetSegment[],
  parcels: Parcel[]
): AggregatedGap[] {
  const totals = new Map<string, AggregatedGap>();

  for (const segment of segments) {
    const key = `${segment.area_of_city}|${segment.land_type}`;
    const existing = totals.get(key);
    if (existing) {
      existing.investorCount += segment.count;
      continue;
    }
    totals.set(key, {
      areaOfCity: segment.area_of_city,
      landType: segment.land_type,
      investorCount: segment.count,
      availableCount: parcels.filter(
        (parcel) =>
          parcel.status === "available" &&
          parcel.area_of_city === segment.area_of_city &&
          parcel.land_type === segment.land_type
      ).length,
    });
  }

  return [...totals.values()].sort((a, b) => b.investorCount - a.investorCount);
}

function TopGapCallout({
  gap,
  language,
  t,
}: {
  gap: AggregatedGap;
  language: Language;
  t: (key: TranslationKey) => string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-hairline bg-foreground/5 p-5">
      <span className="section-label">{t("topGapEyebrow")}</span>
      <p className="font-heading text-2xl font-semibold text-primary">
        {landTypeLabels[gap.landType][language]} · {areaOfCityCompoundLabels[gap.areaOfCity][language]}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-primary px-3 py-1 text-sm font-semibold text-background">
          {gap.investorCount === 1
            ? t("topGapInvestorCountSingular")
            : formatTemplate(t("topGapInvestorCount"), { count: formatNumber(gap.investorCount) })}
        </span>
        <span className="rounded-full border border-hairline px-3 py-1 text-sm text-muted">
          {formatTemplate(t("topGapAvailableCount"), { count: formatNumber(gap.availableCount) })}
        </span>
      </div>
      <p className="text-sm text-muted">{buildTakeaway(gap, language, t)}</p>
    </div>
  );
}

// A gap with zero available parcels of its area+type (any status) is, by
// construction, unmet for lack of inventory rather than price — no
// inquiry could have matched it even ignoring budget. Any other gap is
// framed as a budget mismatch instead.
function buildTakeaway(
  gap: AggregatedGap,
  language: Language,
  t: (key: TranslationKey) => string
): string {
  const isNoInventory = gap.availableCount === 0;
  const isSingular = gap.investorCount === 1;
  const templateKey: TranslationKey = isNoInventory
    ? isSingular
      ? "unmetTakeawayNoInventorySingular"
      : "unmetTakeawayNoInventory"
    : isSingular
      ? "unmetTakeawayOverBudgetSingular"
      : "unmetTakeawayOverBudget";

  return formatTemplate(t(templateKey), {
    count: formatNumber(gap.investorCount),
    landType: landTypeLabels[gap.landType][language],
    area: areaOfCityCompoundLabels[gap.areaOfCity][language],
  });
}
