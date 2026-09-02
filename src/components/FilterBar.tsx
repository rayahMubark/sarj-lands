import type { ChangeEvent } from "react";
import { formatNumber, formatTemplate } from "@/lib/format";
import type { NumericBounds, FilterState } from "@/lib/filters";
import { DEFAULT_FILTERS } from "@/lib/filters";
import {
  areaOfCityLabels,
  landTypeLabels,
  listingTypeLabels,
  statusLabels,
  useLanguage,
  type TranslationKey,
} from "@/lib/i18n";
import type {
  AreaOfCity,
  LandType,
  ListingType,
  ParcelStatus,
} from "@/lib/types";
import { ViewToggle, type ViewMode } from "@/components/ViewToggle";

const AREA_OPTIONS: AreaOfCity[] = ["Central", "East", "North", "South", "West"];
const LAND_TYPE_OPTIONS: LandType[] = ["commercial", "residential"];
const LISTING_TYPE_OPTIONS: ListingType[] = ["sale", "lease"];
const STATUS_OPTIONS: ParcelStatus[] = [
  "available",
  "reserved",
  "sold",
  "leased",
];

export interface PriceBoundsByListing {
  sale: NumericBounds | null;
  lease: NumericBounds | null;
}

// Sticky filter bar: area, land type, listing type, status, a budget
// slider (or two, split by listing type), size range, a reset action, and
// a live result count.
export function FilterBar({
  filters,
  onChange,
  priceBounds,
  areaBounds,
  resultCount,
  viewMode,
  onViewModeChange,
}: {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  priceBounds: PriceBoundsByListing;
  areaBounds: NumericBounds;
  resultCount: number;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}) {
  const { language, t } = useLanguage();

  function set<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    onChange({ ...filters, [key]: value });
  }

  const showSaleBudget =
    filters.listingType !== "lease" && priceBounds.sale !== null;
  const showLeaseBudget =
    filters.listingType !== "sale" && priceBounds.lease !== null;

  return (
    <div className="sticky top-0 z-20 border-y border-hairline bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-4">
        <span className="section-label">{t("filtersLabel")}</span>

        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          <SelectField
            label={t("fieldAreaOfCity")}
            value={filters.areaOfCity}
            onChange={(value) => set("areaOfCity", value as AreaOfCity | "all")}
            allLabel={t("allOption")}
            options={AREA_OPTIONS.map((area) => ({
              value: area,
              label: areaOfCityLabels[area][language],
            }))}
          />
          <SelectField
            label={t("fieldLandType")}
            value={filters.landType}
            onChange={(value) => set("landType", value as LandType | "all")}
            allLabel={t("allOption")}
            options={LAND_TYPE_OPTIONS.map((type) => ({
              value: type,
              label: landTypeLabels[type][language],
            }))}
          />
          <SelectField
            label={t("fieldListingType")}
            value={filters.listingType}
            onChange={(value) =>
              set("listingType", value as ListingType | "all")
            }
            allLabel={t("allOption")}
            options={LISTING_TYPE_OPTIONS.map((type) => ({
              value: type,
              label: listingTypeLabels[type][language],
            }))}
          />
          <SelectField
            label={t("fieldStatus")}
            value={filters.status}
            onChange={(value) => set("status", value as ParcelStatus | "all")}
            allLabel={t("allOption")}
            options={STATUS_OPTIONS.map((status) => ({
              value: status,
              label: statusLabels[status][language],
            }))}
          />

          {showSaleBudget && (
            <BudgetSlider
              label={t("fieldSaleBudget")}
              bounds={priceBounds.sale as NumericBounds}
              value={filters.saleMaxPrice}
              onChange={(value) => set("saleMaxPrice", value)}
              t={t}
            />
          )}
          {showLeaseBudget && (
            <BudgetSlider
              label={t("fieldLeaseBudget")}
              bounds={priceBounds.lease as NumericBounds}
              value={filters.leaseMaxPrice}
              onChange={(value) => set("leaseMaxPrice", value)}
              t={t}
            />
          )}

          <NumberField
            label={t("fieldMinArea")}
            placeholder={formatNumber(areaBounds.min)}
            value={filters.minAreaSqm}
            onChange={(value) => set("minAreaSqm", value)}
          />
          <NumberField
            label={t("fieldMaxArea")}
            placeholder={formatNumber(areaBounds.max)}
            value={filters.maxAreaSqm}
            onChange={(value) => set("maxAreaSqm", value)}
          />
        </div>

        <div className="flex items-center justify-between gap-4 text-xs">
          <button
            type="button"
            onClick={() => onChange(DEFAULT_FILTERS)}
            className="font-medium text-primary underline decoration-hairline underline-offset-4 hover:decoration-primary"
          >
            {t("resetFilters")}
          </button>
          <span className="flex items-center gap-3 text-muted">
            {formatTemplate(t("resultCount"), {
              count: formatNumber(resultCount),
            })}
            <ViewToggle mode={viewMode} onChange={onViewModeChange} />
          </span>
        </div>
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  allLabel,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  allLabel: string;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-medium text-muted">{label}</span>
      <select
        value={value}
        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
          onChange(event.target.value)
        }
        className="rounded-md border border-hairline bg-background px-2.5 py-1.5 text-sm text-foreground"
      >
        <option value="all">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

// A single "max price" slider. The slider's own maximum position always
// means "no cap" (value=null) rather than a numeric ceiling exactly equal
// to the priciest parcel — keeps the semantics stable and avoids excluding
// the top listing due to a rounding edge case.
function BudgetSlider({
  label,
  bounds,
  value,
  onChange,
  t,
}: {
  label: string;
  bounds: NumericBounds;
  value: number | null;
  onChange: (value: number | null) => void;
  t: (key: TranslationKey) => string;
}) {
  const step = Math.max(1, Math.round((bounds.max - bounds.min) / 100));
  const sliderValue = value ?? bounds.max;

  return (
    <label className="flex w-48 flex-col gap-1 text-xs">
      <span className="font-medium text-muted">{label}</span>
      <input
        type="range"
        min={bounds.min}
        max={bounds.max}
        step={step}
        value={sliderValue}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          const next = Number(event.target.value);
          onChange(next >= bounds.max ? null : next);
        }}
        className="accent-primary"
      />
      <span className="text-[11px] text-foreground">
        {value === null ? t("noMax") : `${formatNumber(value)} ${t("sar")}`}
      </span>
      <span className="text-[10px] text-muted">
        {formatTemplate(t("rangeHint"), {
          min: formatNumber(bounds.min),
          max: formatNumber(bounds.max),
        })}
      </span>
    </label>
  );
}

function NumberField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <label className="flex w-28 flex-col gap-1 text-xs">
      <span className="font-medium text-muted">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        placeholder={placeholder}
        value={value ?? ""}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          const raw = event.target.value;
          onChange(raw === "" ? null : Number(raw));
        }}
        className="rounded-md border border-hairline bg-background px-2.5 py-1.5 text-sm text-foreground"
      />
    </label>
  );
}
