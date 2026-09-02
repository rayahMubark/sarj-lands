import type { SanadInquiryRecord } from "./types";

// PLACEHOLDER — replace with Sarj's real WhatsApp Business number before
// launch. Kept as a single named constant, same reasoning as
// GEMINI_MODEL in src/app/api/sanad/route.ts.
const SARJ_WHATSAPP_NUMBER = "966500000000";

// The optional handoff offered after a successful registration: a wa.me
// link pre-filled with a bilingual message naming the investor, the
// inquiry_id, and whichever of the real parcel or the raw requested
// details this lead is about.
export function buildWhatsAppUrl(record: SanadInquiryRecord): string {
  const message = buildBilingualMessage(record);
  return `https://wa.me/${SARJ_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

function buildBilingualMessage(record: SanadInquiryRecord): string {
  return [
    `مرحبًا فريق سرج، أنا ${record.investor_name}. رقم طلبي ${record.inquiry_id} بخصوص ${describeSubject(record, "ar")}.`,
    `Hello Sarj team, I'm ${record.investor_name}. My request number is ${record.inquiry_id} regarding ${describeSubject(record, "en")}.`,
  ].join("\n\n");
}

function describeSubject(
  record: SanadInquiryRecord,
  language: "ar" | "en"
): string {
  if (record.parcel_id) {
    return language === "ar" ? `الأرض ${record.parcel_id}` : `parcel ${record.parcel_id}`;
  }
  if (record.requested_parcel_id) {
    return language === "ar"
      ? `الأرض ${record.requested_parcel_id} (غير متوفرة حاليًا)`
      : `parcel ${record.requested_parcel_id} (currently unavailable)`;
  }
  return language === "ar" ? "طلب أرض جديد" : "a new land request";
}
