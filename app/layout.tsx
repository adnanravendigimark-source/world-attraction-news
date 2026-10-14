import type { Metadata } from "next";
import { Newsreader, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SITE_NAME, SITE_URL, SITE_DESCRIPTION } from "@/lib/site";
import { organizationJsonLd, jsonLdScript } from "@/lib/seo";
import Providers from "@/components/Providers";

// A manually-added <head> JSX element here previously caused a "Text content
// does not match server-rendered HTML" hydration error on <title> — don't
// reintroduce one; let Next's own metadata export generate <head>.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/images/logo-emblem.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/images/logo-emblem.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

// Fonts are downloaded at build time and served from this site, so the page
// does not wait on Google Fonts and text does not jump when they arrive
// (next/font sizes the fallback font to match). Previously a CSS @import.
const serif = Newsreader({
  subsets: ["latin", "latin-ext"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-serif",
  display: "swap",
  // Next has no size metrics for Newsreader, so it cannot size a fallback
  // to match; Georgia is close.
  adjustFontFallback: false,
  fallback: ["Georgia", "Cambria", "Times New Roman", "serif"],
});
const sans = Plus_Jakarta_Sans({ subsets: ["latin", "latin-ext"], variable: "--font-sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(organizationJsonLd()) }}
        />
      </body>
    </html>
  );
}
