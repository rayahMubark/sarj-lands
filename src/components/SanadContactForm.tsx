"use client";

import { useState, type FormEvent } from "react";
import { formatTemplate } from "@/lib/format";
import { getParcelById } from "@/lib/data";
import { useLanguage, type TranslationKey } from "@/lib/i18n";
import { isValidKsaPhone, normalizeKsaPhone } from "@/lib/phone";
import { saveSanadInquiry } from "@/lib/sanadStore";
import type { SanadFormOffer } from "@/lib/sanad";
import type { SanadInquiryRecord } from "@/lib/types";

// The one place name/phone are ever collected: real controlled form
// fields, validated and submitted deterministically — never parsed out
// of Sanad's free-text replies. `offer` (built server-side in
// src/app/api/sanad/route.ts, reconciled against real parcel data) is
// the *only* source for what this lead is about; the investor only ever
// supplies their own contact details here.
export function SanadContactForm({
  offer,
  onSubmitted,
}: {
  offer: SanadFormOffer;
  onSubmitted: (record: SanadInquiryRecord) => void;
}) {
  const { language, t } = useLanguage();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = name.trim();
    const isNameValid = trimmedName.length > 0;
    const isPhoneValid = isValidKsaPhone(phone);
    setNameError(isNameValid ? null : t("sanadFormNameError"));
    setPhoneError(isPhoneValid ? null : t("sanadFormPhoneError"));
    if (!isNameValid || !isPhoneValid) return;

    setSaveError(null);
    setIsSubmitting(true);
    try {
      const record = saveSanadInquiry(
        buildRecordInput(offer, trimmedName, normalizeKsaPhone(phone), message.trim())
      );
      onSubmitted(record);
    } catch {
      // A failed write must not be reported as success — see
      // saveSanadInquiry's own docstring in src/lib/sanadStore.ts.
      setSaveError(t("sanadFormSaveError"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-2xl border border-hairline bg-background p-3.5"
    >
      <p className="text-xs text-muted">{buildSummary(offer, language, t)}</p>

      <FormField
        label={t("sanadFormNameLabel")}
        error={nameError}
        input={
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("sanadFormNamePlaceholder")}
            disabled={isSubmitting}
            className="w-full rounded-lg border border-hairline bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary disabled:opacity-60"
          />
        }
      />

      <FormField
        label={t("sanadFormPhoneLabel")}
        error={phoneError}
        input={
          <input
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder={t("sanadFormPhonePlaceholder")}
            disabled={isSubmitting}
            dir="ltr"
            className="w-full rounded-lg border border-hairline bg-background px-3 py-2 text-start text-sm text-foreground outline-none focus:border-primary disabled:opacity-60"
          />
        }
      />

      <FormField
        label={t("sanadFormMessageLabel")}
        error={null}
        input={
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={t("sanadFormMessagePlaceholder")}
            disabled={isSubmitting}
            rows={2}
            className="w-full resize-none rounded-lg border border-hairline bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary disabled:opacity-60"
          />
        }
      />

      {saveError && <p className="text-xs text-red-600">{saveError}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-primary/90 disabled:opacity-60"
      >
        {isSubmitting ? t("sanadFormSubmitting") : t("sanadFormSubmit")}
      </button>
    </form>
  );
}

// Everything about this lead beyond name/phone/message comes from
// `offer` (or, for a real parcel, from looking it up directly) — never
// from re-parsing anything the investor typed into this form.
function buildRecordInput(
  offer: SanadFormOffer,
  investorName: string,
  phone: string,
  message: string
): Omit<SanadInquiryRecord, "inquiry_id" | "internal_id"> {
  return {
    date: new Date().toISOString().slice(0, 10),
    investor_name: investorName,
    phone,
    wants_to: message,
    record_type: offer.recordType,
    parcel_id: offer.parcelId,
    requested_parcel_id: offer.requestedParcelId,
    land_type_wanted: offer.landTypeWanted,
    area_of_city_wanted: offer.areaOfCityWanted,
    prefers: offer.prefers,
    budget_sar: offer.budgetSar,
    budget_basis:
      offer.prefers === "sale"
        ? "total purchase"
        : offer.prefers === "lease"
          ? "annual rent"
          : null,
    intent: "ready to move",
    channel: "sanad",
    status: "new",
  };
}

function buildSummary(
  offer: SanadFormOffer,
  language: "ar" | "en",
  t: (key: TranslationKey) => string
): string {
  const parcel = offer.parcelId ? getParcelById(offer.parcelId) : undefined;
  if (parcel) {
    const district = language === "ar" ? parcel.district_ar : parcel.district_en;
    return formatTemplate(t("sanadFormSummaryInterest"), {
      district,
      parcelId: parcel.parcel_id,
    });
  }
  return t("sanadFormSummaryUnmet");
}

function FormField({
  label,
  error,
  input,
}: {
  label: string;
  error: string | null;
  input: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted">
      {label}
      {input}
      {error && <span className="text-[11px] font-normal text-red-600">{error}</span>}
    </label>
  );
}
