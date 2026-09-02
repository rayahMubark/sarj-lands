"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useLanguage, type TranslationKey } from "@/lib/i18n";
import { useSanad } from "@/lib/sanad";

// A short, focused "about" page — not a full landing page — introducing
// what Sarj/Sanad do to a reader who arrived from the footer's "About
// Sarj" link. Four sections: intro, the problem Sanad solves, four
// capability cards, and one closing CTA. Every string is bilingual via
// t() (see the aboutXxx keys in src/lib/i18n.ts) and the layout mirrors
// RTL/LTR the same way the rest of the app does — logical spacing
// utilities and the document's own dir, no manual per-language branching.
export default function AboutPage() {
  const { t } = useLanguage();
  const { openSanad } = useSanad();

  return (
    <div className="flex flex-1 flex-col">
      <IntroSection t={t} />
      <ProblemSection t={t} />
      <CapabilitiesSection t={t} />
      <ClosingCta t={t} onTalkToSanad={() => openSanad({ mode: "general" })} />
    </div>
  );
}

// `brand-grain` — the same textured violet wash the homepage hero opens
// with (see HeroBand in src/app/page.tsx) — so arriving here still feels
// like the same product, not a plain "about us" template bolted on.
function IntroSection({ t }: { t: (key: TranslationKey) => string }) {
  return (
    <div className="brand-grain border-b border-hairline px-6 py-16 sm:py-20">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
        <p className="section-label">{t("heroEyebrow")}</p>
        <h1 className="font-heading text-3xl font-semibold leading-tight text-primary sm:text-4xl">
          {t("aboutIntroHeading")}
        </h1>
        <p className="max-w-xl text-sm text-foreground/80 sm:text-base">
          {t("aboutIntroParagraph")}
        </p>
      </div>
    </div>
  );
}

function ProblemSection({ t }: { t: (key: TranslationKey) => string }) {
  return (
    <div className="border-b border-hairline px-6 py-14 sm:py-16">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
        <h2 className="font-heading text-2xl font-semibold text-primary sm:text-3xl">
          {t("aboutProblemHeading")}
        </h2>
        <p className="max-w-xl text-sm text-foreground/80 sm:text-base">
          {t("aboutProblemParagraph")}
        </p>
      </div>
    </div>
  );
}

interface Capability {
  icon: ReactNode;
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
}

// Four cards, each icon + title + one line — deliberately terse, per the
// brief's "keep it focused" instruction. Icons are plain inline SVGs in
// the same thin-stroke style already used throughout SanadPanel.tsx
// (Minimize/Close/Send/Expand), so this page doesn't introduce a second
// icon language.
const CAPABILITIES: Capability[] = [
  {
    icon: <TargetIcon />,
    titleKey: "aboutCapSanadTitle",
    descriptionKey: "aboutCapSanadDesc",
  },
  {
    icon: <MapPinIcon />,
    titleKey: "aboutCapMapTitle",
    descriptionKey: "aboutCapMapDesc",
  },
  {
    icon: <DataIcon />,
    titleKey: "aboutCapDataTitle",
    descriptionKey: "aboutCapDataDesc",
  },
  {
    icon: <InsightIcon />,
    titleKey: "aboutCapLeadershipTitle",
    descriptionKey: "aboutCapLeadershipDesc",
  },
];

function CapabilitiesSection({ t }: { t: (key: TranslationKey) => string }) {
  return (
    <div className="border-b border-hairline px-6 py-14 sm:py-16">
      <div className="mx-auto grid max-w-4xl grid-cols-1 gap-5 sm:grid-cols-2">
        {CAPABILITIES.map((capability) => (
          <CapabilityCard
            key={capability.titleKey}
            icon={capability.icon}
            title={t(capability.titleKey)}
            description={t(capability.descriptionKey)}
          />
        ))}
      </div>
    </div>
  );
}

function CapabilityCard({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-2xl border border-hairline bg-background p-6 text-start">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        {icon}
      </span>
      <h3 className="font-heading text-lg font-semibold text-primary">{title}</h3>
      <p className="text-sm text-muted">{description}</p>
    </div>
  );
}

// Deliberately no brand-grain here — this page's own IntroSection above
// already opens with that treatment, and repeating it again right before
// the footer would compete with it rather than read as a deliberate pair.
// Also deliberately the ONLY closing CTA on this page: the footer used to
// carry its own "Contact us" band too, which just repeated this one
// immediately underneath it — see the comment on Footer() for why that's
// gone now.
function ClosingCta({
  t,
  onTalkToSanad,
}: {
  t: (key: TranslationKey) => string;
  onTalkToSanad: () => void;
}) {
  return (
    <div className="px-6 py-14 sm:py-16">
      <div className="mx-auto flex max-w-xl flex-col items-center gap-5 text-center">
        <p className="font-heading text-xl font-semibold text-primary sm:text-2xl">
          {t("aboutClosingLine")}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-background transition-colors hover:bg-primary/90"
          >
            {t("aboutBrowseLandsCta")}
          </Link>
          <button
            type="button"
            onClick={onTalkToSanad}
            className="rounded-full border border-hairline px-6 py-3 text-sm font-semibold text-primary transition-colors hover:border-primary"
          >
            {t("sanadNavLabel")}
          </button>
        </div>
      </div>
    </div>
  );
}

// Recommendation — a target, standing in for "the right match, found."
function TargetIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="h-5 w-5">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

// The map — a pin, matching the same mark ParcelMapView's own pins use.
function MapPinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true" className="h-5 w-5">
      <path d="M12 21s7-7.58 7-12a7 7 0 1 0-14 0c0 4.42 7 12 7 12Z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

// Data — a simple bar chart, for "price, area, location, time on market."
function DataIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true" className="h-5 w-5">
      <path d="M4 20V11M12 20V4M20 20v-6" />
    </svg>
  );
}

// Leadership's view — an eye, for "a clearer view of demand."
function InsightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true" className="h-5 w-5">
      <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
