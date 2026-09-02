"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { SITE_NAV_LINKS } from "@/lib/siteNav";
import { LanguageToggle } from "@/components/LanguageToggle";

// Shared site header: logo, nav, language toggle — investor pages only.
// No "Talk to Sanad" button and no Sanad identity badge live here (Sanad's
// own entry point is the persistent floating launcher — see
// SanadPanel.tsx — which already carries its own branding, so repeating
// it in the header was pure clutter). Rendered once from
// src/app/layout.tsx so every page, including /admin, inherits it — but
// the nav itself is hidden on /admin: that dashboard is a workspace with
// its own tabs (see AdminTabNav), not a page a leader browses via the
// investor site's Browse/About/Contact links.
//
// Layout: a 3-column grid (logo, nav, toggle) rather than a 2-item flex
// row — with the nav hidden (isAdminRoute) the middle column is just
// empty, and the grid still pushes logo/toggle to opposite ends exactly
// like the old 2-item layout did, with no separate admin-only markup
// needed. Column order is source order (logo, nav, toggle); the grid
// flows start-to-end per the document's own dir, so it mirrors between
// Arabic and English the same way the rest of the app already does.
export function Header() {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith("/admin") ?? false;
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="border-b border-hairline">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-4 px-6 py-5">
        <BrandLockup />
        {!isAdminRoute && <DesktopNav pathname={pathname} />}
        <div className="flex items-center justify-end gap-2">
          {!isAdminRoute && (
            <MobileMenuButton
              isOpen={isMenuOpen}
              onToggle={() => setIsMenuOpen((open) => !open)}
            />
          )}
          <LanguageToggle />
        </div>
      </div>

      {!isAdminRoute && isMenuOpen && (
        <MobileNav pathname={pathname} onNavigate={() => setIsMenuOpen(false)} />
      )}
    </header>
  );
}

// The actual Sarj logo (Arabic "سرج" over "sarj.ai" — see
// public/brand/sarj-logo.png for the source, and the comment on
// SARJ_LOGO_SRC below for how this crop differs from it), not a styled
// text stand-in. Same asset for both languages — it already carries both
// scripts, so there's nothing to swap on toggle. Height-constrained with
// width auto so next/image can never crop or stretch it regardless of
// its own aspect ratio.
function BrandLockup() {
  return (
    <Link href="/" aria-label="سرج · sarj.ai" className="shrink-0">
      <Image
        src={SARJ_LOGO_SRC}
        alt="سرج / sarj.ai"
        width={SARJ_LOGO_WIDTH}
        height={SARJ_LOGO_HEIGHT}
        className="h-10 w-auto object-contain"
        preload
      />
    </Link>
  );
}

// Cropped tight to the mark and cut to a transparent background (the
// source PNG is opaque white, which left a faint but visible box against
// the header's cream background) — see the crop script notes in the
// public/brand/ derivation history. Ink color otherwise untouched: this
// asset's background is always the page's own cream, never a colored bar
// like Sanad's marks sit on, so there was no need to recolor it too.
const SARJ_LOGO_SRC = "/brand/sarj-logo-header.png";
const SARJ_LOGO_WIDTH = 351;
const SARJ_LOGO_HEIGHT = 207;

// Centered inline row, desktop only (md:flex) — see MobileNav for the
// small-screen equivalent. SITE_NAV_LINKS (src/lib/siteNav.ts) is the
// same list the footer's own link column reads, so the two destinations
// can never drift apart.
function DesktopNav({ pathname }: { pathname: string | null }) {
  const { t } = useLanguage();

  return (
    <nav className="hidden items-center justify-center gap-6 md:flex">
      {SITE_NAV_LINKS.map(({ key, href }) => (
        <NavLink key={key} href={href} label={t(key)} isActive={pathname === href} />
      ))}
    </nav>
  );
}

// Exact-match active state — "/" is only active on the literal homepage,
// not every route under it, and "#contact" (not a route) never matches,
// which is correct: it has no "active page" of its own to indicate.
function NavLink({
  href,
  label,
  isActive,
}: {
  href: string;
  label: string;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={`text-sm font-medium transition-colors ${
        isActive ? "text-primary" : "text-foreground/70 hover:text-primary"
      }`}
    >
      {label}
    </Link>
  );
}

function MobileMenuButton({
  isOpen,
  onToggle,
}: {
  isOpen: boolean;
  onToggle: () => void;
}) {
  const { t } = useLanguage();

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      aria-label={t("navMenuLabel")}
      className="flex h-9 w-9 items-center justify-center rounded-full text-foreground/70 transition-colors hover:bg-foreground/5 hover:text-primary md:hidden"
    >
      {isOpen ? <CloseMenuIcon className="h-5 w-5" /> : <HamburgerIcon className="h-5 w-5" />}
    </button>
  );
}

// The collapsed nav's expanded state — a plain stacked list under the
// header row, mobile only (md:hidden matches MobileMenuButton's own, so
// the two always appear/disappear together at the same breakpoint).
// `onNavigate` closes the menu on any click, including the "#contact"
// hash link: that's a same-page scroll, not a real navigation, so
// nothing else would close it for us.
function MobileNav({
  pathname,
  onNavigate,
}: {
  pathname: string | null;
  onNavigate: () => void;
}) {
  const { t } = useLanguage();

  return (
    <nav className="border-t border-hairline px-6 py-3 md:hidden">
      <ul className="flex flex-col gap-1">
        {SITE_NAV_LINKS.map(({ key, href }) => {
          const isActive = pathname === href;
          return (
            <li key={key}>
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={isActive ? "page" : undefined}
                className={`block rounded-lg px-2 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? "text-primary" : "text-foreground/70 hover:text-primary"
                }`}
              >
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function HamburgerIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function CloseMenuIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
