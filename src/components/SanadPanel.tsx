"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { formatTemplate } from "@/lib/format";
import { getParcelById } from "@/lib/data";
import { generateUuidV7 } from "@/lib/id";
import {
  useLanguage,
  type Language,
  type TranslationKey,
} from "@/lib/i18n";
import { useSanad, type SanadFormOffer, type SanadLaunchState, type SanadMode } from "@/lib/sanad";
import { buildWhatsAppUrl } from "@/lib/sanadWhatsapp";
import { getSanadInquiriesForDisplay } from "@/lib/sanadStore";
import type { SanadInquiryRecord } from "@/lib/types";
import { SanadContactForm } from "@/components/SanadContactForm";

// A plain reply, an offered contact form, or (once that form is
// submitted) its confirmation. "form" and "confirmation" are always
// role: "assistant" — the investor never "sends" one as a chat message,
// they fill in real fields (see SanadContactForm).
type SanadChatMessage =
  | { id: string; kind: "text"; role: "user" | "assistant"; text: string; isGreeting?: boolean }
  | { id: string; kind: "form"; role: "assistant"; formOffer: SanadFormOffer }
  | { id: string; kind: "confirmation"; role: "assistant"; record: SanadInquiryRecord };

// Public mount point: rendered once from src/app/layout.tsx, on every
// route. Sanad's entry points are deliberately kept to a small,
// intentional set (the floating launcher below, plus a few high-intent
// contextual CTAs elsewhere — the land detail page's two buttons, the
// about page's own closing CTA, admin's dashboard) rather than repeating
// a "Talk to Sanad" button all over the investor UI, so this is
// genuinely the one place Sanad is always reachable from.
export function SanadPanel() {
  const { isOpen, launchState } = useSanad();

  return (
    <>
      {/* Shown whenever there's no conversation currently open — before
          Sanad has ever been launched, and again after the reader closes
          it (see closeSanad). Never while minimized: that's SanadPanelInner
          -> MinimizedPill's job, for the same isOpen=true conversation. */}
      {!isOpen && <SanadLaunchButton />}

      {/* key: a different parcel (or a switch to/from the general,
          parcel-less entry) remounts SanadPanelInner, resetting its
          conversation and re-seeding a fresh, correctly-grounded greeting.
          Re-clicking the same parcel's CTA, or closing and reopening via
          the floating launcher, keeps the same key and so the same
          conversation — mirroring ParcelSidePanel's own key-driven reset
          (see src/components/ParcelSidePanel.tsx) rather than an effect
          that syncs state to a changing prop.

          Falling back to launchState.mode rather than a flat "general"
          string matters now that admin mode exists: it has no parcelId
          either, so a flat fallback would give general-investor and admin
          conversations the same key — reopening as admin after closing a
          general chat (or vice versa) would reuse the other one's stale
          messages and greeting instead of starting the fresh, correctly-
          persona'd conversation each mode needs.

          Only mounted once Sanad has actually been opened at least once
          — and, per the comment on SanadPanelInner itself, never
          unmounted after that just because isOpen goes false, so a closed
          conversation's history survives being reopened via the floating
          launcher above. */}
      {launchState && (
        <SanadPanelInner key={launchState.parcelId ?? launchState.mode} />
      )}
    </>
  );
}

// The one persistent, always-available way into Sanad — see the comment
// on SanadPanel above for why every other entry point in the investor UI
// was deliberately trimmed down to a few high-intent, contextual ones
// instead of repeating this everywhere. Doubles as admin's own entry
// point (the header used to carry that; now this does, route-detected
// the same way TalkToSanadButton in Header.tsx used to): opening it from
// /admin starts an admin-mode conversation, matching the dashboard's own
// near-black Sanad treatment elsewhere.
function SanadLaunchButton() {
  const { t, language } = useLanguage();
  const { openSanad } = useSanad();
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin") ?? false;

  return (
    <SanadFab
      isAdmin={isAdmin}
      ariaLabel={t("sanadNavLabel")}
      onClick={() => openSanad({ mode: isAdmin ? "admin" : "general" })}
    >
      <SanadMark language={language} alt={t("sanadIdentityName")} className="h-4 w-auto shrink-0" />
      <SparkleIcon className="h-2.5 w-2.5 shrink-0 text-accent/80" />
    </SanadFab>
  );
}

// One Sanad conversation. Stays mounted (state and all) for as long as
// its key above is unchanged, so isOpen toggling on/off via the floating
// launcher, the minimize pill, or any of the contextual CTAs never loses
// what was already said.
function SanadPanelInner() {
  const { language, t } = useLanguage();
  const { isOpen, launchState, closeSanad } = useSanad();
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<SanadChatMessage[]>(() =>
    buildInitialMessages(launchState, language, t)
  );
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isAdmin = launchState?.mode === "admin";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isSending]);

  // The greeting is seeded into `messages` once, at mount (see
  // buildInitialMessages below) — its text alone, unlike every other
  // pre-written string here (header, form labels, placeholders), doesn't
  // re-resolve via t() at render, so it'd otherwise stay frozen in
  // whichever language was active at that moment even after the reader
  // flips the language toggle. Re-derive it for *display* on every render
  // instead of writing the resolved string back into state — the greeting
  // is never sent to Gemini anyway (requestReplyAndAppend filters
  // isGreeting messages out before building the API request), so there's
  // no stored copy that language needs to stay in sync with.
  const displayMessages = useMemo(
    () =>
      messages.map((message) =>
        message.kind === "text" && message.isGreeting
          ? { ...message, text: buildGreetingText(launchState, language, t) }
          : message
      ),
    [messages, launchState, language, t]
  );

  if (!isOpen) return null;

  if (isMinimized) {
    return (
      <MinimizedPill
        isAdmin={isAdmin}
        language={language}
        onExpand={() => setIsMinimized(false)}
        t={t}
      />
    );
  }

  async function requestReplyAndAppend(historyForRequest: SanadChatMessage[]) {
    setErrorText(null);
    setIsSending(true);
    try {
      // Only admin mode's system instruction needs these (see
      // sanadAdminPrompt.ts) — localStorage only exists in the browser,
      // so this is the one place they can be read and handed to the API
      // route, which has no server-side database of its own.
      // Same merged view the dashboard's own inbox renders (demo seeds +
      // this browser's real captures), so admin-Sanad and the Requests
      // tab can never disagree about how many leads exist or who they are.
      const liveSanadRecords =
        launchState?.mode === "admin" ? getSanadInquiriesForDisplay() : undefined;
      const { reply, formOffer } = await requestSanadReply(
        historyForRequest,
        launchState,
        liveSanadRecords
      );
      setMessages((current) => {
        const next = [...current];
        if (reply) {
          next.push({ id: generateUuidV7(), kind: "text", role: "assistant", text: reply });
        }
        if (formOffer) {
          next.push({ id: generateUuidV7(), kind: "form", role: "assistant", formOffer });
        }
        return next;
      });
    } catch (error) {
      // A guard the reader can clear themselves (too fast / too long) gets
      // its own message; everything else keeps the generic retry copy.
      setErrorText(
        error instanceof SanadRequestError
          ? t(error.translationKey)
          : t("sanadErrorRetry")
      );
    } finally {
      setIsSending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed || isSending) return;

    setInputValue("");
    const userMessage: SanadChatMessage = {
      id: generateUuidV7(),
      kind: "text",
      role: "user",
      text: trimmed,
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    void requestReplyAndAppend(nextMessages);
  }

  function handleRetry() {
    // No new user message here — `messages` already ends with the one
    // that failed to get a reply; retry just re-issues the same request.
    void requestReplyAndAppend(messages);
  }

  // Swaps a "form" message for its "confirmation" in place, so a
  // submitted form disappears rather than staying interactive (and
  // re-submittable) once it's actually saved.
  function handleFormSubmitted(formMessageId: string, record: SanadInquiryRecord) {
    setMessages((current) =>
      current.map((message) =>
        message.id === formMessageId
          ? { id: message.id, kind: "confirmation", role: "assistant", record }
          : message
      )
    );
  }

  // A guaranteed, always-available path to the contact form that never
  // depends on Sanad's own judgment about when to offer it — deliberate
  // belt-and-suspenders alongside the offer_registration_form tool.
  // Reliability over free-text extraction applies here too: rather than
  // trusting a keyword scan of what the investor typed, this is a real
  // button with an unambiguous action. A no-op while the most recent
  // message is already an unsubmitted form, so repeated clicks don't
  // stack duplicates.
  function handleManualFormTrigger() {
    const last = messages[messages.length - 1];
    if (last?.kind === "form") return;

    setMessages((current) => [
      ...current,
      { id: generateUuidV7(), kind: "form", role: "assistant", formOffer: buildManualFormOffer(launchState) },
    ]);
  }

  // Sends one of the admin starter-prompt chips exactly as if the leader
  // had typed it — same request path as handleSubmit, just without a
  // Composer round-trip. Chips only ever show before the conversation has
  // really started (see isAdmin && messages.length === 1 below), so
  // isSending can't realistically be true here, but the guard matches
  // handleSubmit's own for consistency.
  function handleStarterPrompt(promptText: string) {
    if (isSending) return;

    const userMessage: SanadChatMessage = {
      id: generateUuidV7(),
      kind: "text",
      role: "user",
      text: promptText,
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    void requestReplyAndAppend(nextMessages);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[2000] flex h-[85vh] flex-col overflow-hidden rounded-t-2xl border-t border-hairline bg-background shadow-2xl animate-[panel-slide-up_300ms_ease-out] sm:inset-x-auto sm:bottom-6 sm:end-6 sm:h-[560px] sm:w-96 sm:rounded-2xl sm:border">
      <PanelHeader
        mode={launchState?.mode ?? null}
        language={language}
        onMinimize={() => setIsMinimized(true)}
        onClose={closeSanad}
        t={t}
      />
      <MessageList
        messages={displayMessages}
        isSending={isSending}
        bottomRef={bottomRef}
        onFormSubmitted={handleFormSubmitted}
        t={t}
      />
      {isAdmin && messages.length === 1 && (
        <StarterPromptChips onSelect={handleStarterPrompt} t={t} />
      )}
      {errorText && (
        <ErrorBanner text={errorText} retryLabel={t("sanadRetryButton")} onRetry={handleRetry} />
      )}
      {!isAdmin && (
        <ManualFormTrigger launchState={launchState} onClick={handleManualFormTrigger} t={t} />
      )}
      <Composer
        value={inputValue}
        onChange={setInputValue}
        onSubmit={handleSubmit}
        isSending={isSending}
        placeholder={t(isAdmin ? "sanadInputPlaceholderAdmin" : "sanadInputPlaceholder")}
        sendLabel={t("sanadSend")}
      />
    </div>
  );
}

// The four fixed starter prompts from the admin persona brief, shown as
// clickable chips only until the leader's first real message — after
// that the conversation has its own direction and the chips would just
// be clutter. Each chip's own text (already bilingual via t()) is sent
// verbatim as the user's message, so Sanad's own language detection
// handles picking the right reply language, same as any typed message.
const ADMIN_STARTER_PROMPT_KEYS: TranslationKey[] = [
  "adminPromptPortfolioHealth",
  "adminPromptBiggestGap",
  "adminPromptReprice",
  "adminPromptUnmetDemand",
];

function StarterPromptChips({
  onSelect,
  t,
}: {
  onSelect: (promptText: string) => void;
  t: (key: TranslationKey) => string;
}) {
  return (
    <div className="flex flex-wrap gap-2 border-t border-hairline p-3">
      {ADMIN_STARTER_PROMPT_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onSelect(t(key))}
          className="rounded-full border border-hairline px-3 py-1.5 text-xs text-foreground transition-colors hover:border-primary hover:text-primary"
        >
          {t(key)}
        </button>
      ))}
    </div>
  );
}

// Same "interest" derivation buildInitialMessages uses for a real
// parcel; falls back to an all-null "unmet_lead" when there's no parcel
// in context — the investor's own message field on the form (see
// SanadContactForm) is where they say what they're actually after.
function buildManualFormOffer(launchState: SanadLaunchState | null): SanadFormOffer {
  const parcel = launchState?.parcelId ? getParcelById(launchState.parcelId) : undefined;
  if (!parcel) {
    return {
      recordType: "unmet_lead",
      parcelId: null,
      requestedParcelId: null,
      landTypeWanted: null,
      areaOfCityWanted: null,
      prefers: null,
      budgetSar: null,
    };
  }

  return {
    recordType: "interest",
    parcelId: parcel.parcel_id,
    requestedParcelId: null,
    landTypeWanted: parcel.land_type,
    areaOfCityWanted: parcel.area_of_city,
    prefers: parcel.listing_type,
    budgetSar: parcel.priceOnRequest ? null : parcel.total_price_sar,
  };
}

function ManualFormTrigger({
  launchState,
  onClick,
  t,
}: {
  launchState: SanadLaunchState | null;
  onClick: () => void;
  t: (key: TranslationKey) => string;
}) {
  const label = launchState?.parcelId
    ? t("sanadManualRegisterInterest")
    : t("sanadManualLogRequest");

  return (
    <button
      type="button"
      onClick={onClick}
      className="mx-3 mt-2 inline-flex w-fit items-center text-xs font-medium text-primary underline decoration-hairline underline-offset-4 hover:decoration-primary"
    >
      {label}
    </button>
  );
}

// The greeting alone, or — when Sanad opened in "request" mode for a
// real parcel — the greeting plus the contact form already attached, no
// round trip to Gemini needed: the "Request this land" CTA is already an
// unambiguous signal, so there's nothing for the model to decide here.
// Every other path (an unmet parcel, or the investor agreeing mid-
// conversation) goes through the offer_registration_form tool instead —
// see reconcileFormOffer in src/lib/sanadPrompt.ts, which this mirrors
// for the one case decided client-side.
function buildInitialMessages(
  launchState: SanadLaunchState | null,
  language: Language,
  t: (key: TranslationKey) => string
): SanadChatMessage[] {
  const greeting = buildGreetingMessage(launchState, language, t);
  const hasRealParcel = Boolean(
    launchState?.parcelId && getParcelById(launchState.parcelId)
  );

  if (launchState?.mode !== "request" || !hasRealParcel) return [greeting];

  const formOffer = buildManualFormOffer(launchState);
  return [greeting, { id: generateUuidV7(), kind: "form", role: "assistant", formOffer }];
}

// Calls our own API route (never Gemini directly — see
// src/app/api/sanad/route.ts) with the conversation so far, minus the
// locally-seeded greeting.
// A failure the reader can act on themselves, carrying the dictionary key
// for what to tell them. Anything else thrown from requestSanadReply is
// an ordinary fault and falls back to the generic retry copy.
class SanadRequestError extends Error {
  readonly translationKey: TranslationKey;

  constructor(translationKey: TranslationKey) {
    super(translationKey);
    this.translationKey = translationKey;
  }
}

async function requestSanadReply(
  history: SanadChatMessage[],
  launchState: SanadLaunchState | null,
  liveSanadRecords?: SanadInquiryRecord[]
): Promise<{ reply: string | null; formOffer: SanadFormOffer | null }> {
  const response = await fetch("/api/sanad", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: history
        .filter((message) => !(message.kind === "text" && message.isGreeting))
        .map(toApiMessage),
      launchState,
      liveSanadRecords,
    }),
  });

  // The API's abuse guards (see src/app/api/sanad/route.ts) get their own
  // reader-facing copy: "you're going too fast, wait a moment" and "that
  // message is too long" are both recoverable by the reader, unlike the
  // generic failure, and telling them so beats a blanket "try again."
  if (response.status === 429) {
    throw new SanadRequestError("sanadErrorRateLimited");
  }
  if (response.status === 400) {
    const details: { tooLong?: boolean } = await response.json().catch(() => ({}));
    if (details.tooLong) throw new SanadRequestError("sanadErrorMessageTooLong");
  }
  if (!response.ok) {
    throw new Error(`Sanad API responded with ${response.status}`);
  }

  const data: { reply?: string | null; formOffer?: SanadFormOffer | null; error?: string } =
    await response.json();
  if (!data.reply && !data.formOffer) {
    throw new Error(data.error ?? "Sanad API returned nothing.");
  }

  return { reply: data.reply ?? null, formOffer: data.formOffer ?? null };
}

// Gemini only ever sees plain user/assistant text (see toGeminiContent in
// the route) — a "form" or "confirmation" message becomes a short
// descriptive stand-in so later turns keep the thread ("didn't I already
// offer/log this?") without the app needing real function-response
// round-tripping for a tool that has no side effect Gemini needs back.
function toApiMessage(message: SanadChatMessage): { role: "user" | "assistant"; text: string } {
  if (message.kind === "text") return { role: message.role, text: message.text };
  if (message.kind === "form") {
    return {
      role: "assistant",
      text: "[Sanad showed the investor a contact form to register this interest/request.]",
    };
  }
  return {
    role: "assistant",
    text: `[The investor's request was logged as ${message.record.inquiry_id}.]`,
  };
}

// The first thing the reader sees, built from real parcel data (never
// invented) and shown instantly with no API round-trip — reliability for
// the one line that absolutely must name the right parcel. Every reply
// after this one is Sanad's real, Gemini-backed conversation.
function buildGreetingMessage(
  launchState: SanadLaunchState | null,
  language: Language,
  t: (key: TranslationKey) => string
): SanadChatMessage {
  return {
    id: generateUuidV7(),
    kind: "text",
    role: "assistant",
    text: buildGreetingText(launchState, language, t),
    isGreeting: true,
  };
}

function buildGreetingText(
  launchState: SanadLaunchState | null,
  language: Language,
  t: (key: TranslationKey) => string
): string {
  if (launchState?.mode === "admin") return t("sanadGreetingAdmin");

  const parcel = launchState?.parcelId
    ? getParcelById(launchState.parcelId)
    : undefined;

  if (!parcel) return t("sanadGreetingGeneral");

  const district = language === "ar" ? parcel.district_ar : parcel.district_en;
  const templateKey =
    launchState?.mode === "request" ? "sanadGreetingRequest" : "sanadGreetingInquiry";

  return formatTemplate(t(templateKey), {
    district,
    parcelId: parcel.parcel_id,
  });
}

// Admin mode's header gets a visibly different color (the brand's own
// near-black foreground tone, not the investor-facing violet) rather
// than just different copy — a leader glancing at the panel should be
// able to tell at a glance which Sanad they're talking to.
function PanelHeader({
  mode,
  language,
  onMinimize,
  onClose,
  t,
}: {
  mode: SanadMode | null;
  language: Language;
  onMinimize: () => void;
  onClose: () => void;
  t: (key: TranslationKey) => string;
}) {
  const isAdmin = mode === "admin";

  return (
    <div
      className={`flex items-center justify-between gap-3 border-b border-hairline px-4 py-3 text-background ${
        isAdmin ? "bg-foreground" : "bg-primary"
      }`}
    >
      <div className="flex items-center gap-2">
        <SanadMark
          language={language}
          alt={t("sanadIdentityName")}
          className="h-6 w-auto shrink-0"
        />
        <SparkleIcon className="h-3 w-3 shrink-0 text-accent/80" />
        <div className="flex flex-col">
          {isAdmin && (
            <span className="font-heading text-sm font-semibold">
              {t("sanadRoleSuffixAdmin")}
            </span>
          )}
          <span className="text-[11px] text-background/75">
            {t(isAdmin ? "sanadSubtitleAdmin" : "sanadSubtitle")}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onMinimize}
          aria-label={t("sanadMinimize")}
          className="flex h-7 w-7 items-center justify-center rounded-full text-background/80 hover:bg-background/15 hover:text-background"
        >
          <MinimizeIcon className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("closePanel")}
          className="flex h-7 w-7 items-center justify-center rounded-full text-background/80 hover:bg-background/15 hover:text-background"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function MessageList({
  messages,
  isSending,
  bottomRef,
  onFormSubmitted,
  t,
}: {
  messages: SanadChatMessage[];
  isSending: boolean;
  bottomRef: RefObject<HTMLDivElement | null>;
  onFormSubmitted: (formMessageId: string, record: SanadInquiryRecord) => void;
  t: (key: TranslationKey) => string;
}) {
  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} onFormSubmitted={onFormSubmitted} />
      ))}
      {isSending && <TypingIndicator label={t("sanadTyping")} />}
      <div ref={bottomRef} />
    </div>
  );
}

function MessageBubble({
  message,
  onFormSubmitted,
}: {
  message: SanadChatMessage;
  onFormSubmitted: (formMessageId: string, record: SanadInquiryRecord) => void;
}) {
  if (message.kind === "form") {
    return (
      <div className="flex justify-start">
        <div className="w-full max-w-[92%]">
          <SanadContactForm
            offer={message.formOffer}
            onSubmitted={(record) => onFormSubmitted(message.id, record)}
          />
        </div>
      </div>
    );
  }

  if (message.kind === "confirmation") {
    return (
      <div className="flex justify-start">
        <SanadConfirmationCard record={message.record} />
      </div>
    );
  }

  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
          isUser
            ? "bg-primary text-background"
            : "border border-hairline bg-foreground/5 text-foreground"
        }`}
      >
        {renderSanadMarkdown(message.text)}
      </div>
    </div>
  );
}

function SanadConfirmationCard({ record }: { record: SanadInquiryRecord }) {
  const { t } = useLanguage();

  return (
    <div className="flex w-full max-w-[92%] flex-col gap-2 rounded-2xl border border-hairline bg-foreground/5 p-3.5 text-sm">
      <p className="font-semibold text-primary">{t("sanadConfirmationTitle")}</p>
      <p className="text-xs text-muted">
        {formatTemplate(t("sanadConfirmationId"), { id: record.inquiry_id })}
      </p>
      <div className="mt-1 flex flex-col items-start gap-1.5 border-t border-hairline pt-2">
        <p className="text-xs text-muted">{t("sanadWhatsappOffer")}</p>
        <a
          href={buildWhatsAppUrl(record)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-background transition-colors hover:bg-primary/90"
        >
          {t("sanadWhatsappButton")}
        </a>
      </div>
    </div>
  );
}

// A deliberately small Markdown subset — bold and lists, matching exactly
// what the persona is instructed to use (see src/lib/sanadPrompt.ts) —
// rather than pulling in a full Markdown dependency for two constructs.
function renderSanadMarkdown(text: string): ReactNode {
  return text.split(/\n{2,}/).map((block, blockIndex) => {
    const lines = block.split("\n").filter((line) => line.trim().length > 0);
    const listType = detectListType(lines);

    if (listType) {
      const items = lines.map((line, lineIndex) => (
        <li key={lineIndex}>{renderInlineBold(stripListMarker(line))}</li>
      ));
      return listType === "ol" ? (
        <ol key={blockIndex} className="list-decimal ps-4">
          {items}
        </ol>
      ) : (
        <ul key={blockIndex} className="list-disc ps-4">
          {items}
        </ul>
      );
    }

    return (
      <p key={blockIndex} className={blockIndex > 0 ? "mt-2" : undefined}>
        {renderInlineBold(block)}
      </p>
    );
  });
}

function detectListType(lines: string[]): "ul" | "ol" | null {
  if (lines.length === 0) return null;
  if (lines.every((line) => /^[-*]\s+/.test(line.trim()))) return "ul";
  if (lines.every((line) => /^\d+[.)]\s+/.test(line.trim()))) return "ol";
  return null;
}

function stripListMarker(line: string): string {
  return line.trim().replace(/^(?:[-*]|\d+[.)])\s+/, "");
}

function renderInlineBold(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((segment, index) => {
    const boldMatch = segment.match(/^\*\*([^*]+)\*\*$/);
    return boldMatch ? <strong key={index}>{boldMatch[1]}</strong> : segment;
  });
}

function TypingIndicator({ label }: { label: string }) {
  return (
    <div className="flex justify-start" role="status" aria-label={label}>
      <div className="flex items-center gap-1 rounded-2xl border border-hairline bg-foreground/5 px-3.5 py-2.5">
        <TypingDot delayMs={0} />
        <TypingDot delayMs={150} />
        <TypingDot delayMs={300} />
      </div>
    </div>
  );
}

function TypingDot({ delayMs }: { delayMs: number }) {
  return (
    <span
      aria-hidden="true"
      className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted"
      style={{ animationDelay: `${delayMs}ms` }}
    />
  );
}

function ErrorBanner({
  text,
  retryLabel,
  onRetry,
}: {
  text: string;
  retryLabel: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-hairline bg-foreground/5 px-4 py-2 text-xs text-muted">
      <span>{text}</span>
      <button
        type="button"
        onClick={onRetry}
        className="font-semibold text-primary hover:underline"
      >
        {retryLabel}
      </button>
    </div>
  );
}

function Composer({
  value,
  onChange,
  onSubmit,
  isSending,
  placeholder,
  sendLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isSending: boolean;
  placeholder: string;
  sendLabel: string;
}) {
  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-hairline p-3">
      {/* A plain <input> inside a <form> already submits on Enter — no
          extra keydown handling needed for "Enter to send". */}
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={isSending}
        className="flex-1 rounded-full border border-hairline bg-background px-4 py-2 text-sm text-foreground outline-none focus:border-primary disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={isSending || !value.trim()}
        aria-label={sendLabel}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-background transition-colors hover:bg-primary/90 disabled:opacity-40"
      >
        <SendIcon className="h-4 w-4" />
      </button>
    </form>
  );
}

function MinimizedPill({
  isAdmin,
  language,
  onExpand,
  t,
}: {
  isAdmin: boolean;
  language: Language;
  onExpand: () => void;
  t: (key: TranslationKey) => string;
}) {
  return (
    <SanadFab isAdmin={isAdmin} ariaLabel={t("sanadExpand")} onClick={onExpand}>
      <SanadMark language={language} alt={t("sanadIdentityName")} className="h-4 w-auto shrink-0" />
      <SparkleIcon className="h-2.5 w-2.5 shrink-0 text-accent/80" />
      {isAdmin && (
        <span className="font-heading">{t("sanadRoleSuffixAdmin")}</span>
      )}
      <ExpandIcon className="h-3.5 w-3.5" />
    </SanadFab>
  );
}

// Shared shell for both floating buttons — SanadLaunchButton (nothing
// open yet) and MinimizedPill (an open conversation, tucked away) —
// same fixed corner position and the same admin-vs-investor coloring
// used throughout (near-black for admin, violet otherwise; see
// PanelHeader), so the two feel like one consistent affordance rather
// than two different widgets depending on conversation state.
function SanadFab({
  isAdmin,
  ariaLabel,
  onClick,
  children,
}: {
  isAdmin: boolean;
  ariaLabel: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`fixed bottom-4 end-4 z-[2000] flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-background shadow-xl transition-colors sm:bottom-6 sm:end-6 ${
        isAdmin ? "bg-foreground hover:bg-foreground/90" : "bg-primary hover:bg-primary/90"
      }`}
    >
      {children}
    </button>
  );
}

// The Sanad wordmark — a separate PNG per UI language (see
// public/brand/sanad-ar-logo.png / sanad-en-logo.png for the full
// black-on-white originals these are derived from), each cropped tight
// and recolored to the brand's cream so it reads clearly against both
// header treatments above (violet and near-black), same as the
// text-background labels beside it. The two source logos aren't the same
// aspect ratio, so width/height (used only to give next/image the right
// intrinsic aspect ratio — actual display size is set by className) are
// tracked per language rather than shared.
const SANAD_MARK: Record<Language, { src: string; width: number; height: number }> = {
  ar: { src: "/brand/sanad-ar-mark-light.png", width: 1400, height: 411 },
  en: { src: "/brand/sanad-en-mark-light.png", width: 1400, height: 342 },
};

function SanadMark({
  language,
  alt,
  className,
}: {
  language: Language;
  alt: string;
  className?: string;
}) {
  const mark = SANAD_MARK[language];
  return (
    <Image
      src={mark.src}
      alt={alt}
      width={mark.width}
      height={mark.height}
      className={`object-contain ${className ?? ""}`}
      preload
    />
  );
}

// A small four-point sparkle — the subtle "AI-assisted" glyph sitting
// beside Sanad's mark, in the brand's lilac accent (not the darker
// primary violet, which would barely register against the header's own
// violet/near-black fills).
function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 2c.6 3.6 2.4 5.4 6 6-3.6.6-5.4 2.4-6 6-.6-3.6-2.4-5.4-6-6 3.6-.6 5.4-2.4 6-6Z" />
      <path d="M19 15c.3 1.6 1 2.3 2.6 2.6-1.6.3-2.3 1-2.6 2.6-.3-1.6-1-2.3-2.6-2.6 1.6-.3 2.3-1 2.6-2.6Z" />
    </svg>
  );
}

function MinimizeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className={className}>
      <path d="M5 12h14" />
    </svg>
  );
}

function ExpandIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M18 15l-6-6-6 6" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className={className}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4 20-7Z" />
    </svg>
  );
}
