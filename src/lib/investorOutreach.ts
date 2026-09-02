// Outreach links for the admin dashboard's demand-gap investor lists:
// a wa.me link that opens a chat with ONE INVESTOR, pre-filled with a
// message about the land they asked for.
//
// Deliberately separate from src/lib/sanadWhatsapp.ts, which points the
// other way: that one hands an investor a link to message Sarj, so it
// targets Sarj's own number. This one is Sarj staff reaching out, so the
// target is the investor's own phone from their inquiry record. Same
// wa.me mechanism, opposite direction, different message — hence its own
// module rather than a flag on the existing builder.
import { normalizeKsaPhone } from "./phone";
import type { Inquiry } from "./types";

// wa.me needs a bare international number: country code + national
// number, no "+", no spaces, no leading 0. The 48 inquiries store local
// Saudi mobiles ("0540602702"), so the leading 0 becomes 966.
// normalizeKsaPhone first strips the spaces/dashes its own validator
// tolerates, so a stored number that was typed loosely still converts.
const KSA_COUNTRY_CODE = "966";

export function buildInvestorWhatsAppUrl(inquiry: Inquiry): string {
  const phone = toInternationalKsaNumber(inquiry.phone);
  const message = buildOutreachMessage(inquiry);

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function toInternationalKsaNumber(rawPhone: string): string {
  const normalized = normalizeKsaPhone(rawPhone);

  if (normalized.startsWith("+")) return normalized.slice(1);
  if (normalized.startsWith(KSA_COUNTRY_CODE)) return normalized;
  if (normalized.startsWith("0")) return KSA_COUNTRY_CODE + normalized.slice(1);
  return KSA_COUNTRY_CODE + normalized;
}

// Bilingual, matching the convention Sanad's own handoff message uses:
// Arabic first, English below, so whoever receives it can read either.
// Every fact in it comes from the inquiry record — the investor's name
// and what they said they wanted. Nothing about availability, price, or a
// specific parcel is promised here: this is an opener for a human
// conversation, and the whole reason the gap exists is that Sarj has
// nothing matching to offer yet.
function buildOutreachMessage(inquiry: Inquiry): string {
  return [
    `مرحبًا ${inquiry.investor_name}، معك فريق سرج العقارية بخصوص طلبك (${inquiry.inquiry_id}) على ${describeRequest(inquiry, "ar")}. نود متابعة طلبك ومناقشة الخيارات المتاحة.`,
    `Hello ${inquiry.investor_name}, this is the Sarj Real Estate team regarding your request (${inquiry.inquiry_id}) for ${describeRequest(inquiry, "en")}. We'd like to follow up and discuss the options available to you.`,
  ].join("\n\n");
}

// What they asked for, in their own terms: the land type and area they
// wanted, plus their stated purpose (wants_to, e.g. "open a warehouse")
// when the record carries one. Kept deliberately plain — this string is
// read by a person in a WhatsApp thread, not parsed.
function describeRequest(inquiry: Inquiry, language: "ar" | "en"): string {
  const landType =
    language === "ar"
      ? inquiry.land_type_wanted === "commercial"
        ? "أرض تجارية"
        : "أرض سكنية"
      : `${inquiry.land_type_wanted} land`;

  // wants_to is free text stored in English in the source data ("open a
  // warehouse"), so it's quoted verbatim in both languages rather than
  // machine-translated into something the investor never said.
  const purpose = inquiry.wants_to ? ` (${inquiry.wants_to})` : "";

  return `${landType}${purpose}`;
}
