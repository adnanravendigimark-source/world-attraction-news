import { NextResponse } from "next/server";
import { getEnabledSitemapByType, getArticleSitemapUrls, buildUrlsetXml } from "@/lib/sitemaps";

// Strictly ARTICLE-type URLs only — see getArticleSitemapUrls() in
// lib/sitemaps.ts, which requires status = 'published' (enforced inside
// getPublishedArticles()), a non-empty slug, and excludes any article with
// a noindex override (indexing_settings key `article:<id>`). 404s if this
// sitemap has been disabled/deleted from Admin -> SEO -> Sitemaps.
export const dynamic = "force-dynamic";

export async function GET() {
  const config = await getEnabledSitemapByType("ARTICLE");
  if (!config) {
    return new NextResponse("Not found", { status: 404 });
  }
  const urls = await getArticleSitemapUrls();
  const xml = buildUrlsetXml(urls);
  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=UTF-8",
      "Cache-Control": "no-store, must-revalidate",
    },
  });
}
