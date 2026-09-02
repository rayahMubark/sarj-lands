"use client";

import { useState } from "react";
import {
  formatEditorialCount,
  formatMillionsSar,
  formatMillionsSarCompact,
  formatNumber,
  formatTemplate,
} from "@/lib/format";
import {
  areaOfCityCompoundLabels,
  areaOfCityLabels,
  intentLabels,
  landTypeLabels,
  listingTypeLabels,
  useLanguage,
  type Language,
  type TranslationKey,
} from "@/lib/i18n";
import { sortInvestorsByPriority } from "@/lib/analytics";
import { buildInvestorWhatsAppUrl } from "@/lib/investorOutreach";
import type { DemandVsSupply, UnmetSegment } from "@/lib/analytics";
import type { AreaOfCity, Inquiry, Intent, LandType, Parcel } from "@/lib/types";
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
  // Every unmet investor behind this gap, carried straight from the
  // matching pass (see UnmetSegment.investors) so the list a leader opens
  // is by construction the same people the count and money describe. One
  // area+type gap can hold both sale and lease seekers, so this list may
  // mix the two — each card states its own budget basis for that reason.
  investors: Inquiry[];
  readyToMoveCount: number;
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

  // One gap open at a time: these lists are call sheets, and stacking
  // several open at once would bury the one just clicked. null = closed.
  const [openGapKey, setOpenGapKey] = useState<string | null>(null);
  const openGap = gaps.find((gap) => gapKey(gap) === openGapKey) ?? null;

  function toggleGap(gap: AggregatedGap) {
    const key = gapKey(gap);
    setOpenGapKey((current) => (current === key ? null : key));
  }

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
            takeaway lines, stacked together. Every gap here is a toggle
            for the investor list below — see GapInvestorPanel. */}
        <div className="flex-1 basis-80 min-w-72">
          {topGap && (
            <TopGapCallout
              gap={topGap}
              isOpen={openGapKey === gapKey(topGap)}
              onToggle={() => toggleGap(topGap)}
              language={language}
              t={t}
            />
          )}

          {remainingGaps.length > 0 && (
            <ul className="flex flex-col gap-1 border-t border-hairline pt-4 text-sm text-foreground">
              {remainingGaps.map((gap) => (
                <li key={gapKey(gap)}>
                  <GapTakeawayButton
                    gap={gap}
                    isOpen={openGapKey === gapKey(gap)}
                    onToggle={() => toggleGap(gap)}
                    language={language}
                    t={t}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Full width, below both columns: an investor list needs the whole
          card, and anchoring it in one fixed place means the layout doesn't
          reflow differently depending on which gap was clicked. */}
      {openGap && <GapInvestorPanel gap={openGap} language={language} t={t} />}
    </section>
  );
}

// Identifies a gap across renders. Area + land type is exactly the key
// aggregateGapsByAreaAndType groups on, so it is unique within `gaps` by
// construction — no separate id needed.
function gapKey(gap: AggregatedGap): string {
  return `${gap.areaOfCity}-${gap.landType}`;
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

// An opened gap's investors, as a call sheet. The summary line reframes
// the gap as leverage — these are buyers already asking for land Sarj
// doesn't have, which is the argument for acquiring or listing it — and
// each card below carries only what the inquiry record actually holds.
function GapInvestorPanel({
  gap,
  language,
  t,
}: {
  gap: AggregatedGap;
  language: Language;
  t: (key: TranslationKey) => string;
}) {
  const investors = sortInvestorsByPriority(gap.investors);

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-foreground/[0.03] p-5">
      <div className="flex flex-col gap-2">
        <span className="section-label">{t("gapInvestorListTitle")}</span>
        <h3 className="font-heading text-lg font-semibold text-primary">
          {landTypeLabels[gap.landType][language]} ·{" "}
          {areaOfCityCompoundLabels[gap.areaOfCity][language]}
        </h3>
        <GapSummaryChips gap={gap} t={t} />
      </div>

      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {investors.map((investor) => (
          <InvestorCard
            key={investor.inquiry_id}
            investor={investor}
            language={language}
            t={t}
          />
        ))}
      </ul>
    </div>
  );
}

// The opportunity in one row: how many investors, what they're worth, and
// how many are ready to buy today. Sale and lease money stay in separate
// chips for the same reason they're separate everywhere else.
function GapSummaryChips({
  gap,
  t,
}: {
  gap: AggregatedGap;
  t: (key: TranslationKey) => string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="rounded-full bg-primary px-3 py-1 text-sm font-semibold text-background">
        {gap.investorCount === 1
          ? t("topGapInvestorCountSingular")
          : formatTemplate(t("topGapInvestorCount"), {
              count: formatNumber(gap.investorCount),
            })}
      </span>
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
      {gap.readyToMoveCount > 0 && (
        <span
          className="rounded-full px-3 py-1 text-sm font-semibold"
          style={{
            backgroundColor: `${UNMET_NO_INVENTORY_COLOR}14`,
            color: UNMET_NO_INVENTORY_COLOR,
          }}
        >
          {formatTemplate(t("gapReadyToBuyNow"), {
            count: formatNumber(gap.readyToMoveCount),
          })}
        </span>
      )}
    </div>
  );
}

// One real investor from the 48. Every field here is read straight off the
// inquiry record — name, stated purpose, budget, preference, area/type and
// intent. Nothing is inferred: the data says nothing about whether an
// investor is a company or an individual, so this card doesn't either.
function InvestorCard({
  investor,
  language,
  t,
}: {
  investor: Inquiry;
  language: Language;
  t: (key: TranslationKey) => string;
}) {
  // prefers and budget_basis are locked together on the Inquiry union, so
  // the preference decides which budget sentence is correct — a purchase
  // total and an annual rent never share a label.
  const budgetLabel =
    investor.prefers === "sale" ? "gapInvestorBudgetTotal" : "gapInvestorBudgetAnnual";

  return (
    <li className="flex flex-col gap-2 rounded-xl border border-hairline bg-background p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold text-foreground">{investor.investor_name}</span>
        <span className="text-xs text-muted">{investor.inquiry_id}</span>
      </div>

      <p className="text-sm text-foreground">
        <span className="text-muted">{t("gapInvestorWants")}: </span>
        {investor.wants_to}
      </p>

      <p className="font-heading text-sm font-semibold text-primary">
        {formatTemplate(t(budgetLabel), {
          value: formatNumber(investor.budget_sar),
        })}
      </p>

      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <MetaChip>{landTypeLabels[investor.land_type_wanted][language]}</MetaChip>
        <MetaChip>{areaOfCityLabels[investor.area_of_city_wanted][language]}</MetaChip>
        <MetaChip>{listingTypeLabels[investor.prefers][language]}</MetaChip>
        <IntentChip intent={investor.intent} language={language} />
      </div>

      {/* Opens WhatsApp with this investor, pre-filled — see
          src/lib/investorOutreach.ts. rel=noreferrer alongside _blank so
          the dashboard's own URL isn't leaked to the opened tab. */}
      <a
        href={buildInvestorWhatsAppUrl(investor)}
        target="_blank"
        rel="noreferrer"
        className="mt-1 inline-flex items-center justify-center gap-2 rounded-full border border-hairline px-3 py-2 text-xs font-semibold text-primary transition-colors hover:border-primary"
      >
        <WhatsAppIcon />
        {t("gapInvestorWhatsApp")}
        <span className="text-muted" dir="ltr">
          {investor.phone}
        </span>
      </a>
    </li>
  );
}

function MetaChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-hairline px-2 py-0.5 text-muted">
      {children}
    </span>
  );
}

// "Ready to move" is the one intent worth calling out visually — it's what
// the summary's own ready-to-buy chip counts, and what the sort puts first.
function IntentChip({ intent, language }: { intent: Intent; language: Language }) {
  const isReady = intent === "ready to move";

  return (
    <span
      className="rounded-full px-2 py-0.5 font-semibold"
      style={
        isReady
          ? {
              backgroundColor: `${UNMET_NO_INVENTORY_COLOR}14`,
              color: UNMET_NO_INVENTORY_COLOR,
            }
          : undefined
      }
    >
      <span className={isReady ? undefined : "text-muted"}>
        {intentLabels[intent][language]}
      </span>
    </span>
  );
}

function WhatsAppIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-3.5 w-3.5 shrink-0"
    >
      <path d="M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.86 9.86 0 0 0 4.79 1.22h.01c5.46 0 9.9-4.44 9.9-9.9 0-2.64-1.03-5.13-2.9-7A9.82 9.82 0 0 0 12.04 2Zm0 18.02h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.11.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.36c0-4.54 3.7-8.23 8.24-8.23a8.18 8.18 0 0 1 5.82 2.41 8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.15.16-.29.18-.54.06-.25-.13-1.05-.39-1.99-1.23-.74-.66-1.24-1.47-1.38-1.72-.15-.25-.02-.38.11-.5.11-.12.25-.29.37-.44.13-.15.17-.25.25-.42.09-.16.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.42-.14 0-.3-.02-.46-.02-.16 0-.43.06-.65.31-.22.25-.85.84-.85 2.03 0 1.2.87 2.35.99 2.51.12.16 1.71 2.61 4.14 3.66.58.25 1.03.4 1.38.51.58.19 1.11.16 1.53.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.11-.22-.17-.47-.29Z" />
    </svg>
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

    const readyToMoveCount = segment.investors.filter(
      (investor) => investor.intent === "ready to move"
    ).length;

    const existing = totals.get(key);
    if (existing) {
      existing.investorCount += segment.count;
      existing.saleBudgetSar += saleBudgetSar;
      existing.leaseAnnualBudgetSar += leaseAnnualBudgetSar;
      existing.investors.push(...segment.investors);
      existing.readyToMoveCount += readyToMoveCount;
      continue;
    }
    totals.set(key, {
      areaOfCity: segment.area_of_city,
      landType: segment.land_type,
      investorCount: segment.count,
      saleBudgetSar,
      leaseAnnualBudgetSar,
      investors: [...segment.investors],
      readyToMoveCount,
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

// The headline gap, and the primary way into its investor list. A <button>
// rather than a div with onClick so it's keyboard-reachable and announces
// its expanded state; text-start because a button centers its content by
// default, which would fight the surrounding RTL/LTR text flow.
function TopGapCallout({
  gap,
  isOpen,
  onToggle,
  language,
  t,
}: {
  gap: AggregatedGap;
  isOpen: boolean;
  onToggle: () => void;
  language: Language;
  t: (key: TranslationKey) => string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      className={`flex w-full flex-col gap-2 rounded-xl border p-5 text-start transition-colors ${
        isOpen
          ? "border-primary bg-foreground/[0.06]"
          : "border-hairline bg-foreground/5 hover:border-primary/40"
      }`}
    >
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
      <span className="text-xs font-semibold text-primary">
        {t(isOpen ? "gapHideInvestors" : "gapViewInvestors")}
      </span>
    </button>
  );
}

// The same affordance for the smaller gaps: their one-line takeaway is
// itself the button. Kept visually light (a hover tint and the same
// open-state border as the callout above) so the list still reads as
// prose rather than a row of controls.
function GapTakeawayButton({
  gap,
  isOpen,
  onToggle,
  language,
  t,
}: {
  gap: AggregatedGap;
  isOpen: boolean;
  onToggle: () => void;
  language: Language;
  t: (key: TranslationKey) => string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      className={`flex w-full flex-col gap-1 rounded-lg border px-3 py-2 text-start text-sm transition-colors ${
        isOpen
          ? "border-primary bg-foreground/[0.06]"
          : "border-transparent hover:border-hairline hover:bg-foreground/[0.03]"
      }`}
    >
      <span className="text-foreground">{buildTakeaway(gap, language, t)}</span>
      <span className="text-xs font-semibold text-primary">
        {t(isOpen ? "gapHideInvestors" : "gapViewInvestors")}
      </span>
    </button>
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
