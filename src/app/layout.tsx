import type { Metadata } from "next";
import { Playfair_Display, Inter, IBM_Plex_Sans_Arabic } from "next/font/google";
import { LanguageProvider } from "@/lib/i18n";
import { SanadProvider } from "@/lib/sanad";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SanadPanel } from "@/components/SanadPanel";
import "./globals.css";

// Editorial high-contrast serif for Latin headings.
const playfairDisplay = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

// Clean sans for Latin body/UI copy.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// All Arabic text — headings and body alike — renders in this. It's not a
// variable font, so weights are loaded explicitly; 600/700 keep Arabic
// headings reading as intentional and bold, never a thin fallback.
const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-plex-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "سرج | sarj.ai",
  description: "Sarj Real Estate — premium land investment in Riyadh.",
};

// Sarj is Arabic-first: the document starts in Arabic with dir="rtl".
// LanguageProvider flips both attributes client-side when the reader
// switches to English — no reload, no server round-trip.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${playfairDisplay.variable} ${inter.variable} ${ibmPlexSansArabic.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <LanguageProvider>
          <SanadProvider>
            <Header />
            <main className="flex flex-1 flex-col">{children}</main>
            <Footer />
            <SanadPanel />
          </SanadProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
