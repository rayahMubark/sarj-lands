"use client";

import { formatNumber, formatTemplate } from "@/lib/format";
import { landTypeLabels, useLanguage, type TranslationKey } from "@/lib/i18n";
import type { Parcel } from "@/lib/types";

// Available parcels matching zero inquiries within budget (see
// idleAvailableParcels in src/lib/analytics.ts) — sorted by the caller,
// longest-sitting first, since that's the one column leadership most
// wants ranked. This component only renders; it doesn't decide idleness.
export function IdleInventorySection({ idleParcels }: { idleParcels: Parcel[] }) {
  const { language, t } = useLanguage();

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-hairline bg-background p-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-xl font-semibold text-primary">
          {t("idleSectionTitle")}
        </h2>
        <p className="text-sm text-foreground">
          {formatTemplate(t("idleSectionCount"), {
            count: formatNumber(idleParcels.length),
          })}
        </p>
        <p className="text-sm text-muted">{t("idleSectionTakeaway")}</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-hairline">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-hairline bg-foreground/[0.03] text-start text-xs text-muted">
              <Th>{t("tableColParcelId")}</Th>
              <Th>{t("tableColDistrict")}</Th>
              <Th>{t("tableColType")}</Th>
              <Th align="end">{t("tableColPrice")}</Th>
              <Th align="end">{t("tableColDays")}</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {idleParcels.map((parcel) => (
              <tr key={parcel.parcel_id} className="transition-colors hover:bg-foreground/[0.03]">
                <Td className="font-serif font-semibold text-primary">{parcel.parcel_id}</Td>
                <Td>{language === "ar" ? parcel.district_ar : parcel.district_en}</Td>
                <Td>{landTypeLabels[parcel.land_type][language]}</Td>
                <Td align="end">{formatCompactPrice(parcel, t)}</Td>
                <Td align="end" className="font-semibold text-primary">
                  {formatNumber(parcel.days_on_market)}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// Same price-basis handling as PriceBlock (src/components/ParcelCard.tsx)
// compressed to one line for a table cell: sale is a one-off total, lease
// always carries "/year", SRE-013-style unknown prices show as "price on
// request" rather than a guessed figure.
function formatCompactPrice(parcel: Parcel, t: (key: TranslationKey) => string): string {
  if (parcel.priceOnRequest) return t("priceOnRequest");
  const suffix = parcel.listing_type === "lease" ? ` ${t("perYearSuffix")}` : "";
  return `${formatNumber(parcel.total_price_sar)} ${t("sar")}${suffix}`;
}

function Th({
  children,
  align = "start",
}: {
  children: React.ReactNode;
  align?: "start" | "end";
}) {
  return (
    <th className={`px-4 py-3 font-medium ${align === "end" ? "text-end" : "text-start"}`}>
      {children}
    </th>
  );
}

function Td({
  children,
  align = "start",
  className = "",
}: {
  children: React.ReactNode;
  align?: "start" | "end";
  className?: string;
}) {
  return (
    <td className={`px-4 py-3 text-foreground ${align === "end" ? "text-end" : "text-start"} ${className}`}>
      {children}
    </td>
  );
}
