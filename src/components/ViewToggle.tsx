import { useLanguage, type TranslationKey } from "@/lib/i18n";

export type ViewMode = "list" | "map";

// "List / Map" segmented toggle, styled like LanguageToggle so the two
// pill toggles in this UI feel like one family.
export function ViewToggle({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-hairline p-1">
      <ViewOption
        mode="list"
        labelKey="viewList"
        active={mode === "list"}
        onSelect={onChange}
      />
      <ViewOption
        mode="map"
        labelKey="viewMap"
        active={mode === "map"}
        onSelect={onChange}
      />
    </div>
  );
}

function ViewOption({
  mode,
  labelKey,
  active,
  onSelect,
}: {
  mode: ViewMode;
  labelKey: TranslationKey;
  active: boolean;
  onSelect: (mode: ViewMode) => void;
}) {
  const { t } = useLanguage();

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => onSelect(mode)}
      className={`rounded-full px-3 py-1 text-xs font-semibold tracking-wide transition-colors ${
        active ? "bg-primary text-background" : "text-muted hover:text-primary"
      }`}
    >
      {t(labelKey)}
    </button>
  );
}
