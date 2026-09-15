import { NextResponse } from "next/server";
import { getEnabledSitemapByType, getCitySitemapUrls, buildUrlsetXml } from "@/lib/sitemaps";

// Strictly CITY-type URLs only — see getCitySitemapUrls() in
// lib/sitemaps.ts, which queries only the `cities` table and excludes any
// city with a noindex override (indexing_settings key `city:<id>`). 404s if
// this sitemap has been disabled/deleted from Admin -> SEO -> Sitemaps.
export const dynamic = "force-dynamic";

export async function GET() {
  const config = await getEnabledSitemapByType("CITY");
  if (!config) {
    return new NextResponse("Not found", { status: 404 });
  }
  const urls = await getCitySitemapUrls();
  const xml = buildUrlsetXml(urls);
  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=UTF-8",
      "Cache-Control": "no-store, must-revalidate",
    },
  });
}
