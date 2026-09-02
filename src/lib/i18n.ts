"use client";

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  AreaOfCity,
  Intent,
  InquiryStatus,
  LandType,
  ListingType,
  ParcelStatus,
} from "./types";

export type Language = "ar" | "en";
export type Direction = "rtl" | "ltr";

// Sarj is Arabic-first: the app opens in Arabic/RTL and the reader opts
// into English, not the other way around.
const DEFAULT_LANGUAGE: Language = "ar";

// Bilingual string map. Add new UI copy here — every entry needs both an
// 'ar' and an 'en' value so nothing silently falls back to the wrong
// language. Entries with a "{placeholder}" are filled via formatTemplate()
// from src/lib/format.ts.
export const dictionary = {
  footerTagline: {
    ar: "استثمار عقاري بمعايير عالمية.",
    en: "Land investment, built to a global standard.",
  },
  footerRights: {
    ar: "جميع الحقوق محفوظة",
    en: "All rights reserved",
  },

  // Footer's contact column (see ContactColumn in src/components/Footer.tsx).
  contactPhoneLabel: {
    ar: "هاتف",
    en: "Phone",
  },
  contactEmailLabel: {
    ar: "بريد إلكتروني",
    en: "Email",
  },

  // The site's three nav destinations — shared by the header's own nav
  // (see Header.tsx) and the footer's link column (see LinksColumn in
  // Footer.tsx; SITE_NAV_LINKS in src/lib/siteNav.ts is what actually
  // shares the (key, href) pairs between the two, these are just the
  // label text). "About Sarj" links to src/app/about/page.tsx.
  navLinkBrowse: {
    ar: "استكشف الأراضي",
    en: "Browse lands",
  },
  navLinkAbout: {
    ar: "عن سرج",
    en: "About Sarj",
  },
  navLinkContact: {
    ar: "تواصل",
    en: "Contact",
  },
  // Accessible label for the header's mobile menu toggle (see
  // MobileMenuButton in Header.tsx) — one label for both open and closed
  // states; aria-expanded already conveys which.
  navMenuLabel: {
    ar: "القائمة",
    en: "Menu",
  },
  // Footer-only: the "Links" column heading above navLinkBrowse/About/
  // Contact when they're laid out as a footer column. The header's own
  // nav (a plain inline row) doesn't need a heading for itself.
  footerLinksHeading: {
    ar: "روابط",
    en: "Links",
  },
  // Deliberately no navLinkAdmin — the admin dashboard is never linked
  // from investor-facing UI (see the comment on LinksColumn in
  // Footer.tsx). adminTitle below is the dashboard's own page heading,
  // shown only once already there, not a link that would expose it.

  // Footer's contact column — same placeholder phone/email as the CTA
  // band above it used to show; now lives here instead, so it's said
  // once rather than duplicated. contactPhoneLabel/contactEmailLabel
  // above are reused for its two lines.
  footerContactDemoNote: {
    ar: "بيانات تجريبية",
    en: "Demo data",
  },
  switchToArabic: {
    ar: "التبديل إلى العربية",
    en: "Switch to Arabic",
  },
  switchToEnglish: {
    ar: "التبديل إلى الإنجليزية",
    en: "Switch to English",
  },

  // Browse page — hero band. Numbers themselves aren't translated strings
  // (they're live portfolio counts — see HeroBand in page.tsx) so only
  // each stat's unit label lives here.
  heroEyebrow: {
    ar: "منصة الذكاء العقاري من سرج",
    en: "Sarj Real-Estate Intelligence",
  },
  heroHeadline: {
    ar: "لكل هدف أرض تناسبه، وسَنَد يلقى لك الأنسب.",
    en: "Every goal has a land. Sanad finds your best match.",
  },
  heroSubtext: {
    ar: "سواء مستودع أو مجمع سكني أو معرض — قُل لسَنَد هدفك، يرشّح لك الأرض الأنسب من محفظة سرج، ويعطي القيادة رؤية أوضح للطلب والفرص.",
    en: "Warehouse, residential compound, or showroom — tell Sanad your goal, and it recommends the best-fit land from Sarj's portfolio, while giving leadership a clearer view of demand and opportunity.",
  },
  heroStatLandsLabel: {
    ar: "أرضًا",
    en: "lands",
  },
  heroStatDistrictsLabel: {
    ar: "حيًا",
    en: "districts",
  },
  heroStatAvailableLabel: {
    ar: "فرصة متاحة الآن",
    en: "available now",
  },
  heroPrimaryCta: {
    ar: "اكتشف فرصتك",
    en: "Explore opportunities",
  },

  // About page (src/app/about/page.tsx). Reuses heroEyebrow (identical
  // copy) and sanadNavLabel for its own "Talk to Sanad" button — kept
  // out of this block on purpose, so there's one string for each rather
  // than a near-duplicate.
  aboutIntroHeading: {
    ar: "نحوّل محفظة الأراضي إلى قرارات استثمارية أذكى.",
    en: "We turn a land portfolio into smarter investment decisions.",
  },
  aboutIntroParagraph: {
    ar: "تساعد سرج المستثمرين على اكتشاف الأراضي المناسبة لأهدافهم وميزانياتهم، وتمنح فرق العقارات رؤية أوضح لما يريده المستثمرون وما يحدث داخل محفظتهم.",
    en: "Sarj helps investors discover the right land for their goals and budget, and gives real-estate teams a clearer view of what investors want and what's happening inside their portfolio.",
  },
  aboutProblemHeading: {
    ar: "عندكم أراضٍ كثيرة. لكن العثور على الأرض المناسبة لا ينبغي أن يكون مهمة المستثمر.",
    en: "You have many lands. But finding the right one shouldn't be the investor's job.",
  },
  aboutProblemParagraph: {
    ar: "١٢٠ قطعة موزعة على ٨٨ حيًا تعني خيارات كثيرة. لكن كثرة الخيارات لا تساعد إذا لم يعرف المستثمر من أين يبدأ وما الذي يناسب هدفه.",
    en: "120 parcels spread across 88 districts means plenty of choice. But choice alone doesn't help if an investor doesn't know where to start or what actually fits their goal.",
  },
  aboutCapSanadTitle: {
    ar: "سَنَد يرشّح لك الأرض",
    en: "Sanad recommends your land",
  },
  aboutCapSanadDesc: {
    ar: "يفهم هدفك وميزانيتك ويرشّح الأنسب.",
    en: "Understands your goal and budget, and recommends the best fit.",
  },
  aboutCapMapTitle: {
    ar: "اكتشف الرياض بالخريطة",
    en: "Explore Riyadh on the map",
  },
  aboutCapMapDesc: {
    ar: "شاهد الفرص من المنطقة إلى الحي إلى الأرض.",
    en: "See opportunities from the area, down to the district, down to the parcel.",
  },
  aboutCapDataTitle: {
    ar: "كل أرض لها قصة في بياناتها",
    en: "Every land tells its story in data",
  },
  aboutCapDataDesc: {
    ar: "السعر والمساحة والموقع ومدة العرض في مكان واحد.",
    en: "Price, area, location, and time on market, all in one place.",
  },
  aboutCapLeadershipTitle: {
    ar: "رؤية أوضح للقيادة",
    en: "Clearer view for leadership",
  },
  aboutCapLeadershipDesc: {
    ar: "يربط ١٢٠ أرضًا بـ٤٨ طلبًا ليكشف الطلب والفرص.",
    en: "Connects 120 lands to 48 requests to surface demand and opportunity.",
  },
  aboutClosingLine: {
    ar: "جاهز تكتشف الأرض المناسبة لهدفك؟",
    en: "Ready to find the land that fits your goal?",
  },
  aboutBrowseLandsCta: {
    ar: "اكتشف الأراضي",
    en: "Browse lands",
  },

  // Browse page — filter bar
  filtersLabel: {
    ar: "تصفية النتائج",
    en: "Refine results",
  },
  allOption: {
    ar: "الكل",
    en: "All",
  },
  fieldAreaOfCity: {
    ar: "المنطقة",
    en: "Area",
  },
  fieldLandType: {
    ar: "نوع الأرض",
    en: "Land type",
  },
  fieldListingType: {
    ar: "نوع العرض",
    en: "Listing type",
  },
  fieldStatus: {
    ar: "الحالة",
    en: "Status",
  },
  fieldSaleBudget: {
    ar: "الحد الأقصى للسعر",
    en: "Max price",
  },
  fieldLeaseBudget: {
    ar: "الحد الأقصى للإيجار السنوي",
    en: "Max annual rent",
  },
  fieldMinArea: {
    ar: "أقل مساحة (م²)",
    en: "Min area (sqm)",
  },
  fieldMaxArea: {
    ar: "أقصى مساحة (م²)",
    en: "Max area (sqm)",
  },
  noMax: {
    ar: "بدون حد أقصى",
    en: "No max",
  },
  rangeHint: {
    ar: "{min} – {max} ريال",
    en: "{min} – {max} SAR",
  },
  resetFilters: {
    ar: "إعادة تعيين الفلاتر",
    en: "Reset filters",
  },
  resultCount: {
    ar: "{count} نتيجة",
    en: "{count} results",
  },
  noResults: {
    ar: "لا توجد قطع أرض مطابقة",
    en: "No matching parcels",
  },
  noResultsHint: {
    ar: "جرّب توسيع نطاق البحث أو إعادة تعيين الفلاتر.",
    en: "Try widening your search or resetting the filters.",
  },

  // Browse page — parcel card
  priceOnRequest: {
    ar: "السعر عند الطلب",
    en: "Price on request",
  },
  sar: {
    ar: "ريال",
    en: "SAR",
  },
  perYearSuffix: {
    ar: "سنويًا",
    en: "/year",
  },
  perSqmValue: {
    ar: "{value} ريال/م²",
    en: "{value} SAR/m²",
  },
  areaValue: {
    ar: "المساحة: {value} م²",
    en: "Area: {value} sqm",
  },
  streetWidthValue: {
    ar: "عرض الشارع: {value} م",
    en: "Street width: {value} m",
  },
  neighbourhoodLine: {
    ar: "{landType} · {area} · شارع {width}م",
    en: "{landType} · {area} · {width}m street",
  },
  viewOnMap: {
    ar: "الموقع على الخريطة",
    en: "View on map",
  },

  // Browse page — list/map toggle and the map's side panel
  viewList: {
    ar: "قائمة",
    en: "List",
  },
  viewMap: {
    ar: "خريطة",
    en: "Map",
  },
  closePanel: {
    ar: "إغلاق",
    en: "Close",
  },
  viewDetails: {
    ar: "التفاصيل",
    en: "View details",
  },
  mapEmptyState: {
    ar: "لا توجد نتائج لعرضها على الخريطة",
    en: "No results to show on the map",
  },
  mapLoading: {
    ar: "جاري تحميل الخريطة…",
    en: "Loading map…",
  },
  legendTypeHeading: {
    ar: "النوع",
    en: "Type",
  },
  legendButtonLabel: {
    ar: "مفتاح الخريطة",
    en: "Legend",
  },
  illustrativeLabel: {
    ar: "صورة تمثيلية",
    en: "Illustrative",
  },

  // Land detail page
  detailsSectionLabel: {
    ar: "التفاصيل",
    en: "Details",
  },
  priceSectionLabel: {
    ar: "السعر",
    en: "Price",
  },
  landTypeValue: {
    ar: "نوع الأرض: {value}",
    en: "Land type: {value}",
  },
  listingTypeValue: {
    ar: "نوع العرض: {value}",
    en: "Listing type: {value}",
  },
  daysOnMarketValue: {
    ar: "أيام على السوق: {value}",
    en: "Days on market: {value}",
  },
  listedDateValue: {
    ar: "تاريخ الإدراج: {value}",
    en: "Listed: {value}",
  },
  statusValue: {
    ar: "الحالة: {value}",
    en: "Status: {value}",
  },
  parcelNotFoundTitle: {
    ar: "لم يتم العثور على هذه الأرض",
    en: "This land couldn't be found",
  },
  parcelNotFoundHint: {
    ar: "ربما تم نقل الرابط أو حذفه. جرّب العودة لقائمة الأراضي.",
    en: "The link may have moved or been removed. Try heading back to the listings.",
  },
  backToBrowse: {
    ar: "العودة إلى الأراضي",
    en: "Back to listings",
  },

  // Sanad's "Talk to Sanad" copy — the footer's CTA button, and the
  // accessible label on the floating launcher (see SanadLaunchButton in
  // SanadPanel.tsx), which shows only the logo mark, not this text, so
  // screen readers still need it named somewhere.
  sanadNavLabel: {
    ar: "تواصل مع سَنَد",
    en: "Talk to Sanad",
  },
  requestThisLand: {
    ar: "اطلب هذه الأرض",
    en: "Request this land",
  },
  askSanadAboutLand: {
    ar: "اسأل سَنَد عن هذه الأرض",
    en: "Ask Sanad about this land",
  },

  // Sanad chat panel
  sanadSubtitle: {
    ar: "مساعدك الذكي للاستثمار العقاري",
    en: "Your AI real-estate investment assistant",
  },
  sanadGreetingGeneral: {
    ar: "أهلاً بك، أنا سَنَد، مساعدك الذكي للاستثمار العقاري في سرج. كيف يمكنني مساعدتك في أراضي الرياض اليوم؟",
    en: "Hi, I'm Sanad, Sarj's AI real-estate investment assistant. How can I help you with Riyadh land today?",
  },
  sanadGreetingRequest: {
    ar: "أهلاً بك، أنا سَنَد. لتسجيل طلبك لأرض {district} ({parcelId})، عبّئ بياناتك أدناه وسأنسّق مع فريق سرج للمتابعة.",
    en: "Hi, I'm Sanad. To register your request for the {district} parcel ({parcelId}), fill in your details below and I'll pass it to the Sarj team.",
  },
  sanadGreetingInquiry: {
    ar: "أهلاً بك، أنا سَنَد. أنت تسأل عن أرض {district} ({parcelId}) — تفضّل بسؤالك وسأجيبك من بيانات المحفظة.",
    en: "Hi, I'm Sanad. You're asking about the {district} parcel ({parcelId}) — go ahead and ask me anything about it.",
  },
  sanadInputPlaceholder: {
    ar: "اكتب رسالتك...",
    en: "Type your message...",
  },
  sanadSend: {
    ar: "إرسال",
    en: "Send",
  },
  sanadTyping: {
    ar: "سَنَد يكتب…",
    en: "Sanad is typing…",
  },
  sanadErrorRetry: {
    ar: "حدث خطأ في الاتصال. حاول مرة أخرى.",
    en: "Something went wrong. Please try again.",
  },
  // Shown when the API's per-IP rate limit rejects a turn (HTTP 429, see
  // src/app/api/sanad/route.ts). Distinct from the generic error above so
  // the reader knows to simply wait rather than assume Sanad is broken.
  sanadErrorRateLimited: {
    ar: "طلبات كثيرة في وقت قصير. يرجى المحاولة بعد قليل.",
    en: "Too many requests. Please try again shortly.",
  },
  // Shown when a single message exceeds the API's length cap.
  sanadErrorMessageTooLong: {
    ar: "الرسالة طويلة جدًا. يرجى اختصارها وإعادة الإرسال.",
    en: "That message is too long. Please shorten it and send again.",
  },
  sanadRetryButton: {
    ar: "إعادة المحاولة",
    en: "Retry",
  },
  sanadMinimize: {
    ar: "تصغير",
    en: "Minimize",
  },
  sanadExpand: {
    ar: "توسيع",
    en: "Expand",
  },
  sanadIdentityName: {
    ar: "سَنَد",
    en: "Sanad",
  },

  // Sanad — ADMIN MODE: same assistant, business-analyst persona for
  // Sarj leadership (see src/lib/sanadAdminPrompt.ts, SanadMode in
  // src/lib/sanad.ts). Investor-mode Sanad's own keys above are
  // untouched — these are separate strings shown only when
  // launchState.mode==="admin".
  sanadIdentityNameAdmin: {
    ar: "سَنَد · محلل الأعمال",
    en: "Sanad · Business Analyst",
  },
  // Just the role half of sanadIdentityNameAdmin above — split out so the
  // panel header and floating pill (see SanadPanel.tsx) can show the
  // Sanad logo mark in place of the "سَنَد" word itself and still append
  // the business-analyst role after it, rather than duplicating "Sanad"
  // in both the logo and the text beside it.
  sanadRoleSuffixAdmin: {
    ar: "محلل الأعمال",
    en: "Business Analyst",
  },
  sanadSubtitleAdmin: {
    ar: "تحليلات وتوصيات مبنية على بيانات المحفظة",
    en: "Data-backed portfolio analysis for leadership",
  },
  sanadGreetingAdmin: {
    ar: "أهلاً، أنا سَنَد بصفتي محلل الأعمال لفريق سرج. اسألني عن أداء المحفظة، أكبر الفرص الضائعة، أو الأراضي التي تحتاج مراجعة سعر — وسأجيبك بالأرقام دائمًا.",
    en: "Hi, I'm Sanad, wearing my business-analyst hat for Sarj leadership. Ask me about portfolio health, missed opportunities, or pricing — I'll always back it up with the numbers.",
  },
  sanadInputPlaceholderAdmin: {
    ar: "اسأل عن المحفظة، الطلب، أو التسعير...",
    en: "Ask about the portfolio, demand, or pricing...",
  },
  adminPromptPortfolioHealth: {
    ar: "وش وضع محفظتنا؟",
    en: "How's our portfolio doing?",
  },
  adminPromptBiggestGap: {
    ar: "وين أكبر فرصة ضائعة؟",
    en: "Where's our biggest missed opportunity?",
  },
  adminPromptReprice: {
    ar: "أي أراضي أنصح أراجع سعرها؟",
    en: "Which parcels should I reprice?",
  },
  adminPromptUnmetDemand: {
    ar: "وش يطلبه المستثمرون وما عندنا؟",
    en: "What are investors asking for that we don't have?",
  },

  // Sanad — Part B: the in-chat contact form, its confirmation, and the
  // WhatsApp handoff. See src/components/SanadContactForm.tsx.
  sanadFormNameLabel: {
    ar: "الاسم",
    en: "Name",
  },
  sanadFormNamePlaceholder: {
    ar: "اسمك الكامل",
    en: "Your full name",
  },
  sanadFormNameError: {
    ar: "الرجاء إدخال الاسم",
    en: "Please enter your name",
  },
  sanadFormPhoneLabel: {
    ar: "رقم الجوال",
    en: "Mobile number",
  },
  sanadFormPhonePlaceholder: {
    ar: "05XXXXXXXX",
    en: "05XXXXXXXX",
  },
  sanadFormPhoneError: {
    ar: "رقم جوال سعودي غير صحيح (مثال: 0512345678)",
    en: "Enter a valid Saudi mobile number (e.g. 0512345678)",
  },
  sanadFormMessageLabel: {
    ar: "رسالة (اختياري)",
    en: "Message (optional)",
  },
  sanadFormMessagePlaceholder: {
    ar: "أي تفاصيل إضافية تودّ مشاركتها...",
    en: "Any extra details you'd like to share...",
  },
  sanadFormSubmit: {
    ar: "إرسال الطلب",
    en: "Submit request",
  },
  sanadFormSubmitting: {
    ar: "جارٍ الإرسال...",
    en: "Submitting...",
  },
  sanadFormSaveError: {
    ar: "تعذّر حفظ طلبك، حاول مرة أخرى.",
    en: "Couldn't save your request — please try again.",
  },
  sanadFormSummaryInterest: {
    ar: "سنسجل اهتمامك بأرض {district} ({parcelId}).",
    en: "We'll register your interest in the {district} parcel ({parcelId}).",
  },
  sanadFormSummaryUnmet: {
    ar: "سنسجل طلبك حتى نتمكن من إشعارك عند توفر ما يناسبك.",
    en: "We'll log your request so we can notify you when something matching comes up.",
  },
  sanadConfirmationTitle: {
    ar: "تم تسجيل طلبك ✅",
    en: "Your request has been logged ✅",
  },
  sanadConfirmationId: {
    ar: "رقم الطلب: {id}",
    en: "Request number: {id}",
  },
  sanadWhatsappOffer: {
    ar: "تحب تكمل مع فريق سرج على واتساب؟",
    en: "Want to continue with the Sarj team on WhatsApp?",
  },
  sanadWhatsappButton: {
    ar: "متابعة على واتساب",
    en: "Continue on WhatsApp",
  },
  sanadManualRegisterInterest: {
    ar: "تسجيل اهتمامي بهذه الأرض",
    en: "Register my interest in this land",
  },
  sanadManualLogRequest: {
    ar: "تسجيل طلب جديد",
    en: "Log a new request",
  },

  // Admin dashboard
  adminTitle: {
    ar: "لوحة القيادة",
    en: "Leadership Dashboard",
  },
  adminSubtitle: {
    ar: "نظرة شاملة وحيّة على أداء المحفظة والطلب الاستثماري.",
    en: "A live, end-to-end view of portfolio performance and investor demand.",
  },

  // Tab navigation
  tabOverview: {
    ar: "نظرة عامة",
    en: "Overview",
  },
  tabRequests: {
    ar: "الطلبات",
    en: "Requests",
  },
  tabIdleInventory: {
    ar: "المخزون الراكد",
    en: "Idle Inventory",
  },
  tabPipeline: {
    ar: "حالة الطلبات",
    en: "Deal Pipeline",
  },
  overviewKpiEyebrow: {
    ar: "المحفظة",
    en: "Portfolio",
  },
  overviewDemandEyebrow: {
    ar: "الطلب",
    en: "Demand",
  },
  kpiTotalParcels: {
    ar: "إجمالي قطع الأرض",
    en: "Total parcels",
  },
  kpiAvailable: {
    ar: "متاحة",
    en: "Available",
  },
  kpiReserved: {
    ar: "محجوزة",
    en: "Reserved",
  },
  kpiSold: {
    ar: "مباعة",
    en: "Sold",
  },
  kpiLeased: {
    ar: "مؤجرة",
    en: "Leased",
  },
  kpiSaleValue: {
    ar: "قيمة المحفظة المتاحة (بيع)",
    en: "Available portfolio value (sale)",
  },
  kpiSaleValueCaption: {
    ar: "باستثناء أرض السعر عند الطلب (SRE-013)",
    en: "Excludes the price-on-request parcel (SRE-013)",
  },
  kpiLeaseValue: {
    ar: "الإيجار السنوي المتاح",
    en: "Available annual rent",
  },
  kpiDistricts: {
    ar: "عدد الأحياء",
    en: "Districts",
  },
  kpiDistrictsCaption: {
    ar: "عبر المحفظة الكاملة",
    en: "Across the full portfolio",
  },

  // Demand vs. supply section
  demandSectionTitle: {
    ar: "الطلب مقابل المعروض",
    en: "Demand vs. supply",
  },
  demandSectionSubtitle: {
    ar: "من بين {total} استفسارًا من المستثمرين، هذا ما يمكن للمخزون الحالي تلبيته.",
    en: "Of {total} investor inquiries, this is what today's inventory can actually serve.",
  },
  servableLabel: {
    ar: "قابلة للتلبية",
    en: "Servable",
  },
  unmetNoInventoryLabel: {
    ar: "لا يوجد مخزون",
    en: "No inventory",
  },
  unmetOverBudgetLabel: {
    ar: "فوق الميزانية",
    en: "Over budget",
  },
  // "Money on the gap" — the demand-vs-supply counts restated as the SAR
  // they represent. Sale and lease deliberately get SEPARATE strings, each
  // carrying its own unit, so no piece of UI copy can present a one-off
  // purchase budget and a recurring annual rent as one combined figure
  // (the same rule PortfolioStats follows in src/lib/analytics.ts).
  demandMoneyEyebrow: {
    ar: "قيمة الطلب غير الملبّى",
    en: "Value of unserved demand",
  },
  demandMoneySale: {
    ar: "{value} مليون ريال طلب شراء لا يمكن تلبيته اليوم",
    en: "{value}M SAR of purchase demand you can't serve today",
  },
  // The leading "+" is intentional: it reads as "and, separately," not as
  // an addition to the sale figure above.
  demandMoneyLease: {
    ar: "+ {value} مليون ريال/سنة طلب إيجار",
    en: "+ {value}M SAR/year of lease demand",
  },
  // The boardroom line: the hottest intent in the pipeline, unserved.
  demandReadyToMove: {
    ar: "{unserved} من {total} مستثمرًا جاهزون للشراء الآن — ولا يوجد لهم مخزون مناسب",
    en: "{unserved} of {total} ready-to-move investors have nothing to buy from you",
  },
  // Per-gap money, appended to the top-gap highlight's pills. Two keys for
  // the same reason as the two totals above.
  topGapDemandValueSale: {
    ar: "{value} مليون ريال طلب",
    en: "{value}M SAR demand",
  },
  topGapDemandValueLease: {
    ar: "{value} مليون ريال/سنة طلب",
    en: "{value}M SAR/year demand",
  },
  // Investor-facing price context on a parcel's detail page. The wording
  // is deliberately explicit that the benchmark is SARJ'S OWN PORTFOLIO —
  // the app has no external market data, and implying otherwise would be
  // a claim it can't support. The sample size is shown for the same
  // reason: the reader can see how much the comparison is worth.
  priceVsAverageBelow: {
    ar: "أقل من متوسط المنطقة بـ {percent}%",
    en: "{percent}% below the area average",
  },
  priceVsAverageAbove: {
    ar: "أعلى من متوسط المنطقة بـ {percent}%",
    en: "{percent}% above the area average",
  },
  // Exactly at the average once rounded — saying "0% below" would be odd.
  priceVsAverageLevel: {
    ar: "في مستوى متوسط المنطقة",
    en: "In line with the area average",
  },
  // Arabic counts its nouns differently by size, and getting it wrong is
  // immediately visible to a native reader: 3-10 takes the PLURAL ("4 قطع"),
  // 11 and up the singular ("26 قطعة"). Two real sentences rather than a
  // general pluralization engine, matching the "...Singular" convention
  // the top-gap counts already use above. English needs no such split —
  // the sample is never below 4, so "parcels" is always right.
  priceVsAverageBasisFew: {
    ar: "مقارنةً بمتوسط {landType} · {area} في محفظة سرج ({count} قطع مماثلة)",
    en: "vs. Sarj's own average for {landType} · {area} ({count} comparable parcels)",
  },
  priceVsAverageBasisMany: {
    ar: "مقارنةً بمتوسط {landType} · {area} في محفظة سرج ({count} قطعة مماثلة)",
    en: "vs. Sarj's own average for {landType} · {area} ({count} comparable parcels)",
  },
  // The explorable demand gap: clicking a segment reveals the real
  // investors behind it, turning a count into a call list.
  gapViewInvestors: {
    ar: "عرض المستثمرين",
    en: "View investors",
  },
  gapHideInvestors: {
    ar: "إخفاء المستثمرين",
    en: "Hide investors",
  },
  // The opportunity framing at the top of an opened gap — the count and
  // the money already appear as chips, so this line adds the readiness
  // that makes it a sales pitch rather than a complaint.
  gapReadyToBuyNow: {
    ar: "{count} جاهز للشراء الآن",
    en: "{count} ready to buy now",
  },
  gapInvestorListTitle: {
    ar: "المستثمرون في هذه الفجوة",
    en: "Investors in this gap",
  },
  // Each investor card's fields. Budget carries its own basis label so a
  // one-off purchase total is never mistaken for a yearly rent.
  gapInvestorWants: {
    ar: "الغرض",
    en: "Purpose",
  },
  gapInvestorBudgetTotal: {
    ar: "{value} ريال (إجمالي الشراء)",
    en: "{value} SAR (total purchase)",
  },
  gapInvestorBudgetAnnual: {
    ar: "{value} ريال/سنة (إيجار سنوي)",
    en: "{value} SAR/year (annual rent)",
  },
  gapInvestorWhatsApp: {
    ar: "مراسلة عبر واتساب",
    en: "Message on WhatsApp",
  },
  topGapEyebrow: {
    ar: "أكبر فجوة في الطلب",
    en: "Biggest demand gap",
  },
  // Each has a companion "...Singular" key for the count===1 case — "1
  // investors want..." (and its Arabic equivalent) is wrong in both
  // languages, and with only two shapes to cover (one investor vs. many)
  // a second real sentence is simpler and more correct than a general
  // pluralization system for what is, in this dataset, a single edge case.
  topGapInvestorCount: {
    ar: "{count} مستثمرين",
    en: "{count} investors",
  },
  topGapInvestorCountSingular: {
    ar: "مستثمر واحد",
    en: "1 investor",
  },
  topGapAvailableCount: {
    ar: "{count} متاح",
    en: "{count} available",
  },
  unmetTakeawayNoInventory: {
    ar: "{count} مستثمرين يطلبون {landType} {area} ولا يوجد مخزون متاح.",
    en: "{count} investors want {landType} land in {area}, and none is available.",
  },
  unmetTakeawayNoInventorySingular: {
    ar: "مستثمر واحد يطلب {landType} {area} ولا يوجد مخزون متاح.",
    en: "1 investor wants {landType} land in {area}, and none is available.",
  },
  unmetTakeawayOverBudget: {
    ar: "{count} مستثمرين يطلبون {landType} {area}، لكن المخزون المتاح لا يغطي ميزانياتهم.",
    en: "{count} investors want {landType} land in {area}, but the available inventory doesn't cover their budgets.",
  },
  unmetTakeawayOverBudgetSingular: {
    ar: "مستثمر واحد يطلب {landType} {area}، لكن المخزون المتاح لا يغطي ميزانيته.",
    en: "1 investor wants {landType} land in {area}, but the available inventory doesn't cover their budget.",
  },

  // Idle inventory section
  idleSectionTitle: {
    ar: "المخزون الراكد",
    en: "Idle inventory",
  },
  idleSectionCount: {
    ar: "{count} أرضًا متاحة لا تطابق أي طلب استثماري ضمن ميزانيته حاليًا",
    en: "{count} available parcels match no current investor request within budget",
  },
  idleSectionTakeaway: {
    ar: "قد تحتاج هذه القطع لمراجعة السعر أو حملة تسويقية.",
    en: "These parcels may need a price review or a marketing push.",
  },
  tableColParcelId: {
    ar: "رقم القطعة",
    en: "Parcel",
  },
  tableColDistrict: {
    ar: "الحي",
    en: "District",
  },
  tableColType: {
    ar: "النوع",
    en: "Type",
  },
  tableColPrice: {
    ar: "السعر",
    en: "Price",
  },
  tableColDays: {
    ar: "أيام على السوق",
    en: "Days on market",
  },

  // Pipeline + live Sanad feed section
  pipelineSectionTitle: {
    ar: "مسار الطلبات",
    en: "Inquiry pipeline",
  },
  pipelineSectionSubtitle: {
    ar: "الاستفسارات الاستثمارية الـ48 الأساسية، حسب الحالة والجدية.",
    en: "The 48 baseline investor inquiries, by status and intent.",
  },
  pipelineByStatus: {
    ar: "حسب الحالة",
    en: "By status",
  },
  pipelineByIntent: {
    ar: "حسب الجدية",
    en: "By intent",
  },
  sanadFeedTitle: {
    ar: "طلبات سَنَد المباشرة",
    en: "Live Sanad requests",
  },
  sanadFeedSubtitle: {
    ar: "كل استفسار أو طلب سجّله المستثمرون عبر سَنَد، لحظة بلحظة.",
    en: "Every inquiry or request investors have logged through Sanad, live.",
  },
  sanadFeedEmpty: {
    ar: "لا توجد طلبات مسجلة بعد عبر سَنَد.",
    en: "No requests captured by Sanad yet.",
  },
  sanadFeedEmptyHint: {
    ar: "ستظهر هنا فور تسجيل أي مستثمر لاهتمامه أو طلبه.",
    en: "They'll appear here as soon as an investor registers interest or a request.",
  },
  recordTypeInterest: {
    ar: "اهتمام",
    en: "Interest",
  },
  recordTypeUnmetLead: {
    ar: "طلب غير ملبى",
    en: "Unmet lead",
  },
  sanadFeedRequestedParcel: {
    ar: "الأرض المطلوبة: {id} (غير متاحة)",
    en: "Requested parcel: {id} (unavailable)",
  },
  sanadFeedMessage: {
    ar: "الرسالة: {text}",
    en: "Message: {text}",
  },
  sanadFeedNoDetails: {
    ar: "لم تُحدَّد تفاصيل إضافية.",
    en: "No further details given.",
  },
} as const satisfies Record<string, Record<Language, string>>;

export type TranslationKey = keyof typeof dictionary;

// Domain-value label maps: unlike `dictionary` (free-form UI copy keyed by
// name), these are keyed by the actual literal values stored on a Parcel,
// so a filter option or a card tag can look up its label directly.
export const areaOfCityLabels: Record<AreaOfCity, Record<Language, string>> =
  {
    Central: { ar: "الوسط", en: "Central" },
    East: { ar: "الشرق", en: "East" },
    North: { ar: "الشمال", en: "North" },
    South: { ar: "الجنوب", en: "South" },
    West: { ar: "الغرب", en: "West" },
  };

// "East Riyadh" / "شرق الرياض" — construct-state area names for composed
// phrases like the browse card's neighbourhood-character line. Distinct
// from areaOfCityLabels: Modern Standard Arabic idafa constructions drop
// the definite article ("شرق" not "الشرق") that the standalone filter
// label correctly keeps.
export const areaOfCityCompoundLabels: Record<
  AreaOfCity,
  Record<Language, string>
> = {
  Central: { ar: "وسط الرياض", en: "Central Riyadh" },
  East: { ar: "شرق الرياض", en: "East Riyadh" },
  North: { ar: "شمال الرياض", en: "North Riyadh" },
  South: { ar: "جنوب الرياض", en: "South Riyadh" },
  West: { ar: "غرب الرياض", en: "West Riyadh" },
};

export const landTypeLabels: Record<LandType, Record<Language, string>> = {
  commercial: { ar: "تجاري", en: "Commercial" },
  residential: { ar: "سكني", en: "Residential" },
};

export const listingTypeLabels: Record<ListingType, Record<Language, string>> =
  {
    sale: { ar: "بيع", en: "Sale" },
    lease: { ar: "إيجار", en: "Lease" },
  };

export const statusLabels: Record<ParcelStatus, Record<Language, string>> = {
  available: { ar: "متاح", en: "Available" },
  reserved: { ar: "محجوز", en: "Reserved" },
  sold: { ar: "مباع", en: "Sold" },
  leased: { ar: "مؤجر", en: "Leased" },
};

// An inquiry's own status/intent — distinct from a parcel's ParcelStatus
// above (different type, different values) — used by the admin
// dashboard's pipeline breakdown.
export const inquiryStatusLabels: Record<InquiryStatus, Record<Language, string>> = {
  new: { ar: "جديد", en: "New" },
  contacted: { ar: "تم التواصل", en: "Contacted" },
  negotiating: { ar: "قيد التفاوض", en: "Negotiating" },
};

export const intentLabels: Record<Intent, Record<Language, string>> = {
  "ready to move": { ar: "جاهز للشراء", en: "Ready to move" },
  "comparing options": { ar: "يقارن الخيارات", en: "Comparing options" },
  exploring: { ar: "يستكشف", en: "Exploring" },
};

interface LanguageContextValue {
  language: Language;
  direction: Direction;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

// Wraps the app and holds the current language in state. Mount this once,
// high in src/app/layout.tsx, so every descendant can read/change it via
// useLanguage(). Must be a Client Component: React context and state don't
// work in Server Components.
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(DEFAULT_LANGUAGE);

  // Keep <html lang/dir> in sync so the whole document — including
  // scrollbars, form controls, and browser UI — mirrors correctly in RTL.
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  }, [language]);

  const toggleLanguage = useCallback(() => {
    setLanguage((current) => (current === "ar" ? "en" : "ar"));
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      direction: language === "ar" ? "rtl" : "ltr",
      setLanguage,
      toggleLanguage,
      t: (key) => translate(language, key),
    }),
    [language, toggleLanguage]
  );

  // createElement instead of JSX: this file is .ts (not .tsx) per the
  // dictionary-file-plus-provider convention requested for src/lib/i18n.ts.
  return createElement(LanguageContext.Provider, { value }, children);
}

// Read the current language, direction, and translator inside any Client
// Component beneath a LanguageProvider.
export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}

// Look up one dictionary entry for a given language. Exported standalone
// (in addition to the context's `t`) for the rare case of translating
// outside a component, e.g. in metadata generation.
export function translate(language: Language, key: TranslationKey): string {
  return dictionary[key][language];
}
