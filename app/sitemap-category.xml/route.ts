import { NextResponse } from "next/server";
import { getEnabledSitemapByType, getCategorySitemapUrls, buildUrlsetXml } from "@/lib/sitemaps";

// Strictly CATEGORY-type URLs only — see getCategorySitemapUrls() in
// lib/sitemaps.ts, which queries only the `categories` table and excludes
// any category with a noindex override (indexing_settings key
// `category:<id>`). 404s if this sitemap has been disabled/deleted from
// Admin -> SEO -> Sitemaps.
export const dynamic = "force-dynamic";

export async function GET() {
  const config = await getEnabledSitemapByType("CATEGORY");
  if (!config) {
    return new NextResponse("Not found", { status: 404 });
  }
  const urls = await getCategorySitemapUrls();
  const xml = buildUrlsetXml(urls);
  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=UTF-8",
      "Cache-Control": "no-store, must-revalidate",
    },
  });
}
