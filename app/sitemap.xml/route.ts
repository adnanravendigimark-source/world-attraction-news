import { NextResponse } from "next/server";
import { SITE_URL } from "@/lib/site";
import { getSitemaps, escapeXml } from "@/lib/sitemaps";

// The master sitemap index — references only ENABLED child sitemaps
// (Admin -> SEO -> Sitemaps controls this table), never lists a URL
// itself. Disabling a sitemap in Admin removes it from this index on the
// very next request (force-dynamic + no-store below); it does not touch
// any underlying content. This replaces the old app/sitemap.ts, which
// used Next's native single-urlset sitemap() convention and mixed every
// content type into one flat list — that file is gone; every content type
// now has its own dedicated child route (see app/sitemap-*.xml/route.ts).
export const dynamic = "force-dynamic";

function escapeXmlAttr(value: string): string {
  return escapeXml(value);
}

export async function GET() {
  const sitemaps = await getSitemaps();
  const enabled = sitemaps.filter((s) => s.enabled);

  const entries = enabled
    .map((s) => {
      const loc = `${SITE_URL}${s.path}`;
      const lastmod = s.updatedAt ? `\n    <lastmod>${new Date(s.updatedAt).toISOString()}</lastmod>` : "";
      return `  <sitemap>\n    <loc>${escapeXmlAttr(loc)}</loc>${lastmod}\n  </sitemap>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</sitemapindex>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=UTF-8",
      "Cache-Control": "no-store, must-revalidate",
    },
  });
}
