"use client";

import { formatNumber } from "@/lib/format";
import { useLanguage, type TranslationKey } from "@/lib/i18n";

export type AdminTabId = "overview" | "requests" | "idle" | "pipeline";

interface AdminTabDef {
  id: AdminTabId;
  labelKey: TranslationKey;
}

const ADMIN_TABS: AdminTabDef[] = [
  { id: "overview", labelKey: "tabOverview" },
  { id: "requests", labelKey: "tabRequests" },
  { id: "idle", labelKey: "tabIdleInventory" },
  { id: "pipeline", labelKey: "tabPipeline" },
];

// The dashboard's workspace nav. Plain flex-row + logical CSS (inset-x-0
// for the active underline, the browser's own dir-aware row ordering) —
// no manual RTL branching needed, the same convention the rest of the
// app relies on via dir="rtl"/"ltr" on <html>.
//
// The row WRAPS rather than scrolling horizontally: the four Arabic
// labels total roughly 435px, wider than a 390px phone's ~342px of
// content width, so a single row necessarily cut the last tab
// ("حالة الطلبات") off mid-word — and a clipped label a reader has to
// discover by swiping is worse than a second row they can just see.
// Wrapping costs nothing above mobile, where all four fit on one line
// anyway and the wrap never triggers. Mobile also gets tighter
// horizontal padding (px-3) to keep the wrapped rows compact.
export function AdminTabNav({
  active,
  onChange,
  requestsBadgeCount,
}: {
  active: AdminTabId;
  onChange: (tab: AdminTabId) => void;
  requestsBadgeCount: number;
}) {
  const { t } = useLanguage();

  return (
    <nav role="tablist" className="flex flex-wrap gap-1 border-b border-hairline">
      {ADMIN_TABS.map((tab) => {
        const isActive = tab.id === active;
        const badgeCount = tab.id === "requests" ? requestsBadgeCount : 0;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`relative flex items-center gap-2 px-3 py-3 text-sm font-medium transition-colors sm:px-4 ${
              isActive ? "text-primary" : "text-muted hover:text-foreground"
            }`}
          >
            {t(tab.labelKey)}
            {badgeCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-background">
                {formatNumber(badgeCount)}
              </span>
            )}
            {isActive && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />}
          </button>
        );
      })}
    </nav>
  );
}
