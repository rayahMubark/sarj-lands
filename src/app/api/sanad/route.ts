import { NextResponse } from "next/server";
import {
  OFFER_REGISTRATION_FORM_TOOL,
  SANAD_TOOLS,
  buildSystemInstruction,
  reconcileFormOffer,
} from "@/lib/sanadPrompt";
import { buildAdminSystemInstruction } from "@/lib/sanadAdminPrompt";
import type { SanadFormOffer, SanadLaunchState } from "@/lib/sanad";
import type { SanadInquiryRecord } from "@/lib/types";

// Single place to bump the model — swap this one constant when a newer
// Gemini Flash ships. gemini-3-flash-preview's free tier is 20
// requests/day (exhausted during development); gemini-3.5-flash-lite
// gets 500/day and, being a lite model with no extended-thinking
// overhead (verified directly — no thoughtsTokenCount in its
// usageMetadata, unlike the preview model), is if anything a better fit
// for a short, grounded chat reply anyway.
const GEMINI_MODEL = "gemini-3.5-flash-lite";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// ABUSE GUARDS. This route is public, unauthenticated, and backed by a
// free-tier API key, so a single script could otherwise drain the daily
// quota and take Sanad down for everyone. None of this changes what
// Sanad says — it only bounds how often, and how much, it can be asked.
//
// The window is per-IP and fixed (not sliding): simple, allocation-free,
// and precise enough for what it defends against. 15/minute is far above
// real conversational use — a person typing sends maybe 2-4 — while
// still capping an automated caller.
const RATE_LIMIT_MAX_REQUESTS = 15;
const RATE_LIMIT_WINDOW_MS = 60_000;

// One chat message's ceiling. ~2,000 characters is several paragraphs —
// no genuine question comes close — but it stops a single request from
// carrying a huge payload straight into the token bill.
const MAX_MESSAGE_LENGTH = 2000;

// How many turns of history actually reach Gemini. Everything older is
// dropped from the REQUEST only (the panel still shows the full thread),
// bounding the token cost of a long conversation: the system instruction
// already carries the whole portfolio, so an unbounded transcript on top
// of it is what would actually blow the context. 24 messages is ~12
// exchanges, well past where a land enquiry is decided.
const MAX_HISTORY_MESSAGES = 24;

// A hard ceiling on the raw array before any of the above runs, so a
// malicious body can't force us to walk a million-element list.
const MAX_ACCEPTED_MESSAGES = 200;

// Bilingual on purpose: this string can surface anywhere (the panel, a
// direct curl, a future client), and the caller's language isn't known
// here. The panel prefers its own localized copy — see requestSanadReply
// in src/components/SanadPanel.tsx.
const RATE_LIMITED_MESSAGE =
  "طلبات كثيرة في وقت قصير. يرجى المحاولة بعد قليل. / Too many requests. Please try again shortly.";

// requestCounts is module-level, so it lives as long as the serverless
// instance that owns it and is NOT shared across instances — a deploy or
// a scale-out resets it. That's an accepted limit, not an oversight: it
// still throttles the realistic case (one abusive caller hitting one warm
// instance) with no external dependency. A production deployment would
// move this to a shared store (Redis / Vercel KV) or to the platform's
// own edge rate limiting.
const requestCounts = new Map<string, { count: number; windowStartMs: number }>();

// Records one request against `clientId` and reports whether it should be
// rejected. Also sweeps windows that have fully expired, so the map can't
// grow without bound across a long-lived instance.
function isRateLimited(clientId: string): boolean {
  const now = Date.now();

  for (const [id, entry] of requestCounts) {
    if (now - entry.windowStartMs >= RATE_LIMIT_WINDOW_MS) requestCounts.delete(id);
  }

  const existing = requestCounts.get(clientId);
  if (!existing) {
    requestCounts.set(clientId, { count: 1, windowStartMs: now });
    return false;
  }

  existing.count++;
  return existing.count > RATE_LIMIT_MAX_REQUESTS;
}

// Best-effort caller identity. x-forwarded-for is set by Vercel and most
// proxies and may be a comma-separated chain — the first entry is the
// original client. Everything falls back to one shared "unknown" bucket,
// which is the safe direction: an unidentifiable caller gets throttled
// together with other unidentifiable callers rather than escaping the
// limit entirely.
function getClientId(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

interface ClientChatMessage {
  role: "user" | "assistant";
  text: string;
}

interface SanadRequestBody {
  messages?: ClientChatMessage[];
  launchState?: SanadLaunchState | null;
  // Only meaningful (and only ever sent) when launchState.mode==="admin" —
  // this route has no server-side database, so the live leads Sanad has
  // captured live only exist in the browser's localStorage; the client
  // reads them itself (see requestSanadReply in SanadPanel.tsx) and hands
  // them over here to fold into the admin context.
  liveSanadRecords?: SanadInquiryRecord[];
}

// What this route hands back: a text reply (null when Gemini's turn was
// only a tool call with no accompanying text), and a formOffer when
// Gemini decided it's time to show the contact form.
interface SanadApiResult {
  reply: string | null;
  formOffer: SanadFormOffer | null;
}

// The only thing the browser ever talks to for Sanad: it sends the
// running conversation, this route grounds it in Sanad's persona + the
// real portfolio (see src/lib/sanadPrompt.ts) and calls Gemini server-
// side, so GEMINI_API_KEY never reaches client code.
export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Deliberately no interpolation of anything secret into log lines —
    // this fires only when the env var itself is missing.
    console.error("Sanad: GEMINI_API_KEY is not configured.");
    return NextResponse.json(
      { error: "Sanad is not configured on this server." },
      { status: 500 }
    );
  }

  // Checked before the body is even parsed, so a flood costs us as little
  // work as possible. 429 + Retry-After is the conventional shape; the
  // panel turns this into its own localized notice rather than showing
  // the bilingual fallback text.
  if (isRateLimited(getClientId(request))) {
    return NextResponse.json(
      { error: RATE_LIMITED_MESSAGE, rateLimited: true },
      {
        status: 429,
        headers: { "Retry-After": String(RATE_LIMIT_WINDOW_MS / 1000) },
      }
    );
  }

  let body: SanadRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json(
      { error: "No messages provided." },
      { status: 400 }
    );
  }

  if (body.messages.length > MAX_ACCEPTED_MESSAGES) {
    return NextResponse.json(
      { error: "Conversation is too long." },
      { status: 400 }
    );
  }

  // Rejected rather than silently truncated: quietly sending a different
  // question than the one that was asked, and answering it as if it were
  // theirs, is worse than saying the message is too long.
  if (
    body.messages.some(
      (message) =>
        typeof message?.text === "string" && message.text.length > MAX_MESSAGE_LENGTH
    )
  ) {
    return NextResponse.json(
      { error: "Message is too long.", tooLong: true },
      { status: 400 }
    );
  }

  try {
    const result = await callGemini(
      apiKey,
      // Only the most recent turns reach Gemini — see MAX_HISTORY_MESSAGES.
      // Taking from the END keeps the live part of the conversation and
      // drops the oldest, which is also where the parcel context note is
      // least needed (buildSystemInstruction re-grounds it every request).
      body.messages.slice(-MAX_HISTORY_MESSAGES),
      body.launchState ?? null,
      body.liveSanadRecords ?? []
    );
    return NextResponse.json(result);
  } catch (error) {
    // `error` is our own "Gemini responded with N" / network failure —
    // never the API key, which is only ever read into the fetch header
    // below and never interpolated into a string.
    console.error("Sanad: Gemini request failed.", error);
    return NextResponse.json(
      { error: "Sanad couldn't respond just now. Please try again." },
      { status: 502 }
    );
  }
}

async function callGemini(
  apiKey: string,
  messages: ClientChatMessage[],
  launchState: SanadLaunchState | null,
  liveSanadRecords: SanadInquiryRecord[]
): Promise<SanadApiResult> {
  // Admin mode gets a whole different system instruction (persona +
  // leadership-facing data, see sanadAdminPrompt.ts) and no tools: it
  // never registers a lead, it only analyzes and drafts text — so there's
  // nothing here for offer_registration_form to do. Investor mode is
  // untouched, byte-for-byte the same call it always was.
  const isAdminMode = launchState?.mode === "admin";
  const personaInstruction = isAdminMode
    ? buildAdminSystemInstruction(liveSanadRecords)
    : buildSystemInstruction(launchState);
  const systemInstruction = personaInstruction + buildLanguageLockDirective(messages);

  const response = await fetch(GEMINI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: messages.map(toGeminiContent),
      tools: isAdminMode ? undefined : SANAD_TOOLS,
      generationConfig: {
        temperature: 0.6,
        // No thinkingConfig: gemini-3.5-flash-lite doesn't spend part of
        // this budget on invisible "thinking" tokens the way
        // gemini-3-flash-preview did (verified directly — no
        // thoughtsTokenCount in its usageMetadata either way), so there's
        // no shared-budget risk of a reply getting truncated mid-sentence
        // and no reasoning-room tradeoff to size around. 700 is plenty
        // for the persona's "keep answers short" rule.
        maxOutputTokens: 700,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini responded with ${response.status}`);
  }

  const data = await response.json();
  const parts: unknown[] = data?.candidates?.[0]?.content?.parts ?? [];

  const textParts = parts
    .map((part) => (isRecord(part) && typeof part.text === "string" ? part.text : null))
    .filter((text): text is string => text !== null);

  // At most one form offer per turn — a conversation only needs to
  // trigger the form once at a time.
  const functionCallPart = parts.find(
    (part): part is { functionCall: { name: string; args: Record<string, unknown> } } =>
      isRecord(part) &&
      isRecord(part.functionCall) &&
      part.functionCall.name === OFFER_REGISTRATION_FORM_TOOL
  );

  const reply = textParts.length > 0 ? textParts.join("\n\n") : null;
  const formOffer = functionCallPart
    ? reconcileFormOffer(functionCallPart.functionCall.args ?? {})
    : null;

  if (reply === null && formOffer === null) {
    throw new Error("Gemini returned neither reply text nor a tool call.");
  }

  return { reply, formOffer };
}

// A deterministic backstop for the "reply entirely in the user's own
// language" rule both personas already state in words. Verified directly
// that wording alone isn't enough for gemini-3.5-flash-lite in admin
// mode: even with an explicit "detect and mirror the latest message's
// language" instruction, a fresh, English-only admin conversation still
// came back in Arabic — plausibly pulled off course by how much Arabic
// sits elsewhere in the admin context (portfolio district names, Arabic
// UI copy in the persona's own examples). Rather than keep tuning
// wording and hoping, this detects the latest user message's language in
// code (a simple, reliable check — the UI only ever sends Arabic or
// English) and appends an unambiguous, un-ignorable command naming it,
// so language selection stops being something the model has to infer at
// all. Applies to both modes: investor mode already tested correct on
// its own, but this costs nothing extra and removes any doubt.
function buildLanguageLockDirective(messages: ClientChatMessage[]): string {
  const latestUserMessage = [...messages].reverse().find((message) => message.role === "user");
  if (!latestUserMessage) return "";

  const isArabic = /[؀-ۿ]/.test(latestUserMessage.text);
  const languageName = isArabic ? "Modern Standard Arabic (الفصحى)" : "English";

  return `\n\nLANGUAGE LOCK (non-negotiable, overrides anything else in this prompt): the latest message you're replying to is in ${isArabic ? "Arabic" : "English"}. Your entire reply — every sentence, with absolutely no exceptions — must be written in ${languageName} only, regardless of what language the data, examples, or your own persona text elsewhere happen to be in.`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toGeminiContent(message: ClientChatMessage) {
  return {
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.text }],
  };
}
