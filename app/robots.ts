import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// References only the master sitemap index (app/sitemap.xml/route.ts) —
// never every child sitemap individually. The master index itself lists
// every enabled child sitemap (see Admin -> SEO -> Sitemaps), so crawlers
// discover the rest by following it, one hop, exactly as the sitemap-index
// protocol intends.
//
// The Google News sitemap (app/news-sitemap.xml/route.ts) is a separate,
// purpose-built XML file in a different format (news:news extension tags,
// not a plain urlset) that isn't part of this Sitemap config system and
// isn't required in robots.txt — Google discovers/verifies News sitemaps
// via Search Console, not robots.txt. It's left out of this list
// deliberately; submit it in Search Console if that wasn't already done.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/dashboard", "/contributor", "/admin", "/api"] },
    ],
    sitemap: [`${SITE_URL}/sitemap.xml`],
  };
}
