import { parcels, inquiries, getAvailableParcels, getParcelById } from "./data";
import type {
  Parcel,
  Inquiry,
  Intent,
  AreaOfCity,
  LandType,
  ListingType,
  ParcelStatus,
  UseCategory,
} from "./types";

// Available parcels matching an inquiry's area/type/listing preference,
// ignoring budget entirely. Used both for real matching (further filtered
// by budget below) and for telling "no inventory exists" apart from
// "inventory exists but is over budget".
function matchAvailableIgnoringBudget(inquiry: Inquiry): Parcel[] {
  return getAvailableParcels().filter(
    (parcel) =>
      parcel.area_of_city === inquiry.area_of_city_wanted &&
      parcel.land_type === inquiry.land_type_wanted &&
      parcel.listing_type === inquiry.prefers
  );
}

// For one inquiry, the available parcels that match its area, land type,
// and listing type (sale/lease), and are within budget. Since listing_type
// is matched first, price comparisons never cross the sale/lease boundary:
// sale prices are compared to "total purchase" budgets, lease prices
// (annual rent) to "annual rent" budgets. Parcels with an unknown price
// (priceOnRequest) are skipped — an unknown price cannot be judged against
// a budget.
export function matchInquiryToParcels(inquiry: Inquiry): Parcel[] {
  return matchAvailableIgnoringBudget(inquiry).filter((parcel) => {
    if (parcel.priceOnRequest) return false;
    return parcel.total_price_sar <= inquiry.budget_sar;
  });
}

// Available parcels that not one of the 48 inquiries actually matches
// (area + land type + listing type, AND within that inquiry's budget) —
// composed from matchInquiryToParcels, not a separate matching
// implementation. Deliberately stricter than demandVsSupply's own
// idleParcelIds (which matches ignoring budget, so it counts a parcel as
// "matched" even when every interested inquiry's budget is too low for
// it — with this portfolio that field comes out empty, 0, since every
// available parcel's area+type+listing combo is wanted by *someone*).
// This is the "genuinely nobody can currently afford this" view the
// admin dashboard's cold-inventory section needs: is there real,
// affordable demand for this specific parcel today, not just demand for
// its category.
export function idleAvailableParcels(): Parcel[] {
  const matchedParcelIds = new Set<string>();
  for (const inquiry of inquiries) {
    for (const parcel of matchInquiryToParcels(inquiry)) {
      matchedParcelIds.add(parcel.parcel_id);
    }
  }
  return getAvailableParcels().filter(
    (parcel) => !matchedParcelIds.has(parcel.parcel_id)
  );
}

export interface PortfolioStats {
  totalParcels: number;
  byStatus: Record<ParcelStatus, number>;
  availableCount: number;
  availableByListingType: { sale: number; lease: number };
  // Two SEPARATE totals, never combined into one figure — a sale total
  // and a lease annual rent are different scales (see the pricing rule
  // in src/lib/types.ts) and summing them would be meaningless. The sale
  // total excludes SRE-013-style priceOnRequest parcels rather than
  // treating the unknown price as 0.
  availableSaleValueSar: number;
  availableLeaseAnnualValueSar: number;
  uniqueDistrictCount: number;
}

export function portfolioStats(): PortfolioStats {
  const byStatus: Record<ParcelStatus, number> = {
    available: 0,
    reserved: 0,
    sold: 0,
    leased: 0,
  };
  for (const parcel of parcels) byStatus[parcel.status]++;

  const available = getAvailableParcels();
  const availableByListingType = {
    sale: available.filter((p) => p.listing_type === "sale").length,
    lease: available.filter((p) => p.listing_type === "lease").length,
  };

  const availableSaleValueSar = available
    .filter((p) => p.listing_type === "sale" && !p.priceOnRequest)
    .reduce((sum, p) => sum + p.total_price_sar, 0);
  const availableLeaseAnnualValueSar = available
    .filter((p) => p.listing_type === "lease")
    .reduce((sum, p) => sum + p.total_price_sar, 0);
  const uniqueDistrictCount = new Set(parcels.map((p) => p.district_en)).size;

  return {
    totalParcels: parcels.length,
    byStatus,
    availableCount: available.length,
    availableByListingType,
    availableSaleValueSar,
    availableLeaseAnnualValueSar,
    uniqueDistrictCount,
  };
}

export interface UnmetSegment {
  area_of_city: AreaOfCity;
  land_type: LandType;
  listing_type: ListingType;
  count: number;
  // Summed budget_sar of the unmet inquiries in this segment. Safe to sum
  // because listing_type is part of the segment key: every inquiry counted
  // here shares one budget_basis, so a sale segment's figure is purely
  // purchase budget and a lease segment's is purely annual rent. The two
  // are only ever added together by a caller that keeps them apart — see
  // DemandVsSupply's two separate totals below.
  budgetSar: number;
  // The actual unmet inquiries behind `count` — the same Inquiry records
  // from the 48, carried out of the matching pass rather than looked up
  // again afterwards, so a segment's investor list can never drift from
  // the count and budget printed beside it. Unsorted here; presentation
  // order is the caller's business (see sortInvestorsByPriority).
  investors: Inquiry[];
}

export interface DemandVsSupply {
  totalInquiries: number;
  servable: number; // has at least one matching available parcel within budget
  unmet: number; // has none
  unmetNoInventory: number; // no matching area+type+listing at all, any budget
  unmetOverBudget: number; // matching inventory exists, but all over budget / price-on-request
  topUnmetSegments: UnmetSegment[]; // unmet demand grouped by area+land_type+listing_type, sorted desc
  idleParcelIds: string[]; // available parcels that match zero inquiries (any budget) — cold inventory

  // THE MONEY ON THE GAP: what the unmet counts above are actually worth.
  // Two SEPARATE totals, never one combined figure — the same rule
  // PortfolioStats follows. A "total purchase" budget is a one-off sum an
  // investor would pay once; an "annual rent" budget recurs yearly. Adding
  // them would invent a number that means nothing, so budget_basis (which
  // travels with `prefers` on every inquiry — see src/lib/types.ts) picks
  // exactly one of these for each unmet investor.
  unservedSaleBudgetSar: number; // sum of budget_sar, unmet inquiries where prefers="sale"
  unservedLeaseAnnualBudgetSar: number; // ...where prefers="lease"; SAR PER YEAR

  // The sharpest cut of the same finding: investors who told us they are
  // ready to move — the hottest intent in the pipeline — and still have
  // nothing in this portfolio they can act on. Reported as a pair so the
  // dashboard can say "N of M" rather than a bare count.
  readyToMoveUnserved: number;
  readyToMoveTotal: number;
}

export function demandVsSupply(): DemandVsSupply {
  let servable = 0;
  let unmetNoInventory = 0;
  let unmetOverBudget = 0;
  let unservedSaleBudgetSar = 0;
  let unservedLeaseAnnualBudgetSar = 0;
  let readyToMoveUnserved = 0;

  const unmetSegmentCounts = new Map<string, UnmetSegment>();
  const matchedParcelIds = new Set<string>();

  // Counted across ALL inquiries, not just unmet ones — it's the
  // denominator of the "N of M ready-to-move investors" line, so it has to
  // include the ready-to-move investors we CAN serve.
  const readyToMoveTotal = inquiries.filter(
    (inquiry) => inquiry.intent === "ready to move"
  ).length;

  for (const inquiry of inquiries) {
    const ignoringBudget = matchAvailableIgnoringBudget(inquiry);
    for (const parcel of ignoringBudget) matchedParcelIds.add(parcel.parcel_id);

    const withinBudget = matchInquiryToParcels(inquiry);
    if (withinBudget.length > 0) {
      servable++;
      continue;
    }

    // Everything below runs only for an UNMET inquiry — the same single
    // pass that already decided that, so the money figures can never
    // disagree with the counts beside them about who is unserved.
    if (ignoringBudget.length === 0) {
      unmetNoInventory++;
    } else {
      unmetOverBudget++;
    }

    // `prefers` and `budget_basis` are locked together by the Inquiry
    // union (sale <-> "total purchase", lease <-> "annual rent"), so
    // branching on one is branching on the other: a purchase budget can
    // never land in the annual-rent total or vice versa.
    if (inquiry.prefers === "sale") {
      unservedSaleBudgetSar += inquiry.budget_sar;
    } else {
      unservedLeaseAnnualBudgetSar += inquiry.budget_sar;
    }

    if (inquiry.intent === "ready to move") readyToMoveUnserved++;

    const key = `${inquiry.area_of_city_wanted}|${inquiry.land_type_wanted}|${inquiry.prefers}`;
    const existing = unmetSegmentCounts.get(key);
    if (existing) {
      existing.count++;
      existing.budgetSar += inquiry.budget_sar;
      existing.investors.push(inquiry);
    } else {
      unmetSegmentCounts.set(key, {
        area_of_city: inquiry.area_of_city_wanted,
        land_type: inquiry.land_type_wanted,
        listing_type: inquiry.prefers,
        count: 1,
        budgetSar: inquiry.budget_sar,
        investors: [inquiry],
      });
    }
  }

  const topUnmetSegments = [...unmetSegmentCounts.values()].sort(
    (a, b) => b.count - a.count
  );

  const idleParcelIds = getAvailableParcels()
    .filter((parcel) => !matchedParcelIds.has(parcel.parcel_id))
    .map((parcel) => parcel.parcel_id);

  return {
    totalInquiries: inquiries.length,
    servable,
    unmet: unmetNoInventory + unmetOverBudget,
    unmetNoInventory,
    unmetOverBudget,
    topUnmetSegments,
    idleParcelIds,
    unservedSaleBudgetSar,
    unservedLeaseAnnualBudgetSar,
    readyToMoveUnserved,
    readyToMoveTotal,
  };
}

// How urgent each intent is, for ordering a gap's investor list: the
// people who said they're ready to move are the ones worth calling first,
// and "exploring" trails. Lower rank sorts earlier.
const INTENT_PRIORITY: Record<Intent, number> = {
  "ready to move": 0,
  "comparing options": 1,
  exploring: 2,
};

// A gap's investors as a call list: readiness first, then the largest
// budget within each readiness band. Returns a new array — callers pass
// segment.investors straight in, and mutating that would reorder the
// analytics result itself.
//
// A caveat worth stating plainly: the dashboard groups gaps by area+land
// type, which can hold BOTH sale and lease seekers, so the budgets tied
// here are not always the same basis — a purchase total may sort above an
// annual rent that is, in its own terms, the bigger commitment. That is
// tolerable only because this is call ORDER, not a value comparison: no
// figure is summed or ranked against another in the UI, and every card
// prints its own basis ("total purchase" / "annual rent"), so a reader is
// never shown the two as though they were one scale. The money totals
// beside the list stay strictly separated, as everywhere else.
export function sortInvestorsByPriority(investors: Inquiry[]): Inquiry[] {
  return [...investors].sort(
    (a, b) =>
      INTENT_PRIORITY[a.intent] - INTENT_PRIORITY[b.intent] ||
      b.budget_sar - a.budget_sar
  );
}

// WHAT INVESTORS ACTUALLY WANT TO DO WITH THE LAND. `wants_to` is free
// text on every inquiry ("open a warehouse", "build a family home") and
// is the one column that says what the demand is FOR, rather than where
// or how much. All 48 rows carry one of nine values.
//
// The higher-level split below answers a question the raw counts don't:
// commercial-vs-residential is already visible in land_type_wanted, but
// "residential" hides two completely different customers — a developer
// building apartments to rent out, and a family building one home. Those
// want different plots and buy on different logic, so they are separated
// here. UseCategory itself lives in ./types with the other shared domain
// types, so i18n can label it without importing this module.

// The mapping, kept in code rather than derived, because it encodes a
// judgement the data itself doesn't state. Verified against the data:
// every one of the nine values maps cleanly, and each also corresponds to
// exactly one land_type_wanted (all five "business" uses are commercial
// inquiries, all four others residential), so this split never contradicts
// the portfolio's own typing — it subdivides it.
//
// The one genuine judgement call is "build a residential compound":
// classified as development, since a compound at this scale is built to
// sell or let rather than to live in. "build a family home" is the only
// personal-use value.
const USE_CATEGORY_BY_INTENDED_USE: Record<string, UseCategory> = {
  "open a warehouse": "business",
  "open a car showroom": "business",
  "open an office building": "business",
  "open a retail store": "business",
  "open a showroom": "business",
  "build a residential compound": "development",
  "build apartments to rent": "development",
  "build villas to sell": "development",
  "build a family home": "personal",
};

export interface IntendedUseCount {
  wantsTo: string; // the raw wants_to value, as written in the data
  count: number;
  category: UseCategory | null; // null if a future value isn't mapped above
}

// Every distinct `wants_to` across the 48 inquiries with its count,
// commonest first. Keyed on the raw string, so a value that isn't in the
// mapping above still appears here with its real count — nothing silently
// vanishes from the totals just because it wasn't anticipated.
export function demandByIntendedUse(): IntendedUseCount[] {
  const counts = new Map<string, number>();
  for (const inquiry of inquiries) {
    counts.set(inquiry.wants_to, (counts.get(inquiry.wants_to) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([wantsTo, count]) => ({
      wantsTo,
      count,
      category: USE_CATEGORY_BY_INTENDED_USE[wantsTo] ?? null,
    }))
    .sort((a, b) => b.count - a.count || a.wantsTo.localeCompare(b.wantsTo));
}

export interface UseCategoryBreakdown {
  business: number;
  development: number;
  personal: number;
  // Inquiries whose wants_to isn't in the mapping. 0 with today's data;
  // surfaced rather than dropped so the three counts above can always be
  // checked against the inquiry total instead of silently under-counting.
  unclassified: number;
  total: number;
}

export function demandByUseCategory(): UseCategoryBreakdown {
  const breakdown: UseCategoryBreakdown = {
    business: 0,
    development: 0,
    personal: 0,
    unclassified: 0,
    total: inquiries.length,
  };

  for (const inquiry of inquiries) {
    const category = USE_CATEGORY_BY_INTENDED_USE[inquiry.wants_to];
    if (category) {
      breakdown[category]++;
    } else {
      breakdown.unclassified++;
    }
  }

  return breakdown;
}

// Whether "most of the demand is commercial, not residential" is actually
// true of the data, rather than a line asserted and hoped for: business
// use must outweigh BOTH other categories combined, since development and
// personal use are together exactly the residential demand. The dashboard
// only prints that takeaway when this holds, and falls back to naming
// whichever category actually leads.
export function isBusinessUseDominant(breakdown: UseCategoryBreakdown): boolean {
  return breakdown.business > breakdown.development + breakdown.personal;
}

// A reasonable minimum sample size before an average/median is worth
// showing at district granularity. With 120 parcels spread across 88
// districts, most district+type+listing groups have only 1 parcel
// (verified directly: 77 of 94 such groups) — an "average" of one point
// is just that point, not a benchmark. 3 is the smallest threshold that
// still leaves any district-level groups at all in this dataset (5 of
// them), so segment-level (area_of_city+land_type+listing_type, which
// always has enough parcels) stays the primary benchmark and district-
// level is a bonus only "where enough data exists," per the brief.
const MIN_DISTRICT_SAMPLE_SIZE = 3;

interface PriceStats {
  sampleSize: number;
  avgPricePerSqmSar: number;
  medianPricePerSqmSar: number;
}

export interface SegmentPriceBenchmark extends PriceStats {
  area_of_city: AreaOfCity;
  land_type: LandType;
  listing_type: ListingType;
}

export interface DistrictPriceBenchmark extends PriceStats {
  district_en: string;
  district_ar: string;
  land_type: LandType;
  listing_type: ListingType;
}

// Our own portfolio's own price_per_sqm_sar, averaged and medianed by
// area_of_city+land_type+listing_type — a portfolio-wide OVERVIEW of
// what a segment typically goes for (see src/lib/sanadAdminPrompt.ts).
// SRE-013 is excluded: priceOnRequest means its price is genuinely
// unknown, not zero, and including a missing price would silently drag
// every average down. Sale and lease are always separate groups
// (listing_type is part of the key) since their prices are different
// scales — per-sqm sale price and per-sqm annual rent must never be
// averaged together.
//
// excludeParcelId drops one parcel out of the grouping entirely — pass
// the parcel you're about to BENCHMARK when you want a "peer average"
// that doesn't include its own price (see peerPriceBenchmarks below,
// which is what admin-Sanad actually uses to price one specific parcel;
// this general form, called with no argument, is for portfolio-overview
// questions that aren't about any one listing).
export function priceBenchmarksBySegment(excludeParcelId?: string): SegmentPriceBenchmark[] {
  const groups = groupPricesPerSqm(
    (parcel) => `${parcel.area_of_city}|${parcel.land_type}|${parcel.listing_type}`,
    (parcel) => ({
      area_of_city: parcel.area_of_city,
      land_type: parcel.land_type,
      listing_type: parcel.listing_type,
    }),
    excludeParcelId
  );

  return [...groups.values()]
    .map((group) => ({ ...group.fields, ...computePriceStats(group.pricesPerSqm) }))
    .sort(
      (a, b) =>
        a.area_of_city.localeCompare(b.area_of_city) ||
        a.land_type.localeCompare(b.land_type) ||
        a.listing_type.localeCompare(b.listing_type)
    );
}

// The same benchmark at district granularity. Composed from the same
// grouping helper as priceBenchmarksBySegment, not a separate
// implementation, so the two can never disagree about how an
// average/median is computed. See priceBenchmarksBySegment's docstring
// for excludeParcelId.
export function priceBenchmarksByDistrict(excludeParcelId?: string): DistrictPriceBenchmark[] {
  const groups = groupPricesPerSqm(
    (parcel) => `${parcel.district_en}|${parcel.land_type}|${parcel.listing_type}`,
    (parcel) => ({
      district_en: parcel.district_en,
      district_ar: parcel.district_ar,
      land_type: parcel.land_type,
      listing_type: parcel.listing_type,
    }),
    excludeParcelId
  );
  const benchmarks = [...groups.values()].map((group) => ({
    ...group.fields,
    ...computePriceStats(group.pricesPerSqm),
  }));

  // MIN_DISTRICT_SAMPLE_SIZE only declutters the general, no-target-
  // parcel table (see its own docstring) — a caller excluding one
  // specific parcel to build ITS peer benchmark (peerPriceBenchmarks
  // below) wants the real count, however small, not a group silently
  // dropped to nothing; that real (possibly tiny) count is exactly what
  // the small-sample guardrail needs to see and state honestly.
  const relevant = excludeParcelId
    ? benchmarks
    : benchmarks.filter((benchmark) => benchmark.sampleSize >= MIN_DISTRICT_SAMPLE_SIZE);

  return relevant.sort(
    (a, b) => a.district_en.localeCompare(b.district_en) || a.land_type.localeCompare(b.land_type)
  );
}

// Below this many OTHER priced parcels in a segment/district (after
// excluding the parcel itself), an average/median is too thin to anchor
// a confident price recommendation on — see peerPriceBenchmarks' own
// docstring for the real bug this guards against. Exported so
// sanadAdminPrompt.ts's guardrail instruction references this exact
// number rather than a second hardcoded "4" that could drift out of
// sync.
export const MIN_RELIABLE_PEER_SAMPLE_SIZE = 4;

export interface PeerPriceBenchmark {
  parcel_id: string;
  ownPricePerSqmSar: number;
  daysOnMarket: number;
  status: ParcelStatus;
  segmentPeerSampleSize: number;
  segmentPeerAvgPricePerSqmSar: number | null;
  segmentPeerMedianPricePerSqmSar: number | null;
  segmentReliable: boolean;
  districtPeerSampleSize: number;
  districtPeerAvgPricePerSqmSar: number | null;
  districtPeerMedianPricePerSqmSar: number | null;
  districtReliable: boolean;
}

// The fix for a real reported bug: admin-Sanad was benchmarking a parcel
// against an average that included the parcel's OWN price (circular) —
// and West's residential-lease segment has exactly 2 parcels (SRE-105 at
// 70 SAR/sqm, SRE-108 at 100), so that "average" of 85 was really just
// "the other parcel's price." Sanad then told SRE-108 to drop toward 85
// (an average made of its own price) and SRE-105 — idle 275 days — to
// RAISE toward 85, backwards advice for a listing that isn't moving.
//
// This computes every priced parcel's benchmark against its PEERS only
// (itself excluded, via priceBenchmarksBySegment/ByDistrict's
// excludeParcelId), plus the real peer count, so admin-Sanad's persona
// can refuse a precise price target when that count is too small (see
// MIN_RELIABLE_PEER_SAMPLE_SIZE) instead of silently trusting a
// contaminated or tiny average.
export function peerPriceBenchmarks(): PeerPriceBenchmark[] {
  return parcels.filter((parcel) => !parcel.priceOnRequest).map(buildPeerPriceBenchmark);
}

function buildPeerPriceBenchmark(parcel: Parcel): PeerPriceBenchmark {
  const segment = priceBenchmarksBySegment(parcel.parcel_id).find(
    (benchmark) =>
      benchmark.area_of_city === parcel.area_of_city &&
      benchmark.land_type === parcel.land_type &&
      benchmark.listing_type === parcel.listing_type
  );
  const district = priceBenchmarksByDistrict(parcel.parcel_id).find(
    (benchmark) =>
      benchmark.district_en === parcel.district_en &&
      benchmark.land_type === parcel.land_type &&
      benchmark.listing_type === parcel.listing_type
  );

  return {
    parcel_id: parcel.parcel_id,
    // The caller (peerPriceBenchmarks) already filtered out priceOnRequest
    // parcels, but that filter doesn't narrow parcel's type across the
    // .map — re-check here so price_per_sqm_sar narrows to `number`.
    ownPricePerSqmSar: parcel.priceOnRequest ? 0 : parcel.price_per_sqm_sar,
    daysOnMarket: parcel.days_on_market,
    status: parcel.status,
    segmentPeerSampleSize: segment?.sampleSize ?? 0,
    segmentPeerAvgPricePerSqmSar: segment?.avgPricePerSqmSar ?? null,
    segmentPeerMedianPricePerSqmSar: segment?.medianPricePerSqmSar ?? null,
    segmentReliable: (segment?.sampleSize ?? 0) >= MIN_RELIABLE_PEER_SAMPLE_SIZE,
    districtPeerSampleSize: district?.sampleSize ?? 0,
    districtPeerAvgPricePerSqmSar: district?.avgPricePerSqmSar ?? null,
    districtPeerMedianPricePerSqmSar: district?.medianPricePerSqmSar ?? null,
    districtReliable: (district?.sampleSize ?? 0) >= MIN_RELIABLE_PEER_SAMPLE_SIZE,
  };
}

// How one parcel's price_per_sqm_sar sits against its segment PEERS —
// the investor-facing read of the same benchmark admin-Sanad prices
// against (buildPeerPriceBenchmark below). percentDelta is signed
// relative to the peer average: negative means this parcel is cheaper
// per sqm than its peers, which is the reading a buyer cares about.
export interface SegmentPriceComparison {
  peerAvgPricePerSqmSar: number;
  peerSampleSize: number; // OTHER parcels behind the average, never including this one
  percentDelta: number; // e.g. -12 -> 12% below the peer average
}

// The comparison to show an investor on a parcel's detail page, or null
// when there is nothing honest to say. Deliberately composed from
// buildPeerPriceBenchmark rather than any new matching: the segment key
// (area_of_city + land_type + listing_type) and the self-exclusion are
// already correct there, which also means a lease parcel is only ever
// compared against lease prices and a sale parcel against sale prices.
//
// Returns null — and the UI then shows no comparison at all — when:
//  - the parcel_id isn't in the portfolio, or its price is unknown
//    (SRE-013's priceOnRequest: there is no figure to compare);
//  - the segment has fewer than MIN_RELIABLE_PEER_SAMPLE_SIZE OTHER
//    priced parcels. A "12% below average" computed against one or two
//    comparables is noise dressed as precision, and stating it to a buyer
//    about to spend millions is worse than staying quiet. This is the
//    same gate admin-Sanad's pricing advice runs (see its RELIABILITY
//    GATE rule) — an investor gets no weaker a standard than leadership.
//    With this portfolio that still covers 55 of the 61 priced available
//    parcels; the remaining few simply show their price with no claim
//    attached.
export function segmentPriceComparison(
  parcelId: string
): SegmentPriceComparison | null {
  const parcel = getParcelById(parcelId);
  if (!parcel || parcel.priceOnRequest) return null;

  const benchmark = buildPeerPriceBenchmark(parcel);
  if (!benchmark.segmentReliable) return null;

  const peerAvgPricePerSqmSar = benchmark.segmentPeerAvgPricePerSqmSar;
  // segmentReliable already implies a real sample, so the average is
  // non-null; the guard keeps that an assertion rather than an assumption,
  // and rules out a divide-by-zero on a nonsensical 0 average.
  if (peerAvgPricePerSqmSar === null || peerAvgPricePerSqmSar === 0) return null;

  const ownPricePerSqmSar = parcel.price_per_sqm_sar;

  return {
    peerAvgPricePerSqmSar,
    peerSampleSize: benchmark.segmentPeerSampleSize,
    percentDelta: Math.round(
      ((ownPricePerSqmSar - peerAvgPricePerSqmSar) / peerAvgPricePerSqmSar) * 100
    ),
  };
}

export interface CitywidePriceBenchmark extends PriceStats {
  land_type: LandType;
  listing_type: ListingType;
}

// The "broader reference" fallback the admin persona is instructed to
// offer when a parcel's segment/district peer sample is too small to
// trust (see MIN_RELIABLE_PEER_SAMPLE_SIZE): every priced parcel of one
// land_type+listing_type, citywide — the coarsest cut, and reliably
// well-sampled (verified directly: the smallest of the four citywide
// groups in this dataset still has 9 parcels).
export function priceBenchmarksCitywide(): CitywidePriceBenchmark[] {
  const groups = groupPricesPerSqm(
    (parcel) => `${parcel.land_type}|${parcel.listing_type}`,
    (parcel) => ({ land_type: parcel.land_type, listing_type: parcel.listing_type })
  );

  return [...groups.values()]
    .map((group) => ({ ...group.fields, ...computePriceStats(group.pricesPerSqm) }))
    .sort((a, b) => a.land_type.localeCompare(b.land_type) || a.listing_type.localeCompare(b.listing_type));
}

// Shared grouping walk for every benchmark function above: buckets every
// priced parcel (excluding priceOnRequest) by whatever key/fields the
// caller wants, collecting each bucket's price_per_sqm_sar values for
// computePriceStats to reduce afterward. excludeParcelId additionally
// drops one specific parcel out of the walk entirely — see
// priceBenchmarksBySegment's docstring for why.
function groupPricesPerSqm<TFields>(
  keyOf: (parcel: Parcel) => string,
  fieldsOf: (parcel: Parcel) => TFields,
  excludeParcelId?: string
): Map<string, { fields: TFields; pricesPerSqm: number[] }> {
  const groups = new Map<string, { fields: TFields; pricesPerSqm: number[] }>();

  for (const parcel of parcels) {
    if (parcel.priceOnRequest) continue;
    if (parcel.parcel_id === excludeParcelId) continue;

    const key = keyOf(parcel);
    const existing = groups.get(key);
    if (existing) {
      existing.pricesPerSqm.push(parcel.price_per_sqm_sar);
    } else {
      groups.set(key, { fields: fieldsOf(parcel), pricesPerSqm: [parcel.price_per_sqm_sar] });
    }
  }

  return groups;
}

function computePriceStats(pricesPerSqm: number[]): PriceStats {
  const sorted = [...pricesPerSqm].sort((a, b) => a - b);
  const sum = sorted.reduce((total, price) => total + price, 0);

  return {
    sampleSize: sorted.length,
    avgPricePerSqmSar: Math.round(sum / sorted.length),
    medianPricePerSqmSar: Math.round(median(sorted)),
  };
}

// `sorted` must already be ascending — both call sites above sort before
// calling this, so it isn't repeated here.
function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
