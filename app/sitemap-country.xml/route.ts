import { NextResponse } from "next/server";
import { getEnabledSitemapByType, getCountrySitemapUrls, buildUrlsetXml } from "@/lib/sitemaps";

// Strictly COUNTRY-type URLs only — see getCountrySitemapUrls() in
// lib/sitemaps.ts, which queries only the `countries` table. 404s if this
// sitemap has been disabled/deleted from Admin -> SEO -> Sitemaps.
export const dynamic = "force-dynamic";

export async function GET() {
  const config = await getEnabledSitemapByType("COUNTRY");
  if (!config) {
    return new NextResponse("Not found", { status: 404 });
  }
  const urls = await getCountrySitemapUrls();
  const xml = buildUrlsetXml(urls);
  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=UTF-8",
      "Cache-Control": "no-store, must-revalidate",
    },
  });
}
