import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { SITE_NAME, SITE_URL, SITE_DESCRIPTION } from "@/lib/site";
import { organizationJsonLd } from "@/lib/seo";
import { getSettings } from "@/lib/settings";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Real, admin-configured values only — Google Analytics and Search
  // Console verification are inert until an admin sets them at
  // /admin/seo. No hardcoded or placeholder IDs are ever shipped.
  const settings = await getSettings();

  return (
    <html lang="en">
      <head>
        {settings.gscVerificationCode && (
          <meta name="google-site-verification" content={settings.gscVerificationCode} />
        )}
      </head>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()) }}
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
