// A minimal RFC 9562 UUIDv7 generator: unix_ts_ms (48 bits) + random bits,
// so ids this app mints (e.g. chat message ids) sort chronologically by
// construction. Uses the Web Crypto API, available in both the browser
// and modern Node — no dependency needed for something this small.
//
// Plain Number bit-math (not BigInt): a 48-bit millisecond timestamp is
// well within Number.MAX_SAFE_INTEGER (53 bits), and this project's
// TypeScript target (ES2017) predates BigInt literal syntax.
export function generateUuidV7(): string {
  const timestampMs = Date.now();
  const randomBytes = crypto.getRandomValues(new Uint8Array(10));

  const bytes = new Uint8Array(16);
  bytes[0] = Math.floor(timestampMs / 2 ** 40) & 0xff;
  bytes[1] = Math.floor(timestampMs / 2 ** 32) & 0xff;
  bytes[2] = Math.floor(timestampMs / 2 ** 24) & 0xff;
  bytes[3] = Math.floor(timestampMs / 2 ** 16) & 0xff;
  bytes[4] = Math.floor(timestampMs / 2 ** 8) & 0xff;
  bytes[5] = timestampMs & 0xff;
  bytes.set(randomBytes, 6);

  bytes[6] = (bytes[6] & 0x0f) | 0x70; // version 7
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
