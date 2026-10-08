// Post-writing enrichment for news articles: slug, canonical URL, tags,
// Open Graph fields, secondary keywords and automatic internal links to this
// site's own destination pages. Facts are never touched; links only wrap text
// that is already in the article.
import { sql } from "../db";
import { generateUniqueSlug, computeContentStats } from "../articles";
import { SITE_URL } from "../site";
import { applyLink } from "./guidelinks";

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

function plainText(html: string): string {
  return html.replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, " ").replace(/<figure[\s\S]*?<\/figure>/gi, " ").replace(/<[^>]+>/g, " ");
}
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

interface Candidate {
  name: string;
  url: string;
}

async function loadCandidates(): Promise<Candidate[]> {
  const out: Candidate[] = [];
  try {
    const countries = (await sql`SELECT name, slug FROM countries`) as any[];
    for (const c of countries) out.push({ name: c.name, url: `/destinations/${c.slug}` });
    const cities = (await sql`SELECT name, slug, country_slug FROM cities`) as any[];
    for (const c of cities) if (c.country_slug) out.push({ name: c.name, url: `/destinations/${c.country_slug}/${c.slug}` });
  } catch {
    /* tables may not exist yet */
  }
  return out;
}

// Names (countries, cities) mentioned in the article that have a page on this site.
export function findMentions(html: string, candidates: Candidate[]): Candidate[] {
  const text = plainText(html);
  return candidates.filter((c) => c.name.length >= 3 && new RegExp(`(^|[^\\p{L}\\p{N}])${esc(c.name)}(?![\\p{L}\\p{N}])`, "iu").test(text));
}

// Sets slug, canonical, tags, OG/secondary SEO and applies internal links.
export async function enrichArticle(articleId: string): Promise<{ slug: string; links: number }> {
  const a = (await sql`SELECT title, content_html, slug, status, tags FROM articles WHERE id = ${articleId} AND type = 'news' LIMIT 1`)[0];
  if (!a) throw new Error("News article not found.");
  if (["published", "scheduled"].includes(a.status)) throw new Error("Unpublish the article before regenerating it.");

  const slug = await generateUniqueSlug(String(a.title || "news"), articleId);
  const canonical = `${SITE_URL}/news/${slug}`;

  const candidates = await loadCandidates();
  const mentions = findMentions(String(a.content_html || ""), candidates).slice(0, 4);
  let html = String(a.content_html || "");
  const applied: { name: string; url: string }[] = [];
  for (const m of mentions) {
    const next = applyLink(html, m.name, m.url);
    if (next !== html) {
      html = next;
      applied.push({ name: m.name, url: m.url });
    }
  }
  const stats = computeContentStats(html);
  await sql`
    UPDATE articles SET slug = ${slug}, canonical_url = ${canonical}, content_html = ${html},
      word_count = ${stats.wordCount}, reading_time_minutes = ${stats.readingTimeMinutes}, updated_at = now()
    WHERE id = ${articleId}`;
  await saveExtra(articleId, { internalLinks: { applied, candidates: mentions.length } });
  return { slug, links: applied.length };
}
