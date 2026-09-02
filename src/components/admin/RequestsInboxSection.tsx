"use client";

import { formatDate, formatNumber, formatTemplate } from "@/lib/format";
import {
  areaOfCityLabels,
  landTypeLabels,
  listingTypeLabels,
  useLanguage,
  type Language,
  type TranslationKey,
} from "@/lib/i18n";
import type { SanadInquiryRecord } from "@/lib/types";

// The dedicated inbox: every lead Sanad has captured, newest first, in
// one place leadership can act on — both real-parcel interest and
// unmet requests. `records` is read once by the caller (the admin
// page's useLiveSanadInquiries hook) from sanadStore.ts and kept live
// via a "storage" event listener; this component only renders it.
export function RequestsInboxSection({ records }: { records: SanadInquiryRecord[] }) {
  const { language, t } = useLanguage();
  const interestCount = records.filter((record) => record.record_type === "interest").length;
  const unmetCount = records.length - interestCount;

  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-hairline bg-background p-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-xl font-semibold text-primary">{t("sanadFeedTitle")}</h2>
        <p className="text-sm text-muted">{t("sanadFeedSubtitle")}</p>
      </div>

      {records.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <CountPill count={interestCount} label={t("recordTypeInterest")} tone="interest" />
          <CountPill count={unmetCount} label={t("recordTypeUnmetLead")} tone="unmet" />
        </div>
      )}

      {records.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-hairline py-12 text-center">
          <p className="text-sm text-foreground">{t("sanadFeedEmpty")}</p>
          <p className="text-xs text-muted">{t("sanadFeedEmptyHint")}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {/* Newest first — sanadStore.ts appends newest-last. */}
          {[...records].reverse().map((record) => (
            <SanadFeedCard key={record.internal_id} record={record} language={language} t={t} />
          ))}
        </ul>
      )}
    </section>
  );
}

function CountPill({
  count,
  label,
  tone,
}: {
  count: number;
  label: string;
  tone: "interest" | "unmet";
}) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        tone === "interest" ? "bg-accent/15 text-primary" : "bg-[#b0453a]/10 text-[#b0453a]"
      }`}
    >
      {formatNumber(count)} · {label}
    </span>
  );
}

function SanadFeedCard({
  record,
  language,
  t,
}: {
  record: SanadInquiryRecord;
  language: Language;
  t: (key: TranslationKey) => string;
}) {
  const isInterest = record.record_type === "interest";

  return (
    <li className="flex flex-col gap-2 rounded-xl border border-hairline p-4 transition-colors hover:bg-foreground/[0.03]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* #b0453a matches DemandVsSupplySection's UNMET_NO_INVENTORY_COLOR
            so "unmet lead" reads as the same category everywhere it
            appears on the dashboard. */}
        <span
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
            isInterest ? "bg-accent/15 text-primary" : "bg-[#b0453a]/10 text-[#b0453a]"
          }`}
        >
          {t(isInterest ? "recordTypeInterest" : "recordTypeUnmetLead")}
        </span>
        <span className="text-xs text-muted">
          {record.inquiry_id} · {formatDate(record.date, language)}
        </span>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-3">
        <span className="font-semibold text-foreground">{record.investor_name}</span>
        <span className="text-xs text-muted" dir="ltr">
          {record.phone}
        </span>
      </div>

      <DetailsLine record={record} language={language} t={t} />

      {record.requested_parcel_id && (
        <p className="text-xs text-muted">
          {formatTemplate(t("sanadFeedRequestedParcel"), { id: record.requested_parcel_id })}
        </p>
      )}
      {record.wants_to && (
        <p className="text-xs text-muted">
          {formatTemplate(t("sanadFeedMessage"), { text: record.wants_to })}
        </p>
      )}
    </li>
  );
}

// Whatever this lead is about, built only from fields that are actually
// set — never invents a land type/area/budget the record doesn't carry
// (an "unmet_lead" can legitimately have none of them; see
// SanadInquiryRecord in src/lib/types.ts).
function DetailsLine({
  record,
  language,
  t,
}: {
  record: SanadInquiryRecord;
  language: Language;
  t: (key: TranslationKey) => string;
}) {
  const wantsParts: string[] = [];
  if (record.land_type_wanted) wantsParts.push(landTypeLabels[record.land_type_wanted][language]);
  if (record.area_of_city_wanted) wantsParts.push(areaOfCityLabels[record.area_of_city_wanted][language]);
  if (record.prefers) wantsParts.push(listingTypeLabels[record.prefers][language]);
  if (record.budget_sar !== null) {
    const suffix = record.prefers === "lease" ? ` ${t("perYearSuffix")}` : "";
    wantsParts.push(`${formatNumber(record.budget_sar)} ${t("sar")}${suffix}`);
  }

  if (!record.parcel_id && wantsParts.length === 0) {
    return <p className="text-sm text-muted">{t("sanadFeedNoDetails")}</p>;
  }

  return (
    <p className="text-sm text-foreground">
      {record.parcel_id && (
        <span className="font-serif font-semibold text-primary">{record.parcel_id}</span>
      )}
      {record.parcel_id && wantsParts.length > 0 && " · "}
      {wantsParts.join(" · ")}
    </p>
  );
}
