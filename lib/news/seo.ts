// Post-writing enrichment for news articles: slug, canonical URL, tags,
// Open Graph fields, secondary keywords and automatic internal links to this
// site's own destination pages. Facts are never touched; links only wrap text
// that is already in the article.
import { sql } from "../db";
import { generateUniqueSlug } from "../articles";
import { SITE_URL } from "../site";
import { refreshLinks } from "./internalLinks";

export interface ExtraSeo {
  secondaryKeywords: string[];
  ogTitle: string;
  ogDescription: string;
  internalLinks: { applied: { name: string; url: string }[]; candidates: number };
}

export async function getExtra(articleId: string): Promise<ExtraSeo> {
  const empty: ExtraSeo = { secondaryKeywords: [], ogTitle: "", ogDescription: "", internalLinks: { applied: [], candidates: 0 } };
  try {
    const r = (await sql`SELECT secondary_keywords, og_title, og_description, internal_links FROM news_article_extra WHERE article_id = ${articleId} LIMIT 1`)[0];
    if (!r) return empty;
    const il = r.internal_links || {};
    return {
      secondaryKeywords: Array.isArray(r.secondary_keywords) ? r.secondary_keywords : [],
      ogTitle: r.og_title || "",
      ogDescription: r.og_description || "",
      internalLinks: { applied: Array.isArray(il.applied) ? il.applied : [], candidates: Number(il.candidates || 0) },
    };
  } catch {
    return empty;
  }
}

export async function saveExtra(articleId: string, patch: Partial<Omit<ExtraSeo, "internalLinks">> & { internalLinks?: ExtraSeo["internalLinks"] }): Promise<void> {
  const cur = await getExtra(articleId);
  const next = { ...cur, ...patch };
  try {
    await sql`
    INSERT INTO news_article_extra (article_id, secondary_keywords, og_title, og_description, internal_links, updated_at)
    VALUES (${articleId}, ${JSON.stringify(next.secondaryKeywords)}::jsonb, ${next.ogTitle}, ${next.ogDescription}, ${JSON.stringify(next.internalLinks)}::jsonb, now())
    ON CONFLICT (article_id) DO UPDATE SET secondary_keywords = EXCLUDED.secondary_keywords, og_title = EXCLUDED.og_title,
      og_description = EXCLUDED.og_description, internal_links = EXCLUDED.internal_links, updated_at = now()`;
  } catch (err: any) {
    if (/news_article_extra/.test(String(err?.message))) throw new Error("A database update is needed: run `node scripts/setup-db.mjs`, then try again.");
    throw err;
  }
}

const SLUG_STOP = new Set("a an the of to in on at for and or with by from is are as its it this that after over into amid says said".split(" "));

// Short, readable news slug: filler words dropped, at most 8 words, no
// trailing publisher name ("… - Reuters"). Falls back to the full title when
// too little would be left. Slugs are only (re)generated before publishing:
// enrichArticle() refuses published or scheduled articles, so a live URL
// never changes.
export function newsSlugBase(title: string): string {
  const clean = title
    .replace(/\s[-–—|]\s[^-–—|]{2,40}$/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const words = clean.split(/\s+/).filter(Boolean);
  const kept = words.filter((w) => !SLUG_STOP.has(w));
  const pick = (kept.length >= 3 ? kept : words).slice(0, 8);
  return pick.join("-").slice(0, 70).replace(/-+$/, "") || "news";
}

// Sets slug, canonical, tags, OG/secondary SEO and applies internal links.
export async function enrichArticle(articleId: string): Promise<{ slug: string; links: number }> {
  const a = (await sql`SELECT title, content_html, slug, status, tags FROM articles WHERE id = ${articleId} AND type = 'news' LIMIT 1`)[0];
  if (!a) throw new Error("News article not found.");
  if (["published", "scheduled"].includes(a.status)) throw new Error("Unpublish the article before regenerating it.");

  const slug = await generateUniqueSlug(newsSlugBase(String(a.title || "news")), articleId);
  const canonical = `${SITE_URL}/news/${slug}`;

  await sql`UPDATE articles SET slug = ${slug}, canonical_url = ${canonical}, updated_at = now() WHERE id = ${articleId}`;
  // Links to this site's own pages: up to 3 in the text, the rest in the
  // Related box (lib/news/internalLinks.ts).
  const links = await refreshLinks(articleId);
  await saveExtra(articleId, { internalLinks: { applied: links.inText.map((l) => ({ name: l.name, url: l.url })), candidates: links.mentions } });
  return { slug, links: links.inText.length };
}
