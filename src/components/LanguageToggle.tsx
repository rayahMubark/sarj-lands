"use client";

import type { Language } from "@/lib/i18n";
import { useLanguage } from "@/lib/i18n";

// AR / EN pill toggle. Flips language + document direction instantly —
// no navigation, no page reload.
export function LanguageToggle() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className="flex items-center gap-1 rounded-full border border-hairline p-1">
      <ToggleOption
        code="ar"
        label="عربي"
        active={language === "ar"}
        srLabel={t("switchToArabic")}
        onSelect={setLanguage}
      />
      <ToggleOption
        code="en"
        label="EN"
        active={language === "en"}
        srLabel={t("switchToEnglish")}
        onSelect={setLanguage}
      />
    </div>
  );
}

function ToggleOption({
  code,
  label,
  active,
  srLabel,
  onSelect,
}: {
  code: Language;
  label: string;
  active: boolean;
  srLabel: string;
  onSelect: (language: Language) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={srLabel}
      onClick={() => onSelect(code)}
      className={`rounded-full px-3 py-1 text-xs font-semibold tracking-wide transition-colors ${
        active
          ? "bg-primary text-background"
          : "text-muted hover:text-primary"
      }`}
    >
      {label}
    </button>
  );
}
