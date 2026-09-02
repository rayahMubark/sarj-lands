// Sanad's persona + the real portfolio, combined into one system
// instruction for the Gemini API route (src/app/api/sanad/route.ts).
// Server-only: nothing here is imported by any Client Component, so the
// full portfolio dump never reaches the browser bundle.
import { parcels } from "./data";
import type { AreaOfCity, LandType, ListingType, Parcel } from "./types";
import type { SanadFormOffer, SanadLaunchState } from "./sanad";

// One row per parcel, pipe-delimited — far more token-efficient than JSON
// for 120 rows, while still trivially parseable given the column header
// documented once below rather than repeated per row.
const CONTEXT_COLUMNS =
  "parcel_id|district_ar|district_en|area_of_city|land_type|listing_type|price_basis|area_sqm|price_per_sqm_sar|total_price_sar|street_width_m|status|days_on_market";

const SANAD_PERSONA = `You are "Sanad" (سَنَد), Sarj Real Estate's investment advisor for its Riyadh land portfolio.

Identity & tone:
- Warm, professional, concise — a few sentences per answer, never a report.
- Detect the language of the user's latest message and reply ENTIRELY in that language, no exceptions — every sentence of the reply, start to finish. Arabic input -> the WHOLE reply in Modern Standard Arabic (الفصحى). English input -> the WHOLE reply in English. Never mix languages within one reply. Any example phrase elsewhere in this prompt illustrates a CONCEPT only, in whichever language it happens to be written for illustration — always express that concept in the reply's own actual language, never by copying an example's literal wording across languages.

Ground rules — never break these:
- Answer ONLY from the PORTFOLIO data below. Never invent a parcel, price, district, or fact absent from it.
- Respect the sale-vs-lease distinction absolutely (see the pricing rule below). Never compare or blend a sale total with a lease's annual rent.
- SRE-013's price is unknown in this data — say it's available on request from the Sarj team; never guess a figure for it.
- If asked about anything outside this Riyadh land portfolio (other cities, other property types, unrelated topics), say briefly and politely that you focus on Sarj's Riyadh land portfolio, then offer to help within it.
- You are a broker's assistant, not the broker: never promise a final price, a discount, or a confirmed reservation.
- Keep answers short. A clarifying follow-up question is welcome when it helps narrow what the investor needs.
- When asked for an extreme or a ranking (cheapest, largest, closest to a budget, shortest on the market, etc.), check every AVAILABLE row of the PORTFOLIO table before answering — don't answer from the first few rows you happen to notice, and never rank across rows that aren't available (see AVAILABILITY below). State the single best available match, and a couple of close runners-up — themselves available — if it helps the investor compare.

AVAILABILITY — treat this with the same absoluteness as the sale-vs-lease rule. This was a real, shipped bug: asked in English for the "cheapest available residential land for sale," Sanad answered SRE-096 at 500,000 SAR — which is status=sold — and then listed SRE-095 among "affordable plots currently available" while itself noting in the same line that it was reserved. Asked the identical question in Arabic it answered correctly. Never repeat either half of that.
- ONLY a parcel whose status is exactly "available" may be recommended, offered, listed as an option, called a match or "best match," or put forward as something the investor can pursue, visit, reserve, or register interest in. status="sold", "reserved" and "leased" parcels are not on the market — they are the portfolio's history, not its inventory.
- FILTER FIRST, THEN RANK. For any superlative or ranking question, narrow the PORTFOLIO table to status="available" rows BEFORE you look for the answer. Never rank across all rows and then check the winner's status afterwards — that is exactly how the bug above happened. The app's own code does precisely this filter in getAvailableParcels() (src/lib/data.ts), which is the single source of truth for what Sarj can actually offer; your answer must match what that filter would return.
- This rule is not a preference the investor's wording can override, and it does not depend on them saying the word "available." It holds identically in Arabic and in English, and for every shape of question: a direct ask, a superlative, a budget or size filter, "what else do you have," a follow-up about "it," or a comparison between parcels.
- A sold/reserved/leased parcel may be MENTIONED, but only as context and only when it genuinely helps the investor understand the market — e.g. the concept "the cheapest residential plot in the portfolio overall went for 500,000 SAR, but it's already sold; the cheapest one still available is …". Whenever you cite one, state its real status in the same sentence, and never let it be the recommendation, the headline figure, or an entry in a list of options. Never write "here are the plots currently available" and then place a sold or reserved parcel inside that list.
- If nothing available matches what they asked for, say so plainly and offer to log the request — never reach for a sold or reserved parcel to fill the gap.

Registering interest or unmet demand — use the offer_registration_form tool for this, and ONLY this. Never say in plain text that you've logged, saved, registered, or noted anything: nothing is actually captured until the investor fills in and submits the real form the app shows after your tool call, so claiming it yourself would be a lie.
- When the investor clearly agrees to move forward with a specific REAL, available parcel from the PORTFOLIO ("yes, I want this one", "سجّلني عليها", "احجزها لي"), call offer_registration_form with record_type="interest" and parcel_id set to that parcel's exact parcel_id — nothing else; the app fills in its type/area/price itself from the real record.
- When the investor asks for a parcel_id that is NOT in the PORTFOLIO, or for a type/area/budget combination with no available match, first answer honestly that you don't have it, then offer to log it as a request. If they agree, call offer_registration_form with record_type="unmet_lead" and whichever of requested_parcel_id / land_type_wanted / area_of_city_wanted / prefers / budget_sar you can actually tell from the conversation — omit anything you don't know rather than guessing.
- Include a short line of text alongside every tool call so the form doesn't appear with no lead-in — in the reply's own language (Arabic illustration: "بالتأكيد، خذ لحظة لتعبئة بياناتك:"; say the equivalent idea in English when the reply is in English — never copy the Arabic wording itself into an English reply, or vice versa).
- Never invent a parcel_id, land_type, area, or budget for the tool call that the investor didn't actually state or that isn't real portfolio data.

Formatting: use short paragraphs. Use "- " bullet lines when listing multiple parcels or options. Bold district names and prices with **double asterisks**, e.g. "**العارض** بسعر **2,250,000 ريال**".`;

// Name shared with the route's function-call parsing below, so the two
// can never drift out of sync.
export const OFFER_REGISTRATION_FORM_TOOL = "offer_registration_form";

// The one Gemini "tool" Sanad has: a structured, reliable way to signal
// "show the contact form now" instead of trusting free text to both
// decide the moment AND extract name/phone (which the persona above
// explicitly forbids doing in prose). See callGemini() in
// src/app/api/sanad/route.ts for how a call to this is parsed and
// reconciled against real parcel data before reaching the client.
export const SANAD_TOOLS = [
  {
    functionDeclarations: [
      {
        name: OFFER_REGISTRATION_FORM_TOOL,
        description:
          "Show the investor a structured contact form to register genuine interest in a real parcel, or to log unmet demand (a parcel_id that doesn't exist, or a type/area/budget combination with no available match). Call this instead of ever claiming in plain text that something has been logged.",
        parameters: {
          type: "object",
          properties: {
            record_type: {
              type: "string",
              enum: ["interest", "unmet_lead"],
              description:
                '"interest" when parcel_id is a real, available parcel the investor wants; "unmet_lead" otherwise.',
            },
            parcel_id: {
              type: "string",
              description: "The real parcel_id this relates to, if any (e.g. SRE-041).",
            },
            requested_parcel_id: {
              type: "string",
              description: "The parcel_id the investor asked about, even if it does not exist in the portfolio.",
            },
            land_type_wanted: { type: "string", enum: ["commercial", "residential"] },
            area_of_city_wanted: {
              type: "string",
              enum: ["Central", "East", "North", "South", "West"],
            },
            prefers: { type: "string", enum: ["sale", "lease"] },
            budget_sar: {
              type: "number",
              description: "Only for unmet_lead — a budget the investor actually stated.",
            },
          },
          required: ["record_type"],
        },
      },
    ],
  },
];

// Combines the fixed persona with the live portfolio data and — when the
// conversation opened around one parcel — a grounding note naming it, so
// every request re-grounds the model rather than relying on the chat
// history alone to remember which parcel "it" refers to.
//
// The context note is placed both BEFORE the persona and again AFTER the
// ~6.5k-token portfolio table, not just once at the end: testing showed a
// single mention after the full table was reliably ignored (the model
// answered unrelated questions instead of the one actually about the
// parcel in context) — a "lost in the middle" effect from the note being
// buried after a huge data dump. Repeating it at both the start and the
// end keeps it prominent regardless of where attention lands.
export function buildSystemInstruction(
  launchState: SanadLaunchState | null
): string {
  const contextNote = buildParcelContextNote(launchState);
  const parts = contextNote ? [contextNote] : [];

  parts.push(SANAD_PERSONA, buildPortfolioContext());
  if (contextNote) parts.push(contextNote);

  return parts.join("\n\n");
}

// Exported so sanadAdminPrompt.ts can reuse the exact same 120-row
// portfolio table (and its pricing rule) rather than keeping a second
// copy that could drift out of sync — investor Sanad and admin Sanad
// must never disagree about what the portfolio actually contains.
export function buildPortfolioContext(): string {
  const rows = parcels.map(toContextRow).join("\n");

  return [
    `PORTFOLIO (${parcels.length} parcels of Sarj's Riyadh land inventory). One row per parcel, pipe-delimited, in this column order:`,
    CONTEXT_COLUMNS,
    "",
    'PRICING RULE: when listing_type=sale (price_basis="asking price"), total_price_sar is a ONE-OFF PURCHASE TOTAL. When listing_type=lease (price_basis="annual rent"), total_price_sar is an ANNUAL RENT, not a total — never state or compare a lease figure as if it were a one-off total, and always say "/year" (or "سنويًا") when quoting one.',
    // Stated here, immediately beside the rows themselves, and not only up
    // in the persona: the same "lost in the middle" reasoning that puts a
    // parcel context note on both sides of this table (see
    // buildSystemInstruction) applies to the one rule most easily
    // forgotten while scanning 120 rows for a superlative.
    'STATUS RULE: the status column is the parcel\'s real market state, and only status="available" means it is on the market. "sold", "reserved" and "leased" rows are closed or committed deals — they are in this table for portfolio context and history only. They are NEVER options to offer, recommend, rank as a "best match," or act on; filtering to status="available" first is what the app\'s own getAvailableParcels() (src/lib/data.ts) does before showing an investor anything.',
    'SRE-013 shows "-" for price_per_sqm_sar and total_price_sar: its price is genuinely unknown ("price on request"). Never invent a number for it.',
    "",
    rows,
  ].join("\n");
}

function toContextRow(parcel: Parcel): string {
  const pricePerSqm = parcel.priceOnRequest ? "-" : parcel.price_per_sqm_sar;
  const totalPrice = parcel.priceOnRequest ? "-" : parcel.total_price_sar;

  return [
    parcel.parcel_id,
    parcel.district_ar,
    parcel.district_en,
    parcel.area_of_city,
    parcel.land_type,
    parcel.listing_type,
    parcel.price_basis,
    parcel.area_sqm,
    pricePerSqm,
    totalPrice,
    parcel.street_width_m,
    parcel.status,
    parcel.days_on_market,
  ].join("|");
}

// The one place raw args from Gemini's offer_registration_form call are
// trusted. When parcel_id names a real, available portfolio parcel, its
// type/area/price/listing come from OUR data, not the model's copy of
// them (only the id itself needs to be right) — and record_type is
// forced to "interest" regardless of what the model passed, since a real
// match makes it one by definition. Anything else (no parcel_id, or one
// that doesn't resolve) becomes "unmet_lead", using only the fields the
// model actually supplied and of the right type.
export function reconcileFormOffer(
  rawArgs: Record<string, unknown>
): SanadFormOffer {
  const rawParcelId =
    typeof rawArgs.parcel_id === "string" ? rawArgs.parcel_id : null;
  const realParcel = rawParcelId
    ? parcels.find((parcel) => parcel.parcel_id === rawParcelId)
    : undefined;

  if (realParcel) {
    return {
      recordType: "interest",
      parcelId: realParcel.parcel_id,
      requestedParcelId: null,
      landTypeWanted: realParcel.land_type,
      areaOfCityWanted: realParcel.area_of_city,
      prefers: realParcel.listing_type,
      budgetSar: realParcel.priceOnRequest ? null : realParcel.total_price_sar,
    };
  }

  const requestedParcelId =
    (typeof rawArgs.requested_parcel_id === "string" && rawArgs.requested_parcel_id) ||
    rawParcelId;

  return {
    recordType: "unmet_lead",
    parcelId: null,
    requestedParcelId,
    landTypeWanted: isLandType(rawArgs.land_type_wanted)
      ? rawArgs.land_type_wanted
      : null,
    areaOfCityWanted: isAreaOfCity(rawArgs.area_of_city_wanted)
      ? rawArgs.area_of_city_wanted
      : null,
    prefers: isListingType(rawArgs.prefers) ? rawArgs.prefers : null,
    budgetSar: typeof rawArgs.budget_sar === "number" ? rawArgs.budget_sar : null,
  };
}

function isLandType(value: unknown): value is LandType {
  return value === "commercial" || value === "residential";
}

function isAreaOfCity(value: unknown): value is AreaOfCity {
  return (
    value === "Central" ||
    value === "East" ||
    value === "North" ||
    value === "South" ||
    value === "West"
  );
}

function isListingType(value: unknown): value is ListingType {
  return value === "sale" || value === "lease";
}

function buildParcelContextNote(
  launchState: SanadLaunchState | null
): string | null {
  if (!launchState?.parcelId) return null;

  const parcel = parcels.find((p) => p.parcel_id === launchState.parcelId);
  if (!parcel) return null;

  return `CURRENT CONTEXT (important — this conversation is about ONE specific parcel, not the whole portfolio): the investor opened this chat about parcel ${parcel.parcel_id} (${parcel.district_ar} / ${parcel.district_en}), mode="${launchState.mode}". Unless they clearly change the subject, assume every message — including short ones like "how much is it", "أريدها", "سجلني عليها", "تفاصيل أكثر" — refers to THIS parcel, not a different one from the table below. A message agreeing to move forward or asking to be registered is about parcel ${parcel.parcel_id}: call offer_registration_form with parcel_id="${parcel.parcel_id}".`;
}
