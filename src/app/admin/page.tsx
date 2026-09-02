"use client";

import { useEffect, useState } from "react";
import { formatNumber } from "@/lib/format";
import { useLanguage } from "@/lib/i18n";
import { parcels, inquiries } from "@/lib/data";
import {
  demandByIntendedUse,
  demandByUseCategory,
  demandVsSupply,
  idleAvailableParcels,
  portfolioStats,
  type DemandVsSupply,
  type IntendedUseCount,
  type PortfolioStats,
  type UseCategoryBreakdown,
} from "@/lib/analytics";
import { STORAGE_KEY, getSanadInquiriesForDisplay } from "@/lib/sanadStore";
import { SEED_SANAD_RECORDS } from "@/lib/sanadSeed";
import type { SanadInquiryRecord } from "@/lib/types";
import { AdminTabNav, type AdminTabId } from "@/components/admin/AdminTabs";
import { DemandVsSupplySection } from "@/components/admin/DemandVsSupplySection";
import { IdleInventorySection } from "@/components/admin/IdleInventorySection";
import { IntendedUseSection } from "@/components/admin/IntendedUseSection";
import { PipelineSection } from "@/components/admin/PipelineSection";
import { RequestsInboxSection } from "@/components/admin/RequestsInboxSection";

// Leadership's live view of the portfolio: what's on the books, what
// investors actually want that today's inventory can't serve, which
// parcels are quietly going nowhere, and — proving the loop closes
// without anyone re-keying anything — every lead Sanad has captured so
// far. No login: this is a public route per the brief, matching every
// other page in the app — reachable directly by URL, just never linked
// from the investor-facing UI (see the Header/Footer comments on
// isAdminRoute). In production this route would sit behind staff
// authentication (e.g. a middleware/session check gating /admin), not
// rely on obscurity. Every number here is read straight from
// analytics.ts's matching engine and sanadStore.ts — this page composes
// and presents, it doesn't compute.
//
// Laid out as a workspace with tabs rather than one long scroll: an
// executive-summary overview, a dedicated requests inbox, the idle-
// inventory table, and the pipeline breakdown each get their own tab so
// leadership can go straight to what they need instead of scrolling
// past three other sections first.
export default function AdminPage() {
  const stats = portfolioStats();
  const demand = demandVsSupply();
  const idleParcels = [...idleAvailableParcels()].sort(
    (a, b) => b.days_on_market - a.days_on_market
  );
  const intendedUses = demandByIntendedUse();
  const useCategories = demandByUseCategory();
  const sanadRecords = useLiveSanadInquiries();
  const [activeTab, setActiveTab] = useState<AdminTabId>("overview");

  return (
    // pb-28: Sanad's launcher is fixed to the bottom corner (see SanadFab
    // in src/components/SanadPanel.tsx, bottom-4 + ~41px tall) and was
    // sitting on top of the last KPI card on a phone, where the grid runs
    // all the way to the container's edge. Reserving that strip below the
    // content keeps the FAB over empty space instead of over a figure.
    // sm:pb-10 restores the normal footer gap once the wider layout puts
    // the launcher clear of the content anyway.
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 pt-10 pb-28 sm:pb-10">
      <AdminHeader />
      <AdminTabNav
        active={activeTab}
        onChange={setActiveTab}
        requestsBadgeCount={sanadRecords.length}
      />

      {activeTab === "overview" && (
        <OverviewTab
          stats={stats}
          demand={demand}
          intendedUses={intendedUses}
          useCategories={useCategories}
        />
      )}
      {activeTab === "requests" && <RequestsInboxSection records={sanadRecords} />}
      {activeTab === "idle" && <IdleInventorySection idleParcels={idleParcels} />}
      {activeTab === "pipeline" && <PipelineSection inquiries={inquiries} />}
    </div>
  );
}

// The executive summary: spacious on purpose, two clearly separated
// blocks (portfolio snapshot, then demand/opportunity) rather than a
// dense grid — this is the tab leadership lands on first.
function OverviewTab({
  stats,
  demand,
  intendedUses,
  useCategories,
}: {
  stats: PortfolioStats;
  demand: DemandVsSupply;
  intendedUses: IntendedUseCount[];
  useCategories: UseCategoryBreakdown;
}) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-10 py-2">
      <div className="flex flex-col gap-4">
        <span className="section-label">{t("overviewKpiEyebrow")}</span>
        <KpiRow stats={stats} />
      </div>
      <div className="border-t border-hairline pt-8">
        <DemandVsSupplySection demand={demand} parcels={parcels} />
      </div>
      {/* What that demand is actually FOR — the wants_to read, sitting
          directly under the demand-vs-supply card it explains. */}
      <IntendedUseSection uses={intendedUses} categories={useCategories} />
    </div>
  );
}

// Reads Sanad's captured leads once on mount, then keeps listening for
// changes written from OTHER tabs — the browser's own "storage" event
// never fires for a write made in the same tab that made it. So if an
// investor is using Sanad in one tab while this dashboard sits open in
// another, the live feed below updates on its own, no refresh needed:
// exactly the "closes the loop live" claim this section makes.
function useLiveSanadInquiries(): SanadInquiryRecord[] {
  // Starts with the demo seed backlog alone (see sanadSeed.ts) — exactly
  // what the server renders, since the seeds are static and the
  // localStorage half of getSanadInquiriesForDisplay degrades to [] off
  // the browser. Matching the server's output precisely is the point:
  // reading real browser data in a lazy useState initializer would
  // diverge from the prerender and trigger a hydration mismatch —
  // verified directly by seeding localStorage before load and watching
  // React log exactly that. Seeding the initial value this way also
  // means the prerendered HTML already shows a populated inbox rather
  // than an empty state that fills in a frame later.
  const [records, setRecords] = useState<SanadInquiryRecord[]>(() => [
    ...SEED_SANAD_RECORDS,
  ]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see the useState comment above: this is the deferred post-hydration read that folds this browser's own captured leads in on top of the seeds, immediately followed by subscribing to further changes — not a redundant render trigger.
    setRecords(getSanadInquiriesForDisplay());

    function handleStorageChange(event: StorageEvent) {
      if (event.key === STORAGE_KEY || event.key === null) {
        setRecords(getSanadInquiriesForDisplay());
      }
    }

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  return records;
}

function AdminHeader() {
  const { t } = useLanguage();

  return (
    <div className="brand-grain flex flex-col gap-2 rounded-2xl border border-hairline px-6 py-8">
      <h1 className="font-heading text-3xl font-semibold text-primary sm:text-4xl">
        {t("adminTitle")}
      </h1>
      <p className="max-w-xl text-sm text-foreground/80">{t("adminSubtitle")}</p>
    </div>
  );
}

function KpiRow({ stats }: { stats: PortfolioStats }) {
  const { t } = useLanguage();

  return (
    <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
      <StatCard label={t("kpiTotalParcels")} value={formatNumber(stats.totalParcels)} />
      <StatCard label={t("kpiAvailable")} value={formatNumber(stats.byStatus.available)} />
      <StatCard label={t("kpiReserved")} value={formatNumber(stats.byStatus.reserved)} />
      <StatCard label={t("kpiSold")} value={formatNumber(stats.byStatus.sold)} />
      <StatCard label={t("kpiLeased")} value={formatNumber(stats.byStatus.leased)} />
      <StatCard
        label={t("kpiDistricts")}
        value={formatNumber(stats.uniqueDistrictCount)}
        caption={t("kpiDistrictsCaption")}
      />
      {/* Two separate value cards, never one combined figure — a sale
          total and a lease annual rent are different scales (see
          PortfolioStats's own docstring in src/lib/analytics.ts) and
          summing them would misrepresent the portfolio. */}
      <StatCard
        label={t("kpiSaleValue")}
        value={`${formatNumber(stats.availableSaleValueSar)} ${t("sar")}`}
        caption={t("kpiSaleValueCaption")}
      />
      <StatCard
        label={t("kpiLeaseValue")}
        value={`${formatNumber(stats.availableLeaseAnnualValueSar)} ${t("sar")} ${t("perYearSuffix")}`}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-hairline bg-background p-5">
      <span className="text-xs font-medium text-muted">{label}</span>
      <span className="font-heading text-xl font-bold text-primary sm:text-2xl">{value}</span>
      {caption && <span className="text-[11px] text-muted">{caption}</span>}
    </div>
  );
}
