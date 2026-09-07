import type { Metadata } from "next";
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
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
