import { NextResponse } from "next/server";
import { getPublishedArticles } from "@/lib/articles";
import { articlePath } from "@/lib/destinations";
import { SITE_NAME, SITE_URL } from "@/lib/site";

// Google News sitemap — a separate, purpose-built XML file from the general
// /sitemap.xml (see app/sitemap.ts), using the news:news sitemap extension
// namespace Google News specifically looks for. Submit this URL on its own
// in Search Console (Sitemaps) in addition to the regular sitemap.
//
// Per Google's own guidance, a News sitemap should only list articles from
// roughly the last 2 days — Google ignores older entries here regardless
// (they're still fully covered by the general sitemap + NewsArticle JSON-LD
// on the article page itself), so there's no reason to list them and no
// reason to cap this list at 1,000 URLs the way a general sitemap must.
export const dynamic = "force-dynamic";

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  // Published-most-recent-first (see getPublishedArticles' own ORDER BY) —
  // 200 is comfortably more than any real 2-day window will produce, so the
  // recency filter below does the actual trimming.
  const articles = await getPublishedArticles({ limit: 200 });
  const cutoff = Date.now() - TWO_DAYS_MS;

  const recent = articles.filter((a) => {
    if (!a.publishedAt) return false;
    const publishedMs = new Date(a.publishedAt).getTime();
    return Number.isFinite(publishedMs) && publishedMs >= cutoff;
  });

  const urls = recent
    .map((a) => {
      const loc = `${SITE_URL}${articlePath(a.countrySlug, a.citySlug, a.slug)}`;
      const publicationDate = new Date(a.publishedAt as string).toISOString();
      return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <news:news>
      <news:publication>
        <news:name>${escapeXml(SITE_NAME)}</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${publicationDate}</news:publication_date>
      <news:title>${escapeXml(a.title)}</news:title>
    </news:news>
  </url>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls}
</urlset>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=UTF-8",
      // Belt-and-suspenders alongside force-dynamic — a stale news sitemap
      // (even cached for a few minutes) directly works against the whole
      // point of this file, which is telling Google about articles from
      // the last couple of hours.
      "Cache-Control": "no-store, must-revalidate",
    },
  });
}
