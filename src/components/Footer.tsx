"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage, type TranslationKey } from "@/lib/i18n";
import { SITE_NAV_LINKS } from "@/lib/siteNav";

// Shared page bottom: a proper multi-column footer (see FooterColumns
// below) — investor-facing pages only. The admin dashboard already has
// its own in-app path to Sanad and doesn't need a site nav repeated
// under it.
//
// There used to be a "Contact us" CTA band here too, above the columns.
// It's gone: pages that want their own closing CTA (see ClosingCta in
// src/app/about/page.tsx) now own that directly, and stacking this
// footer's version right underneath just repeated the same "talk to
// Sanad" nudge twice in a row. Don't add a footer-wide CTA back without
// checking what the calling page already has.
export function Footer() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith("/admin") ?? false;

  return (
    <footer className="border-t border-hairline">
      {!isAdminRoute && <FooterColumns t={t} />}
      <BottomBar t={t} withTopDivider={!isAdminRoute} />
    </footer>
  );
}

// Deliberately not a real number/inbox — this is a demo product with no
// live support line yet — so the contact column below marks them
// explicitly rather than presenting them as working contact channels.
const PLACEHOLDER_PHONE = "+966 5X XXX XXXX";
const PLACEHOLDER_EMAIL = "hello@sarj.ai";

// The three-column footer body: brand, site links, contact details.
// Plain source order (brand, then links, then contact) — no manual
// left/right swapping for language, since a CSS grid already flows
// start-to-end per the document's dir, the same way the header's own
// flex row mirrors automatically between Arabic and English.
function FooterColumns({ t }: { t: (key: TranslationKey) => string }) {
  return (
    <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-6 py-14 text-start sm:grid-cols-3 sm:gap-8">
      <BrandColumn t={t} />
      <LinksColumn t={t} />
      <ContactColumn t={t} />
    </div>
  );
}

function BrandColumn({ t }: { t: (key: TranslationKey) => string }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline gap-2">
        <span className="font-heading text-xl font-semibold text-primary">سرج</span>
        <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
          sarj.ai
        </span>
      </div>
      <p className="max-w-[220px] text-sm text-muted">{t("footerTagline")}</p>
    </div>
  );
}

// Deliberately no /admin entry here: the dashboard is internal-leadership
// only and must never be advertised to a regular investor, even though
// the route itself stays reachable directly by URL (see the comment atop
// src/app/admin/page.tsx). Don't add one back without re-reading that.
// Same three links as the header's own nav — see SITE_NAV_LINKS.
function LinksColumn({ t }: { t: (key: TranslationKey) => string }) {
  return (
    <nav className="flex flex-col gap-4">
      <p className="section-label">{t("footerLinksHeading")}</p>
      <ul className="flex flex-col gap-2.5 text-sm text-foreground/80">
        {SITE_NAV_LINKS.map(({ key, href }) => (
          <li key={key}>
            <Link href={href} className="transition-colors hover:text-primary">
              {t(key)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// id="contact" is what the "تواصل / Contact" link (in both the header's
// nav and LinksColumn above) scrolls to.
function ContactColumn({ t }: { t: (key: TranslationKey) => string }) {
  return (
    <div id="contact" className="flex flex-col gap-4 scroll-mt-6">
      <p className="section-label">{t("navLinkContact")}</p>
      <div className="flex flex-col gap-2 text-sm text-foreground/80">
        <p>
          <span className="text-muted">{t("contactPhoneLabel")}: </span>
          <span dir="ltr">{PLACEHOLDER_PHONE}</span>
        </p>
        <p>
          <span className="text-muted">{t("contactEmailLabel")}: </span>
          <span dir="ltr">{PLACEHOLDER_EMAIL}</span>
        </p>
        <p className="text-[11px] text-muted">({t("footerContactDemoNote")})</p>
      </div>
    </div>
  );
}

// `withTopDivider` is false only on admin pages, where this bar follows
// directly after the outer <footer>'s own top border — without it, that
// border and this one would sit flush against each other with nothing
// between them.
function BottomBar({
  t,
  withTopDivider,
}: {
  t: (key: TranslationKey) => string;
  withTopDivider: boolean;
}) {
  const year = new Date().getFullYear();

  return (
    <div className={withTopDivider ? "border-t border-hairline" : undefined}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {year} سرج · sarj.ai
        </p>
        <p>{t("footerRights")}</p>
      </div>
    </div>
  );
}
