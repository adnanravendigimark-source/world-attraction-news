import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { SITE_NAME, SITE_URL, SITE_DESCRIPTION } from "@/lib/site";
import { organizationJsonLd, jsonLdScript } from "@/lib/seo";
import { getSettings } from "@/lib/settings";
import Providers from "@/components/Providers";

// Async because the Search Console verification code is admin-configured
// (fetched from the database) rather than hardcoded — using Next's own
// `verification.google` metadata field (instead of a hand-written <head>
// element in the layout below) keeps <head> fully under Next's control, so
// the title/meta tags it generates stay consistent between server and
// client render. A manually-added <head> JSX element here previously caused
// a "Text content does not match server-rendered HTML" hydration error on
// <title> — don't reintroduce one.
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return {
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
    verification: settings.gscVerificationCode ? { google: settings.gscVerificationCode } : undefined,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Real, admin-configured values only — Google Analytics is inert until an
  // admin sets a Measurement ID at /admin/seo. No hardcoded or placeholder
  // IDs are ever shipped.
  const settings = await getSettings();

  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(organizationJsonLd()) }}
        />
        {settings.gaMeasurementId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${settings.gaMeasurementId}`}
              strategy="afterInteractive"
            />
            <Script id="ga-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${settings.gaMeasurementId}');
              `}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}
