import { NextResponse } from "next/server";
import { getEnabledSitemapByType, getStaticSitemapUrls, buildUrlsetXml } from "@/lib/sitemaps";

// Strictly STATIC-type URLs only (the site's fixed, code-defined pages —
// see STATIC_SITEMAP_PAGES in lib/sitemaps.ts). Never mixes in a country,
// city, category, or article URL. 404s if this sitemap has been disabled
// (or its config row deleted) from Admin -> SEO -> Sitemaps, so a disabled
// sitemap can never still be reachable at its old URL.
export const dynamic = "force-dynamic";

export async function GET() {
  const config = await getEnabledSitemapByType("STATIC");
  if (!config) {
    return new NextResponse("Not found", { status: 404 });
  }
  const urls = await getStaticSitemapUrls();
  const xml = buildUrlsetXml(urls);
  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=UTF-8",
      "Cache-Control": "no-store, must-revalidate",
    },
  });
}
