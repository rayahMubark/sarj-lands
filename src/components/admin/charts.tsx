import { formatNumber } from "@/lib/format";

// Two small, dependency-free chart primitives shared by the admin
// dashboard's sections — plain SVG/CSS, no charting library. The
// dashboard's numbers already come from real computed data (analytics.ts
// / sanadStore.ts); these components only ever render values handed to
// them, never derive their own.

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface DonutArc {
  segment: DonutSegment;
  dashArray: string;
  dashOffset: number;
}

// A stroke-based SVG donut: one <circle> per segment, each a dash of the
// ring proportional to its share of the total. Standard technique, no
// dependency — see the stroke-dasharray/-dashoffset math below. A plain
// helper (not a component) on purpose: it tracks a running "how much
// ring is drawn so far" offset across segments, which is naturally a
// small loop with a mutable accumulator — fine in an ordinary function,
// but exactly the kind of render-body mutation the react-compiler lint
// (rightly) flags inside a component.
function computeDonutArcs(segments: DonutSegment[], circumference: number): DonutArc[] {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const arcs: DonutArc[] = [];
  let drawnSoFar = 0;

  for (const segment of segments) {
    const share = total > 0 ? segment.value / total : 0;
    const dash = share * circumference;
    arcs.push({
      segment,
      dashArray: `${dash} ${circumference - dash}`,
      dashOffset: -drawnSoFar,
    });
    drawnSoFar += dash;
  }

  return arcs;
}

export function DonutChart({
  segments,
  centerValue,
  centerLabel,
}: {
  segments: DonutSegment[];
  centerValue: string;
  centerLabel: string;
}) {
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const arcs = computeDonutArcs(segments, circumference);

  return (
    <div className="relative inline-flex shrink-0 items-center justify-center">
      <svg width="160" height="160" viewBox="0 0 160 160" className="-rotate-90">
        <circle cx="80" cy="80" r={radius} fill="none" stroke="var(--color-hairline)" strokeWidth="20" />
        {arcs.map(({ segment, dashArray, dashOffset }) => (
          <circle
            key={segment.label}
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke={segment.color}
            strokeWidth="20"
            strokeDasharray={dashArray}
            strokeDashoffset={dashOffset}
            strokeLinecap={segments.length > 1 ? "butt" : "round"}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-heading text-2xl font-bold text-primary">{centerValue}</span>
        <span className="text-[10px] text-muted">{centerLabel}</span>
      </div>
    </div>
  );
}

export function DonutLegend({ segments }: { segments: DonutSegment[] }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  return (
    <ul className="flex flex-col gap-2.5">
      {segments.map((segment) => (
        <li key={segment.label} className="flex items-center gap-2.5 text-sm">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: segment.color }}
          />
          <span className="text-foreground">{segment.label}</span>
          <span className="ms-auto font-semibold text-primary">
            {formatNumber(segment.value)}
          </span>
          <span className="w-10 text-end text-xs text-muted">
            {total > 0 ? Math.round((segment.value / total) * 100) : 0}%
          </span>
        </li>
      ))}
    </ul>
  );
}

export interface BarDatum {
  label: string;
  value: number;
  color?: string;
}

// A simple labeled horizontal bar list, each bar's width proportional to
// the largest value in the set — used for the pipeline's status/intent
// breakdowns.
export function HorizontalBarList({ data }: { data: BarDatum[] }) {
  const max = Math.max(...data.map((datum) => datum.value), 1);

  return (
    <div className="flex flex-col gap-2.5">
      {data.map((datum) => (
        <div key={datum.label} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-xs text-muted">{datum.label}</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-hairline">
            <div
              className="h-full rounded-full"
              style={{
                width: `${(datum.value / max) * 100}%`,
                backgroundColor: datum.color ?? "var(--color-accent)",
              }}
            />
          </div>
          <span className="w-8 shrink-0 text-end text-xs font-semibold text-primary">
            {formatNumber(datum.value)}
          </span>
        </div>
      ))}
    </div>
  );
}
