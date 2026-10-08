// Dependency-free, tolerant RSS 2.0 / Atom parser.
//
// Deliberately small: feeds are discovery input, not content we republish.
// We keep the headline, link, a short plain-text teaser, a date, an author
// and (only the URL of) an image if the feed provides one. We do NOT store
// full article bodies from other publishers.

export interface ParsedFeedItem {
  externalId: string;
  title: string;
  description: string;
  url: string;
  imageUrl: string;
  author: string;
  publishedAt: string | null; // ISO
  categories: string[];
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  ndash: "–",
  mdash: "—",
  hellip: "…",
};

export function decodeEntities(input: string): string {
  return input.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, g: string) => {
    if (g[0] === "#") {
      const code = g[1].toLowerCase() === "x" ? parseInt(g.slice(2), 16) : parseInt(g.slice(1), 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return m;
      try {
        return String.fromCodePoint(code);
      } catch {
        return m;
      }
    }
    const v = ENTITIES[g.toLowerCase()];
    return v !== undefined ? v : m;
  });
}

function unwrapCdata(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}

export function stripHtml(html: string): string {
  const noTags = unwrapCdata(html)
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li|h\d)>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  // Decode twice: some feeds double-encode (&amp;#8217;).
  return decodeEntities(decodeEntities(noTags)).replace(/\s+/g, " ").trim();
}

function tagText(block: string, tag: string): string {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i");
  const m = block.match(re);
  return m ? unwrapCdata(m[1]).trim() : "";
}

function attr(tagSource: string, name: string): string {
  const m = tagSource.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"));
  return m ? decodeEntities(m[2] ?? m[3] ?? "") : "";
}

function parseDate(raw: string): string | null {
  if (!raw) return null;
  const t = Date.parse(raw.trim());
  if (!Number.isFinite(t)) return null;
  // Guard against feeds with dates far in the future.
  if (t > Date.now() + 24 * 3600 * 1000) return null;
  return new Date(t).toISOString();
}

function resolveUrl(href: string, base: string): string {
  const h = decodeEntities(href.trim());
  if (!h) return "";
  try {
    return new URL(h, base || undefined).toString();
  } catch {
    return "";
  }
}

function firstImage(block: string, base: string): string {
  // <media:content url=... medium="image"|type="image/..">
  for (const m of block.matchAll(/<media:content\b[^>]*>/gi)) {
    const tag = m[0];
    const type = attr(tag, "type");
    const medium = attr(tag, "medium");
    const url = attr(tag, "url");
    if (url && (medium === "image" || type.startsWith("image/") || /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url))) {
      return resolveUrl(url, base);
    }
  }
  const thumb = block.match(/<media:thumbnail\b[^>]*>/i);
  if (thumb) {
    const url = attr(thumb[0], "url");
    if (url) return resolveUrl(url, base);
  }
  for (const m of block.matchAll(/<enclosure\b[^>]*>/gi)) {
    const type = attr(m[0], "type");
    const url = attr(m[0], "url");
    if (url && type.startsWith("image/")) return resolveUrl(url, base);
  }
  const img = unwrapCdata(block).match(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i);
  if (img) return resolveUrl(img[1], base);
  return "";
}

export function parseFeed(xml: string, baseUrl = ""): ParsedFeedItem[] {
  const items: ParsedFeedItem[] = [];
  const isAtom = /<feed\b/i.test(xml.slice(0, 2000)) && !/<rss\b/i.test(xml.slice(0, 2000));
  const blocks = isAtom
    ? xml.match(/<entry\b[\s\S]*?<\/entry>/gi) || []
    : xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];

  for (const block of blocks) {
    const title = stripHtml(tagText(block, "title"));
    if (!title) continue;

    let link = "";
    if (isAtom) {
      const links = block.match(/<link\b[^>]*>/gi) || [];
      const alt = links.find((l) => !/rel\s*=\s*["'](?!alternate)/i.test(l)) || links[0];
      link = alt ? attr(alt, "href") : "";
    } else {
      link = stripHtml(tagText(block, "link"));
      if (!link) {
        const atomLink = block.match(/<atom:link\b[^>]*>/i);
        if (atomLink) link = attr(atomLink[0], "href");
      }
    }
    const url = resolveUrl(link, baseUrl);

    const guid = stripHtml(tagText(block, isAtom ? "id" : "guid"));
    const externalId = (guid || url || title).slice(0, 500);

    const rawDesc =
      tagText(block, "description") || tagText(block, "summary") || tagText(block, "content:encoded") || tagText(block, "content");
    const description = stripHtml(rawDesc).slice(0, 600);

    const dateRaw =
      tagText(block, "pubDate") || tagText(block, "published") || tagText(block, "updated") || tagText(block, "dc:date");

    let author = stripHtml(tagText(block, "dc:creator"));
    if (!author) {
      const a = tagText(block, "author");
      author = stripHtml(tagText(a, "name") || a);
    }
    // Google News exposes the real publisher in <source>.
    const sourceName = stripHtml(tagText(block, "source"));
    if (!author && sourceName) author = sourceName;

    const categories = [...block.matchAll(/<category\b[^>]*?(?:\/>|>([\s\S]*?)<\/category>)/gi)]
      .map((m) => stripHtml(m[1] || attr(m[0], "term")))
      .filter(Boolean)
      .slice(0, 12);

    items.push({
      externalId,
      title: title.slice(0, 500),
      description,
      url,
      imageUrl: firstImage(block, baseUrl),
      author: author.slice(0, 200),
      publishedAt: parseDate(dateRaw),
      categories,
    });
  }
  return items;
}
