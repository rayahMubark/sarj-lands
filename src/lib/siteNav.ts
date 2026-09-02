// The investor site's three nav destinations — shared by the header's
// own nav (see Header.tsx) and the footer's link column (see LinksColumn
// in Footer.tsx) so the two can never point somewhere different from
// each other. Admin is deliberately not included here; see the comment
// on LinksColumn in Footer.tsx for why.
import type { TranslationKey } from "./i18n";

export interface SiteNavLink {
  key: TranslationKey;
  href: string;
}

export const SITE_NAV_LINKS: SiteNavLink[] = [
  { key: "navLinkBrowse", href: "/" },
  { key: "navLinkAbout", href: "/about" },
  // The footer's own contact details (see ContactColumn in Footer.tsx,
  // which carries id="contact") — present on every investor page, so
  // this same hash works no matter which page it's clicked from.
  { key: "navLinkContact", href: "#contact" },
];
