"use client";

import {
  formatEditorialCount,
  formatMillionsSar,
  formatMillionsSarCompact,
  formatNumber,
  formatTemplate,
} from "@/lib/format";
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
  // Kept as two fields, never one — an area+type gap can hold both sale
  // and lease demand, and those budgets are different scales (see
  // UnmetSegment.budgetSar in src/lib/analytics.ts). Either can be 0 when
  // the gap is entirely one or the other.
  saleBudgetSar: number;
  leaseAnnualBudgetSar: number;
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

      <UnservedDemandValue demand={demand} language={language} t={t} />

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

// The counts above restated as money — what "14 unmet" is actually worth,
// which is the form leadership acts on. Deliberately the first thing in
// the card, before the donut: the SAR figure is the headline finding and
// the chart is its breakdown.
//
// The sale figure is the large serif number; the lease figure trails it as
// its own line rather than being folded in, because an annual rent and a
// one-off purchase total can never be added (see the two separate fields
// on DemandVsSupply). The ready-to-move line then sits on its own tinted
// row — same warm-alert red the "no inventory" donut segment uses — since
// it's the sharpest cut of the same finding: not just demand, but demand
// from investors who said they're ready to buy right now.
function UnservedDemandValue({
  demand,
  language,
  t,
}: {
  demand: DemandVsSupply;
  language: Language;
  t: (key: TranslationKey) => string;
}) {
  const hasSale = demand.unservedSaleBudgetSar > 0;
  const hasLease = demand.unservedLeaseAnnualBudgetSar > 0;
  if (!hasSale && !hasLease) return null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-hairline bg-foreground/[0.03] p-5">
      <span className="section-label">{t("demandMoneyEyebrow")}</span>

      {hasSale && (
        <p className="font-heading text-2xl font-semibold leading-snug text-primary sm:text-3xl">
          {formatTemplate(t("demandMoneySale"), {
            value: formatMillionsSar(demand.unservedSaleBudgetSar, language),
          })}
        </p>
      )}
      {hasLease && (
        <p className="font-heading text-lg font-semibold text-primary/80">
          {formatTemplate(t("demandMoneyLease"), {
            value: formatMillionsSar(demand.unservedLeaseAnnualBudgetSar, language),
          })}
        </p>
      )}

      {demand.readyToMoveUnserved > 0 && (
        <p
          className="rounded-lg px-3 py-2 text-sm font-semibold"
          style={{
            backgroundColor: `${UNMET_NO_INVENTORY_COLOR}14`,
            color: UNMET_NO_INVENTORY_COLOR,
          }}
        >
          {formatTemplate(t("demandReadyToMove"), {
            unserved: formatEditorialCount(demand.readyToMoveUnserved, language),
            total: formatEditorialCount(demand.readyToMoveTotal, language),
          })}
        </p>
      )}
    </div>
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
    // listing_type is what was dropped by this regrouping, so it's exactly
    // what decides which of the two budget buckets this segment's money
    // belongs in — the sale/lease split survives the aggregation.
    const saleBudgetSar = segment.listing_type === "sale" ? segment.budgetSar : 0;
    const leaseAnnualBudgetSar = segment.listing_type === "lease" ? segment.budgetSar : 0;

    const existing = totals.get(key);
    if (existing) {
      existing.investorCount += segment.count;
      existing.saleBudgetSar += saleBudgetSar;
      existing.leaseAnnualBudgetSar += leaseAnnualBudgetSar;
      continue;
    }
    totals.set(key, {
      areaOfCity: segment.area_of_city,
      landType: segment.land_type,
      investorCount: segment.count,
      saleBudgetSar,
      leaseAnnualBudgetSar,
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
        {/* The money for THIS gap, between the investor count and the
            supply count, so the pill row reads as one sentence:
            "8 investors · 17.8M SAR demand · 0 available". Sale and lease
            get their own pill when both are present. */}
        {gap.saleBudgetSar > 0 && (
          <span className="rounded-full bg-accent/15 px-3 py-1 text-sm font-semibold text-primary">
            {formatTemplate(t("topGapDemandValueSale"), {
              value: formatMillionsSarCompact(gap.saleBudgetSar),
            })}
          </span>
        )}
        {gap.leaseAnnualBudgetSar > 0 && (
          <span className="rounded-full bg-accent/15 px-3 py-1 text-sm font-semibold text-primary">
            {formatTemplate(t("topGapDemandValueLease"), {
              value: formatMillionsSarCompact(gap.leaseAnnualBudgetSar),
            })}
          </span>
        )}
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
