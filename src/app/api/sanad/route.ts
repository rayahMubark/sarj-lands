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

  try {
    const result = await callGemini(
      apiKey,
      body.messages,
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
