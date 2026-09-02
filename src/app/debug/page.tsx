// Temporary debug page — prints the data layer's raw numbers as plain text
// for manual verification. No UI styling. Safe to delete once verified.

import { inquiries, getParcelById } from "@/lib/data";
import { matchInquiryToParcels, portfolioStats, demandVsSupply } from "@/lib/analytics";

export default function DebugPage() {
  const stats = portfolioStats();
  const demand = demandVsSupply();
  const sre098 = getParcelById("SRE-098");
  const sre013 = getParcelById("SRE-013");

  const lines: string[] = [];

  lines.push("=== PORTFOLIO STATS ===");
  lines.push(`Total parcels: ${stats.totalParcels}`);
  lines.push(`By status: ${JSON.stringify(stats.byStatus)}`);
  lines.push(`Available: ${stats.availableCount}`);
  lines.push(`Available (sale): ${stats.availableByListingType.sale}`);
  lines.push(`Available (lease): ${stats.availableByListingType.lease}`);
  lines.push("");

  lines.push("=== DATA CORRECTIONS CHECK ===");
  lines.push(
    `SRE-098 lat/lng (expect ~24.53, ~46.64): ${sre098?.lat}, ${sre098?.lng}`
  );
  lines.push(`SRE-013 priceOnRequest (expect true): ${sre013?.priceOnRequest}`);
  lines.push(`SRE-013 total_price_sar (expect null): ${sre013?.total_price_sar}`);
  lines.push(`SRE-013 status (expect available): ${sre013?.status}`);
  lines.push("");

  lines.push("=== DEMAND VS SUPPLY ===");
  lines.push(`Total inquiries: ${demand.totalInquiries}`);
  lines.push(`Servable: ${demand.servable}`);
  lines.push(`Unmet: ${demand.unmet}`);
  lines.push(`  - No matching inventory at all: ${demand.unmetNoInventory}`);
  lines.push(`  - Inventory exists but over budget: ${demand.unmetOverBudget}`);
  lines.push("");
  lines.push("Top unmet segments (area / land_type / listing_type: count):");
  for (const seg of demand.topUnmetSegments) {
    lines.push(
      `  ${seg.area_of_city} / ${seg.land_type} / ${seg.listing_type}: ${seg.count}`
    );
  }
  lines.push("");
  lines.push(
    `Idle parcels — available, matched by zero inquiries (${demand.idleParcelIds.length}):`
  );
  lines.push(`  ${demand.idleParcelIds.join(", ") || "(none)"}`);
  lines.push("");

  lines.push("=== SAMPLE MATCH (first inquiry) ===");
  const sample = inquiries[0];
  const matches = matchInquiryToParcels(sample);
  lines.push(
    `Inquiry ${sample.inquiry_id}: wants ${sample.land_type_wanted} ${sample.prefers} in ${sample.area_of_city_wanted}, budget ${sample.budget_sar} SAR (${sample.budget_basis})`
  );
  lines.push(`Matches: ${matches.length}`);
  for (const m of matches) {
    lines.push(`  ${m.parcel_id} — ${m.total_price_sar} SAR (${m.price_basis})`);
  }

  return <pre>{lines.join("\n")}</pre>;
}
