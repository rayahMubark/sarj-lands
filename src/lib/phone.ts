// Basic Saudi mobile validation: local "05XXXXXXXX" (10 digits) or
// international "+9665XXXXXXXX" / "9665XXXXXXXX", spaces/dashes allowed
// while typing. Not a full libphonenumber-grade check — just enough to
// catch obviously-wrong input before it's persisted as a lead's contact
// number.
const KSA_MOBILE_PATTERN = /^(?:\+?966|0)5\d{8}$/;

export function isValidKsaPhone(rawValue: string): boolean {
  return KSA_MOBILE_PATTERN.test(normalizeKsaPhone(rawValue));
}

export function normalizeKsaPhone(rawValue: string): string {
  return rawValue.replace(/[\s-]/g, "");
}
