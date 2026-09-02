"use client";

import { intentLabels, inquiryStatusLabels, useLanguage } from "@/lib/i18n";
import type { Inquiry, Intent, InquiryStatus } from "@/lib/types";
import { HorizontalBarList } from "@/components/admin/charts";

const STATUS_ORDER: InquiryStatus[] = ["new", "contacted", "negotiating"];
const INTENT_ORDER: Intent[] = ["ready to move", "comparing options", "exploring"];

// The 48 seed inquiries' shape, tallied here purely for display — this
// is simple counting, not the kind of matching logic analytics.ts owns.
// The live Sanad feed used to live at the bottom of this section; it now
// has its own dedicated inbox tab (RequestsInboxSection.tsx).
export function PipelineSection({ inquiries }: { inquiries: Inquiry[] }) {
  const { language, t } = useLanguage();
  const statusData = STATUS_ORDER.map((status) => ({
    label: inquiryStatusLabels[status][language],
    value: inquiries.filter((inquiry) => inquiry.status === status).length,
  }));
  const intentData = INTENT_ORDER.map((intent) => ({
    label: intentLabels[intent][language],
    value: inquiries.filter((inquiry) => inquiry.intent === intent).length,
  }));

  return (
    <section className="flex flex-col gap-6 rounded-2xl border border-hairline bg-background p-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-xl font-semibold text-primary">
          {t("pipelineSectionTitle")}
        </h2>
        <p className="text-sm text-muted">
          {t("pipelineSectionSubtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
        <div className="flex flex-col gap-3">
          <span className="section-label">{t("pipelineByStatus")}</span>
          <HorizontalBarList data={statusData} />
        </div>
        <div className="flex flex-col gap-3">
          <span className="section-label">{t("pipelineByIntent")}</span>
          <HorizontalBarList data={intentData} />
        </div>
      </div>
    </section>
  );
}
