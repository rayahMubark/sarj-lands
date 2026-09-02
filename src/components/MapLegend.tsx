import { useState, type ReactNode } from "react";
import { landTypeLabels, statusLabels, useLanguage } from "@/lib/i18n";
import { STATUS_PIN_COLORS } from "@/lib/mapTheme";
import type { LandType, ParcelStatus } from "@/lib/types";

const STATUS_ORDER: ParcelStatus[] = ["available", "reserved", "sold", "leased"];
const LAND_TYPE_ORDER: LandType[] = ["commercial", "residential"];

// The map encodes two things at once — status by pin color, land type by
// pin shape — so it needs two labeled sections, not one. Always visible on
// desktop; collapses behind a small "؟" button on mobile so it doesn't
// cover the map. Swatches read STATUS_PIN_COLORS, the same map the pins
// themselves use, so every color/shape here is the pin's actual value.
export function MapLegend() {
  const { language, t } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    // z-[1002]: Leaflet's own zoom/attribution controls sit at z-index
    // 1000 by default (leaflet.css) and were intercepting clicks meant for
    // this button — has to clear that. ParcelSidePanel is z-[1003] so it
    // still wins over the legend when both are open.
    <div className="absolute bottom-3 start-3 z-[1002] max-w-[calc(100%-1.5rem)]">
      <button
        type="button"
        onClick={() => setIsExpanded((expanded) => !expanded)}
        aria-expanded={isExpanded}
        aria-label={t("legendButtonLabel")}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-hairline bg-background text-sm font-semibold text-primary shadow-lg sm:hidden"
      >
        ؟
      </button>

      <div
        className={`${isExpanded ? "flex" : "hidden"} mt-2 w-56 flex-col gap-3 rounded-lg border border-hairline bg-background p-3 shadow-lg sm:mt-0 sm:flex`}
      >
        <LegendSection title={t("fieldStatus")}>
          {STATUS_ORDER.map((status) => (
            <LegendRow key={status}>
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: STATUS_PIN_COLORS[status] }}
              />
              <span>{statusLabels[status][language]}</span>
            </LegendRow>
          ))}
        </LegendSection>

        <LegendSection title={t("legendTypeHeading")}>
          {LAND_TYPE_ORDER.map((type) => (
            <LegendRow key={type}>
              <TypeGlyph type={type} />
              <span>{landTypeLabels[type][language]}</span>
            </LegendRow>
          ))}
        </LegendSection>
      </div>
    </div>
  );
}

function LegendSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="section-label">{title}</span>
      <div className="flex flex-col gap-1 text-xs text-foreground">
        {children}
      </div>
    </div>
  );
}

function LegendRow({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-2">{children}</div>;
}

// Neutral (status-independent) shape swatches — square for commercial,
// circle for residential — matching the glyph drawn inside each pin.
function TypeGlyph({ type }: { type: LandType }) {
  return (
    <span
      aria-hidden="true"
      className={`h-2.5 w-2.5 shrink-0 bg-foreground ${
        type === "residential" ? "rounded-full" : ""
      }`}
    />
  );
}
