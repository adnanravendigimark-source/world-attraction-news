import { NextResponse } from "next/server";
import { getEnabledSitemapByType, getNewsSitemapUrls, buildUrlsetXml } from "@/lib/sitemaps";

// Every published news article (/news/<slug>) — see getNewsSitemapUrls() in
// lib/sitemaps.ts. Separate from the Google News sitemap (/news-sitemap.xml),
// which uses the news: extension and only lists the last 2 days. 404s if this
// sitemap has been disabled/deleted from Admin -> SEO -> Sitemaps.
// Cached for an hour (also purged on publish) instead of a DB query per crawler hit.
export const revalidate = 3600;

export async function GET() {
  const config = await getEnabledSitemapByType("NEWS");
  if (!config) {
    return new NextResponse("Not found", { status: 404 });
  }
  const xml = buildUrlsetXml(await getNewsSitemapUrls());
  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=UTF-8",
      "Cache-Control": "no-store, must-revalidate",
    },
  });
}
