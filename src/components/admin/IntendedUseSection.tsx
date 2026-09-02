"use client";

import { formatNumber, formatTemplate } from "@/lib/format";
import {
  intendedUseLabels,
  useCategoryLabels,
  useLanguage,
  type Language,
  type TranslationKey,
} from "@/lib/i18n";
import {
  isBusinessUseDominant,
  type IntendedUseCount,
  type UseCategoryBreakdown,
} from "@/lib/analytics";
import type { UseCategory } from "@/lib/types";
import { HorizontalBarList } from "@/components/admin/charts";

// Three neutral brand tokens, not the warm-alert palette the demand-gap
// section uses: these categories are a description of the customer base,
// not a problem to flag, and colouring them like a warning would say
// something the data doesn't.
const USE_CATEGORY_COLORS: Record<UseCategory, string> = {
  business: "var(--color-accent)",
  development: "var(--color-primary)",
  personal: "var(--status-sold)",
};

// What the 48 inquiries say investors actually intend to DO with the
// land — the one column that describes the demand itself rather than its
// location, budget, or type. Two reads of the same 48 rows: the coarse
// split (is this a commercial customer base or a residential one?) and
// the specific purposes underneath it.
//
// Both breakdowns and the takeaway are computed in analytics.ts; this
// component only labels and lays them out.
export function IntendedUseSection({
  uses,
  categories,
}: {
  uses: IntendedUseCount[];
  categories: UseCategoryBreakdown;
}) {
  const { language, t } = useLanguage();

  return (
    <section className="flex flex-col gap-6 rounded-2xl border border-hairline bg-background p-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-xl font-semibold text-primary">
          {t("intendedUseSectionTitle")}
        </h2>
        <p className="text-sm text-muted">
          {formatTemplate(t("intendedUseSectionSubtitle"), {
            total: formatNumber(categories.total),
          })}
        </p>
      </div>

      <p className="rounded-xl border border-hairline bg-foreground/[0.03] px-4 py-3 text-sm font-semibold text-primary">
        {buildTakeaway(categories, language, t)}
      </p>

      {/* Two columns, same convention as the demand-vs-supply card above:
          plain flex items with a basis floor, no direction-specific
          classes, so the browser's own RTL/LTR ordering mirrors them. */}
      <div className="flex flex-wrap items-start gap-8">
        <div className="flex flex-1 basis-72 flex-col gap-3 min-w-64">
          <span className="section-label">{t("intendedUseByCategory")}</span>
          <HorizontalBarList data={buildCategoryData(categories, language)} />
        </div>
        <div className="flex flex-1 basis-72 flex-col gap-3 min-w-64">
          <span className="section-label">{t("intendedUseByUse")}</span>
          <HorizontalBarList data={buildUseData(uses, language)} />
        </div>
      </div>
    </section>
  );
}

// The headline reading. The "mostly commercial" line is only asserted
// when isBusinessUseDominant confirms it against the real counts —
// otherwise this names whichever category actually leads, so the sentence
// can never outrun the data behind it.
function buildTakeaway(
  categories: UseCategoryBreakdown,
  language: Language,
  t: (key: TranslationKey) => string
): string {
  if (isBusinessUseDominant(categories)) {
    return formatTemplate(t("intendedUseTakeawayBusiness"), {
      count: formatNumber(categories.business),
      total: formatNumber(categories.total),
    });
  }

  const [leadingCategory, leadingCount] = findLeadingCategory(categories);
  return formatTemplate(t("intendedUseTakeawayLeading"), {
    category: useCategoryLabels[leadingCategory][language],
    count: formatNumber(leadingCount),
    total: formatNumber(categories.total),
  });
}

function findLeadingCategory(
  categories: UseCategoryBreakdown
): [UseCategory, number] {
  const ranked: [UseCategory, number][] = [
    ["business", categories.business],
    ["development", categories.development],
    ["personal", categories.personal],
  ];

  return ranked.reduce((leader, entry) => (entry[1] > leader[1] ? entry : leader));
}

function buildCategoryData(categories: UseCategoryBreakdown, language: Language) {
  const rows: { label: string; value: number; color: string }[] = [
    {
      label: useCategoryLabels.business[language],
      value: categories.business,
      color: USE_CATEGORY_COLORS.business,
    },
    {
      label: useCategoryLabels.development[language],
      value: categories.development,
      color: USE_CATEGORY_COLORS.development,
    },
    {
      label: useCategoryLabels.personal[language],
      value: categories.personal,
      color: USE_CATEGORY_COLORS.personal,
    },
  ];

  return rows.sort((a, b) => b.value - a.value);
}

// Already sorted by count in analytics.ts — only labelled here. A
// wants_to value with no translation falls back to the raw string from
// the data rather than rendering an empty row, so a future value still
// shows up honestly (see intendedUseLabels' own note).
function buildUseData(uses: IntendedUseCount[], language: Language) {
  return uses.map((use) => ({
    label: intendedUseLabels[use.wantsTo]?.[language] ?? use.wantsTo,
    value: use.count,
    color: use.category
      ? USE_CATEGORY_COLORS[use.category]
      : "var(--color-muted)",
  }));
}
