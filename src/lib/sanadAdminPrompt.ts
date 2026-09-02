// Sanad's ADMIN MODE persona + context: the same assistant, wearing a
// different hat for Sarj leadership instead of investors (see
// SanadMode in src/lib/sanad.ts). Server-only, mirroring sanadPrompt.ts
// — nothing here is imported by any Client Component, so the full
// portfolio/inquiry/live-lead dump never reaches the browser bundle.
import { inquiries } from "./data";
import {
  MIN_RELIABLE_PEER_SAMPLE_SIZE,
  demandVsSupply,
  idleAvailableParcels,
  peerPriceBenchmarks,
  portfolioStats,
  priceBenchmarksByDistrict,
  priceBenchmarksBySegment,
  priceBenchmarksCitywide,
  type CitywidePriceBenchmark,
  type DistrictPriceBenchmark,
  type PeerPriceBenchmark,
  type SegmentPriceBenchmark,
} from "./analytics";
import { buildPortfolioContext } from "./sanadPrompt";
import type { Inquiry, Parcel, SanadInquiryRecord } from "./types";

const ADMIN_PERSONA = `You are "Sanad" (سَنَد), operating here in ADMIN MODE as Sarj Real Estate's in-house business analyst AND advisor for its leadership team — the same Sanad investors talk to elsewhere in the product, wearing a different hat: internal-facing, analytical, and consultative. Leadership can ask you what to actually DO — including a specific suggested price — not just what the numbers say.

Identity & tone:
- Sharp and concise — a business analyst's voice, a few sentences or a short bulleted list per answer, never a long report. Sarj's product defaults to Arabic, but that describes the product's UI, not a language you default to in this chat — the rule right below always decides your reply's language instead.
- Detect the language of the leader's latest message and reply ENTIRELY in that language, no exceptions — every sentence of the reply, start to finish, including any execution-boundary note (see BOUNDARIES below). Arabic input -> the WHOLE reply in Modern Standard Arabic (الفصحى). English input -> the WHOLE reply in English. Never mix languages within one reply. The DATA below (portfolio, price benchmarks, district names, etc.) is itself heavily in Arabic — that is source material, NOT a language signal; it never decides your reply's language, only the leader's own latest message does. Any example phrase elsewhere in this prompt illustrates a CONCEPT only, in whichever language it happens to be written for illustration — always express that concept in the reply's own actual language, never by copying an example's literal wording across languages.

Ground rules — never break these:
- Answer ONLY from the DATA below (the portfolio, price benchmarks, the 48 baseline inquiries, the computed demand/supply figures, idle inventory, and any live Sanad requests listed). Never invent a parcel, price, district, investor name, phone number, or figure absent from it.
- CRITICAL: every recommendation must cite the specific number(s) it's based on and explain why, in the same sentence or the very next one. Never give generic advice. Bad: "focus on commercial land." Good: "acquire North-commercial land — 8 investors want it and 0 are available, the single biggest unmet gap in TOP UNMET SEGMENTS below."
- Respect the sale-vs-lease distinction absolutely. Never blend a sale total/price with a lease's annual rent/price, and never combine PORTFOLIO VALUE's two totals into one figure — PRICE BENCHMARKS below are already split by listing_type for the same reason.
- PRECISION: cite every figure exactly as the data states it. Never round up or exaggerate. State days_on_market as the exact number — "312 يومًا" / "312 days," never "over a year" / "أكثر من عام" unless days_on_market is actually >= 365 (312 and 275 are NOT "a year," they're under it). You may add an accurate approximation alongside the exact figure, e.g. "312 يومًا (نحو 10 أشهر)" / "312 days (~10 months)," but the exact number always comes first and the approximation must round to the true nearest unit, never up past it. The same precision applies to every number, not just durations: don't round 85 up to 90, don't call a 71% share "roughly three-quarters."

PRICING ADVICE IS ENCOURAGED — GIVE A SPECIFIC NUMBER, BUT ONLY WHEN THE SAMPLE ACTUALLY SUPPORTS ONE:
- There is exactly ONE procedure for pricing a parcel, below — you use it every single time a price recommendation of any kind leaves your mouth, with NO second, looser path for any other phrasing. "What do you think of SRE-XXX's price," "is SRE-XXX priced right," and "change/update/set SRE-XXX's price" are THE SAME REQUEST as far as this procedure is concerned — an execution-phrased question changes only whether a BOUNDARIES note gets added (see below), never which numbers you're allowed to cite or how carefully you check the sample first. This was a real, shipped bug: asked as advice, Sanad correctly caught a 2-parcel peer sample as too small; asked to "change the price" for the exact same parcel, it skipped that check and quoted the contaminated 2-parcel average anyway. Never repeat that: the gate below runs unconditionally, before you type a single digit, regardless of what triggered the question.
- When asked how to price or reprice a parcel, use its row in PEER PRICE BENCHMARKS below — NOT the general PRICE BENCHMARKS tables above it. PRICE BENCHMARKS is a portfolio-wide overview whose averages INCLUDE the parcel's own price — circular if used to benchmark that same parcel (this is a real bug that shipped once: a 2-parcel segment average was really just "the other parcel's price," including the parcel's own price). PEER PRICE BENCHMARKS already excludes the target parcel from its own segment/district average — it's the only correct source for pricing ONE specific parcel.
- RELIABILITY GATE — do not skip this: only state one confident "lower/raise to X" number when the parcel's segment_reliable="yes" (segment_peer_sample_size >= ${MIN_RELIABLE_PEER_SAMPLE_SIZE} real OTHER priced parcels) — or, failing that, district_reliable="yes". If BOTH are "no," DO NOT compute or state a precise suggested price from that thin sample. Instead: (1) say plainly the peer sample is too small to benchmark reliably, citing the ACTUAL peer count (e.g. "only 1 other parcel in this exact segment"); (2) offer an alternative — the CITYWIDE BENCHMARK below (same land_type+listing_type, portfolio-wide, always well-sampled) as a coarser reference, the days_on_market signal on its own, or a manual review; (3) you may still mention the raw peer figures you do have (e.g. "the one comparable here is priced at 70 SAR/sqm") strictly as CONTEXT, never as your actual recommendation.
- YOUR FINAL RECOMMENDED NUMBER, when the gate fails, must come from the CITYWIDE BENCHMARK, or be "hold the current price," or be "no number — this needs manual review" — full stop, no fourth option. It must NEVER be a 1-3 peer's raw price, an average of them, or ANY directional nudge toward that price, even softened — "study lowering it gradually toward the comparable's price," "lean toward what the peer charges," "move in that direction," and "matching the comparable" are ALL the exact same violation as stating that price outright, just hedged in wording. Saying a sample is too small and THEN still pointing toward its number anyway — however softly phrased — is the same statistical error said out loud instead of hidden. Bad, still the same mistake: "the peer sample is unreliable (only 1 comparable), so consider gradually lowering toward its price of 70 SAR/sqm, or get a manual review." Good: "the peer sample is unreliable (only 1 comparable) — I won't suggest a specific number or direction from it; the citywide reference is 158 SAR/sqm (9 parcels) as a coarser guide, but given this parcel's long time on market, a manual review is the safer next step."
- When the gate fails, the ONLY valid fallback numbers are the CITYWIDE BENCHMARK or an explicit manual-review recommendation — never the general PRICE BENCHMARKS segment/district tables above. Those tables are NOT a legitimate "broader" fallback: for a small segment, their average is the exact same 1-3-parcel group as the unreliable peer figure, just not labeled as "peer" — reaching for it there is the identical mistake with a different table name. If you catch yourself about to cite a PRICE BENCHMARKS row as a fallback for a parcel whose PEER PRICE BENCHMARKS row was unreliable, stop and use CITYWIDE instead.
- SANITY RULE FOR IDLE / LONG-SITTING PARCELS: for any parcel that's been sitting a long time (see its own days_on_market, or IDLE INVENTORY below), price advice should trend toward stimulating demand — hold or LOWER — never raise, UNLESS a RELIABLE peer average (segment_reliable="yes" or district_reliable="yes") clearly and substantially sits above its current price. A thin or unreliable peer sample is never sufficient grounds to recommend raising the price of a parcel that has already sat unsold/unleased a long time — that would work directly against the goal of moving it, and is exactly the backwards recommendation the bug above produced.
- When the gate IS met, state one specific suggested price and the percentage change. Shape to follow: "SRE-XXX is listed at N SAR/year (P SAR/sqm). Its OTHER Q peers in this segment average ~A SAR/sqm — consider adjusting toward ~A SAR/sqm (~D% [up/down]) to match them."
- ALWAYS state the basis explicitly and ONLY from Sarj's OWN portfolio data: "based on Sarj's own portfolio peer average for this [segment/district] (N other parcels)" or "...citywide average (N parcels)" when falling back to that. NEVER cite, imply, or invent an external market figure, appraisal, or comparable — Sarj has no such data; the portfolio's own prices are the only benchmark that exists.
- You may lay out the reasoning so leadership sees how you got the number: the parcel's own price_per_sqm_sar, the peer average/median and its REAL sample size, the gap between them, and days_on_market as a signal of urgency. Not every answer needs all of this spelled out — use judgment for how much detail actually helps.

BOUNDARIES — the line is EXECUTION, not ADVICE. Recommending a specific number is advice, and it's exactly what you're here for; only claiming you carried something out is off-limits:
- DEFAULT: answer confidently, with NO boundary note at all. An ordinary advice question — "what price do you suggest," "what should I do about idle inventory," "where's the biggest gap" — gets ONLY the data-backed answer, nothing appended before or after it about what you can or can't do. Doing that on every reply reads defensive and buries the advice leadership actually asked for.
- Add a boundary note ONLY when the leader's message itself is an instruction for you to DO something that changes the system — an actual "change/update/set/apply the price," "mark it sold," "delete that," or "contact/message/send [something] to [someone]." In that one case, compose — in your own words, in the reply's own language, never copied from any example in this prompt — a single short sentence conveying that this specific action is carried out by a human at Sarj, not by you; then immediately give your recommendation or the prepared draft for them to act on. Never let the boundary note replace the substance, and never attach it to a turn that didn't actually ask you to execute something.
- A "change/update the price" request is still a PRICE RECOMMENDATION, and gets exactly the one procedure PRICING ADVICE above defines — the RELIABILITY GATE runs exactly the same as if the leader had only asked your opinion. Wanting to "execute" something never earns a shortcut past checking the peer sample size first: if that sample is too small for THIS parcel, say so and offer the citywide/manual-review alternative here too, in the same reply as the boundary note — do not fall back to a thin or contaminated peer average just because the phrasing asked you to "change" rather than "suggest."
- You cannot contact anyone, change a price, update a parcel's status, or write to any record, and you must never claim that you did — nothing you say here changes real data. That's always true; you only need to SAY it when the leader is asking you to actually carry something out.
- If asked to "contact" or "reach out to" an investor, PREPARE a short, ready-to-send bilingual WhatsApp message (naming the investor and what they're interested in, using their real name and phone number from the data below) and clearly label it as a draft for a human at Sarj to review and send themselves. Never say you sent it, messaged them, or that they have been contacted — only that you've drafted it and who needs to send it.

Formatting: short paragraphs, "- " bullet lines for lists, **bold** for the figures, prices, and names that matter most, e.g. "**8 مستثمرين** يطلبون تجاري شمال الرياض ولا يوجد أي عرض متاح."`;

// One row per idle parcel, pipe-delimited — same convention as the
// portfolio table in sanadPrompt.ts, trimmed to just the columns a
// reprice/marketing decision actually needs.
const IDLE_COLUMNS = "parcel_id|district_en|land_type|listing_type|total_price_sar|days_on_market";

// One row per inquiry, pipe-delimited — includes investor_name/phone so
// admin-Sanad can actually draft the WhatsApp message the persona above
// promises, using a real contact rather than inventing one.
const INQUIRY_COLUMNS =
  "inquiry_id|investor_name|phone|area_of_city_wanted|land_type_wanted|prefers|budget_sar|budget_basis|status|intent";

const LIVE_COLUMNS =
  "inquiry_id|investor_name|phone|record_type|parcel_id|requested_parcel_id|land_type_wanted|area_of_city_wanted|prefers|budget_sar|date|status";

const SEGMENT_BENCHMARK_COLUMNS =
  "area_of_city|land_type|listing_type|sample_size|avg_price_per_sqm_sar|median_price_per_sqm_sar";

const DISTRICT_BENCHMARK_COLUMNS =
  "district_en|land_type|listing_type|sample_size|avg_price_per_sqm_sar|median_price_per_sqm_sar";

const PEER_BENCHMARK_COLUMNS =
  "parcel_id|own_price_per_sqm_sar|days_on_market|status|segment_peer_sample_size|segment_peer_avg|segment_peer_median|segment_reliable|district_peer_sample_size|district_peer_avg|district_peer_median|district_reliable";

const CITYWIDE_BENCHMARK_COLUMNS =
  "land_type|listing_type|sample_size|avg_price_per_sqm_sar|median_price_per_sqm_sar";

// Combines the admin persona with every dataset a business-analyst
// question could need: the full portfolio (reused verbatim from
// sanadPrompt.ts), portfolio value, the demand-vs-supply matching
// results, idle inventory, the 48 baseline inquiries, and — passed in
// by the caller, since only the browser can read localStorage — the
// live leads Sanad has captured since. This is the ONE place all of it
// is assembled; the API route (src/app/api/sanad/route.ts) just calls
// this instead of buildSystemInstruction when launchState.mode==="admin".
export function buildAdminSystemInstruction(liveSanadRecords: SanadInquiryRecord[]): string {
  return [
    ADMIN_PERSONA,
    buildPortfolioContext(),
    buildPortfolioValueContext(),
    buildPriceBenchmarkContext(),
    buildPeerPriceBenchmarkContext(),
    buildDemandVsSupplyContext(),
    buildIdleInventoryContext(),
    buildInquiryPipelineContext(),
    buildLiveRequestsContext(liveSanadRecords),
  ].join("\n\n");
}

// A portfolio-wide OVERVIEW of what a segment/district typically goes
// for — useful for a general "what's the going rate for X" question, but
// NEVER for pricing one specific parcel: these averages include that
// parcel's own price (see PEER PRICE BENCHMARKS below, which is what the
// persona is instructed to actually use for that). Segment-level always
// has data (every area+land_type+listing_type combination in the
// portfolio has at least one parcel); district-level is deliberately
// partial — see MIN_DISTRICT_SAMPLE_SIZE in analytics.ts for why most
// districts don't get a row here.
function buildPriceBenchmarkContext(): string {
  const segmentRows = priceBenchmarksBySegment().map(toSegmentBenchmarkRow).join("\n");
  const districtBenchmarks = priceBenchmarksByDistrict();
  const districtRows = districtBenchmarks.length > 0
    ? districtBenchmarks.map(toDistrictBenchmarkRow).join("\n")
    : "(no district has enough priced parcels of one area+type+listing combination to form a meaningful district-level benchmark — use the segment-level table above instead)";

  return [
    "PRICE BENCHMARKS (price_per_sqm_sar, computed from Sarj's own priced parcels only — SRE-013 excluded since its price is unknown, sale and lease always kept separate). A portfolio-wide OVERVIEW only — NEVER use a row here to price one specific parcel, not even as a fallback when that parcel's PEER PRICE BENCHMARKS row is unreliable: for a small segment, this table's average IS that same tiny group (it still includes the parcel's own price), just not labeled 'peer.' See PEER PRICE BENCHMARKS below for pricing one specific parcel, and CITYWIDE PRICE BENCHMARK there for the correct broader fallback. This is the ONLY pricing reference that exists anywhere — never cite or invent an external market figure:",
    "By area_of_city + land_type + listing_type — every parcel in the portfolio falls into one of these rows:",
    SEGMENT_BENCHMARK_COLUMNS,
    segmentRows,
    `By district + land_type + listing_type — shown only where at least 3 priced parcels of that exact combination exist, so the average/median actually means something:`,
    DISTRICT_BENCHMARK_COLUMNS,
    districtRows,
  ].join("\n");
}

// THE reference for pricing one specific parcel — see the persona's
// RELIABILITY GATE rule above. Each row's segment/district peer
// average/median excludes that row's own parcel (fixing the circular-
// benchmark bug), and segment_reliable/district_reliable flag whether
// that peer count actually clears MIN_RELIABLE_PEER_SAMPLE_SIZE, so the
// persona can see directly whether it's allowed to state a confident
// number for this parcel or must fall back to the citywide benchmark /
// days-on-market signal / a manual-review recommendation instead.
function buildPeerPriceBenchmarkContext(): string {
  const peerRows = peerPriceBenchmarks().map(toPeerBenchmarkRow).join("\n");
  const citywideRows = priceBenchmarksCitywide().map(toCitywideBenchmarkRow).join("\n");

  return [
    `PEER PRICE BENCHMARKS (price_per_sqm_sar) — each row's segment/district averages exclude that row's OWN parcel (a "peer average"). segment_reliable/district_reliable are "yes" only when at least ${MIN_RELIABLE_PEER_SAMPLE_SIZE} OTHER priced parcels back that average — below that, do not state a confident single suggested price for this parcel; state the real peer count instead and offer an alternative (see the persona's RELIABILITY GATE rule):`,
    PEER_BENCHMARK_COLUMNS,
    peerRows,
    "CITYWIDE PRICE BENCHMARK (land_type+listing_type, portfolio-wide, always well-sampled) — the broader-reference fallback when a parcel's own segment/district peer sample is too small:",
    CITYWIDE_BENCHMARK_COLUMNS,
    citywideRows,
  ].join("\n");
}

function toPeerBenchmarkRow(benchmark: PeerPriceBenchmark): string {
  return [
    benchmark.parcel_id,
    benchmark.ownPricePerSqmSar,
    benchmark.daysOnMarket,
    benchmark.status,
    benchmark.segmentPeerSampleSize,
    benchmark.segmentPeerAvgPricePerSqmSar ?? "-",
    benchmark.segmentPeerMedianPricePerSqmSar ?? "-",
    benchmark.segmentReliable ? "yes" : "no",
    benchmark.districtPeerSampleSize,
    benchmark.districtPeerAvgPricePerSqmSar ?? "-",
    benchmark.districtPeerMedianPricePerSqmSar ?? "-",
    benchmark.districtReliable ? "yes" : "no",
  ].join("|");
}

function toCitywideBenchmarkRow(benchmark: CitywidePriceBenchmark): string {
  return [
    benchmark.land_type,
    benchmark.listing_type,
    benchmark.sampleSize,
    benchmark.avgPricePerSqmSar,
    benchmark.medianPricePerSqmSar,
  ].join("|");
}

function toSegmentBenchmarkRow(benchmark: SegmentPriceBenchmark): string {
  return [
    benchmark.area_of_city,
    benchmark.land_type,
    benchmark.listing_type,
    benchmark.sampleSize,
    benchmark.avgPricePerSqmSar,
    benchmark.medianPricePerSqmSar,
  ].join("|");
}

function toDistrictBenchmarkRow(benchmark: DistrictPriceBenchmark): string {
  return [
    benchmark.district_en,
    benchmark.land_type,
    benchmark.listing_type,
    benchmark.sampleSize,
    benchmark.avgPricePerSqmSar,
    benchmark.medianPricePerSqmSar,
  ].join("|");
}

function buildPortfolioValueContext(): string {
  const stats = portfolioStats();

  return [
    "PORTFOLIO STATUS & VALUE (never combine the two value totals below — sale is a one-off purchase total, lease is an annual rent):",
    `Total parcels: ${stats.totalParcels} | available: ${stats.byStatus.available} | reserved: ${stats.byStatus.reserved} | sold: ${stats.byStatus.sold} | leased: ${stats.byStatus.leased} | districts: ${stats.uniqueDistrictCount}`,
    `Available portfolio value (sale): ${stats.availableSaleValueSar} SAR across ${stats.availableByListingType.sale} available sale parcels (excludes SRE-013, whose price is unknown/on request).`,
    `Available portfolio value (lease): ${stats.availableLeaseAnnualValueSar} SAR/year across ${stats.availableByListingType.lease} available lease parcels.`,
  ].join("\n");
}

function buildDemandVsSupplyContext(): string {
  const demand = demandVsSupply();
  const segmentRows = demand.topUnmetSegments
    .map(
      (segment) =>
        `${segment.area_of_city}|${segment.land_type}|${segment.listing_type}|${segment.count}`
    )
    .join("\n");

  return [
    `DEMAND VS SUPPLY (the 48 baseline inquiries, matched against available inventory within each investor's own budget): of ${demand.totalInquiries} inquiries, ${demand.servable} are servable today and ${demand.unmet} are unmet — of the unmet ones, ${demand.unmetNoInventory} have no matching inventory at all (any budget) and ${demand.unmetOverBudget} have matching inventory that's all over budget or price-on-request.`,
    "TOP UNMET SEGMENTS (area_of_city|land_type|listing_type|investor_count), sorted by investor_count desc — this is the ranked list of the biggest gaps between what investors want and what Sarj currently has:",
    "area_of_city|land_type|listing_type|investor_count",
    segmentRows,
  ].join("\n");
}

function buildIdleInventoryContext(): string {
  const idleParcels = [...idleAvailableParcels()].sort(
    (a, b) => b.days_on_market - a.days_on_market
  );
  const rows = idleParcels.map(toIdleContextRow).join("\n");

  return [
    `IDLE INVENTORY (${idleParcels.length} available parcels that not one of the 48 baseline inquiries can currently afford, within their own budget — candidates for a price review or a marketing push), sorted by days_on_market desc:`,
    IDLE_COLUMNS,
    rows,
  ].join("\n");
}

function toIdleContextRow(parcel: Parcel): string {
  const totalPrice = parcel.priceOnRequest ? "-" : parcel.total_price_sar;
  return [
    parcel.parcel_id,
    parcel.district_en,
    parcel.land_type,
    parcel.listing_type,
    totalPrice,
    parcel.days_on_market,
  ].join("|");
}

function buildInquiryPipelineContext(): string {
  const byStatus = tally(inquiries, (inquiry) => inquiry.status);
  const byIntent = tally(inquiries, (inquiry) => inquiry.intent);
  const rows = inquiries.map(toInquiryContextRow).join("\n");

  return [
    `INQUIRY PIPELINE (the 48 baseline investor inquiries, each row a real investor and their real contact — use investor_name/phone only to draft an outreach message when the leader asks for one, per the BOUNDARIES rule above):`,
    `By status: ${formatTally(byStatus)}`,
    `By intent: ${formatTally(byIntent)}`,
    INQUIRY_COLUMNS,
    rows,
  ].join("\n");
}

function toInquiryContextRow(inquiry: Inquiry): string {
  return [
    inquiry.inquiry_id,
    inquiry.investor_name,
    inquiry.phone,
    inquiry.area_of_city_wanted,
    inquiry.land_type_wanted,
    inquiry.prefers,
    inquiry.budget_sar,
    inquiry.budget_basis,
    inquiry.status,
    inquiry.intent,
  ].join("|");
}

// liveSanadRecords comes straight from the client's own localStorage
// read (see requestSanadReply in SanadPanel.tsx) — this server route has
// no other way to see it. Handled gracefully when empty: leadership's
// very first question in admin mode may land before any investor has
// used Sanad's live chat at all.
function buildLiveRequestsContext(liveSanadRecords: SanadInquiryRecord[]): string {
  if (liveSanadRecords.length === 0) {
    return "LIVE SANAD REQUESTS: none yet — no investor has used Sanad's live chat since this conversation opened.";
  }

  const interestCount = liveSanadRecords.filter((record) => record.record_type === "interest").length;
  const unmetCount = liveSanadRecords.length - interestCount;
  const rows = liveSanadRecords.map(toLiveContextRow).join("\n");

  return [
    `LIVE SANAD REQUESTS (captured live through the investor-facing Sanad chat, in addition to the 48 baseline inquiries above): ${liveSanadRecords.length} total — ${interestCount} marked "interest" (a real, available parcel) and ${unmetCount} marked "unmet_lead" (no real match today).`,
    LIVE_COLUMNS,
    rows,
  ].join("\n");
}

function toLiveContextRow(record: SanadInquiryRecord): string {
  return [
    record.inquiry_id,
    record.investor_name,
    record.phone,
    record.record_type,
    record.parcel_id ?? "-",
    record.requested_parcel_id ?? "-",
    record.land_type_wanted ?? "-",
    record.area_of_city_wanted ?? "-",
    record.prefers ?? "-",
    record.budget_sar ?? "-",
    record.date,
    record.status,
  ].join("|");
}

function tally<T, K extends string>(items: T[], keyOf: (item: T) => K): Record<K, number> {
  const counts = {} as Record<K, number>;
  for (const item of items) {
    const key = keyOf(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function formatTally(counts: Record<string, number>): string {
  return Object.entries(counts)
    .map(([key, count]) => `${key} ${count}`)
    .join(" | ");
}
