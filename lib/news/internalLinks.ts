// Phase 10 — links from a news article to this site's own pages, stored per
// article so they can be listed, removed and audited (article_internal_links).
//
// In the text: up to 3 links to country and city pages the story mentions
// (rules in links.ts). Related box: the other destinations mentioned plus up
// to 3 published blog articles about them, shown under the story. A page an
// editor removes stays removed when the links are planned again.
import { sql } from "../db";
import { articlePath, cityPath, countryPath } from "../destinations";
import { computeContentStats } from "../articles";
import { applyLink, hasLink, MAX_IN_TEXT, planLinks, removeLink, type LinkCandidate } from "./links";

export type LinkPlacement = "in_text" | "related_box";
export type LinkStatus = "applied" | "removed";

export interface InternalLink {
  id: number;
  targetUrl: string;
  targetType: LinkCandidate["type"];
  entityName: string;
  placement: LinkPlacement;
  status: LinkStatus;
  createdBy: string;
  createdAt: string;
}

export const MAX_RELATED = 6;
const MAX_RELATED_ARTICLES = 3;

function rowToLink(r: any): InternalLink {
  return {
    id: Number(r.id),
    targetUrl: r.target_url,
    targetType: r.target_type,
    entityName: r.entity_name,
    placement: r.placement,
    status: r.status,
    createdBy: r.created_by || "",
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at || ""),
  };
}

export async function getLinks(articleId: string): Promise<InternalLink[]> {
  try {
    const rows = await sql`SELECT * FROM article_internal_links WHERE article_id = ${articleId} ORDER BY placement DESC, id ASC`;
    return rows.map(rowToLink);
  } catch {
    return []; // table arrives with scripts/setup-db.mjs
  }
}

// What the public Related box shows: every applied link, destinations first.
export function relatedBoxItems(links: InternalLink[]): { name: string; url: string; type: InternalLink["targetType"] }[] {
  const order = { site_city: 0, site_country: 1, site_article: 2 } as const;
  const seen = new Set<string>();
  return links
    .filter((l) => l.status === "applied" && !seen.has(l.targetUrl) && (seen.add(l.targetUrl), true))
    .sort((a, b) => order[a.targetType] - order[b.targetType])
    .slice(0, MAX_RELATED + MAX_IN_TEXT)
    .map((l) => ({ name: l.entityName, url: l.targetUrl, type: l.targetType }));
}

function plainText(html: string): string {
  return html.replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, " ").replace(/<figure[\s\S]*?<\/figure>/gi, " ").replace(/<[^>]+>/g, " ");
}
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

interface PlaceCandidate extends LinkCandidate {
  key: string; // indexing key(s) used to honour noindex
  slugKey: string;
  id: string;
  countrySlug: string;
}

// Countries and cities that have a page on this site and aren't noindexed.
async function loadPlaces(): Promise<PlaceCandidate[]> {
  const out: PlaceCandidate[] = [];
  let noIndex = new Set<string>();
  try {
    noIndex = new Set(((await sql`SELECT key FROM indexing_settings WHERE no_index = true`) as any[]).map((r) => String(r.key)));
  } catch {
    /* no indexing table */
  }
  try {
    for (const c of (await sql`SELECT id, name, slug FROM countries`) as any[]) {
      if (noIndex.has(`country:${c.id}`) || noIndex.has(`country:${c.slug}`)) continue;
      out.push({ name: c.name, url: countryPath(c.slug), type: "site_country", key: `country:${c.id}`, slugKey: `country:${c.slug}`, id: String(c.id), countrySlug: c.slug });
    }
    for (const c of (await sql`SELECT id, name, slug, country_slug FROM cities`) as any[]) {
      if (!c.country_slug || noIndex.has(`city:${c.id}`)) continue;
      out.push({ name: c.name, url: cityPath(c.country_slug, c.slug), type: "site_city", key: `city:${c.id}`, slugKey: "", id: String(c.id), countrySlug: c.country_slug });
    }
  } catch {
    /* tables may not exist yet */
  }
  return out;
}

// Names mentioned in the article (outside existing links and figures).
export function findMentions<T extends { name: string }>(html: string, candidates: T[]): T[] {
  const text = plainText(html);
  return candidates.filter((c) => c.name.length >= 3 && new RegExp(`(^|[^\\p{L}\\p{N}])${esc(c.name)}(?![\\p{L}\\p{N}])`, "iu").test(text));
}

// Newest published blog articles in the mentioned cities, else countries.
async function relatedArticles(articleId: string, places: PlaceCandidate[]): Promise<LinkCandidate[]> {
  const cityIds = places.filter((p) => p.type === "site_city").map((p) => p.id);
  const countrySlugs = [...new Set(places.map((p) => p.countrySlug))];
  if (!cityIds.length && !countrySlugs.length) return [];
  try {
    const rows = (await sql`
      SELECT a.id, a.title, a.slug, ci.slug AS city_slug, ci.country_slug
      FROM articles a JOIN cities ci ON ci.id = a.city_id
      WHERE a.type = 'guide' AND a.status = 'published' AND a.id <> ${articleId}
        AND (a.city_id::text = ANY(${cityIds}::text[]) OR ci.country_slug = ANY(${countrySlugs}::text[]))
        AND NOT EXISTS (SELECT 1 FROM indexing_settings s WHERE s.key = 'article:' || a.id::text AND s.no_index = true)
      ORDER BY (a.city_id::text = ANY(${cityIds}::text[])) DESC, a.published_at DESC NULLS LAST
      LIMIT ${MAX_RELATED_ARTICLES}
    `.catch(() => [])) as any[];
    return rows.map((r) => ({ name: String(r.title), url: articlePath(r.country_slug, r.city_slug, r.slug), type: "site_article" as const }));
  } catch {
    return [];
  }
}

async function writeHtml(articleId: string, html: string): Promise<void> {
  const stats = computeContentStats(html);
  await sql`UPDATE articles SET content_html = ${html}, word_count = ${stats.wordCount}, reading_time_minutes = ${stats.readingTimeMinutes}, updated_at = now() WHERE id = ${articleId}`;
}

// (Re)plans an article's links: clears earlier automatic links from the text,
// plans them again (removed pages stay out) and stores the result.
export async function refreshLinks(articleId: string, by = "system"): Promise<{ inText: LinkCandidate[]; related: LinkCandidate[]; mentions: number }> {
  const a = (await sql`SELECT content_html FROM articles WHERE id = ${articleId} AND type = 'news' LIMIT 1`)[0];
  if (!a) throw new Error("News article not found.");
  const existing = await getLinks(articleId);
  const removed = new Set(existing.filter((l) => l.status === "removed").map((l) => l.targetUrl));
  const places = await loadPlaces();
  let html = String(a.content_html || "");
  // Unlink every page we may link to, so the plan starts clean (also clears
  // links written by older versions, which pointed at /destinations/...).
  for (const p of places) html = removeLink(removeLink(html, p.url), p.type === "site_country" ? `/destinations/${p.countrySlug}` : p.url.replace(/^\//, "/destinations/"));
  for (const l of existing) html = removeLink(html, l.targetUrl);

  const mentioned = findMentions(html, places);
  const plan = planLinks(html, mentioned, removed);
  const articles = (await relatedArticles(articleId, mentioned)).filter((x) => !removed.has(x.url));
  const related = [...plan.related, ...articles].slice(0, MAX_RELATED);

  await writeHtml(articleId, plan.html);
  try {
    await sql`DELETE FROM article_internal_links WHERE article_id = ${articleId} AND status <> 'removed'`;
    const rows = [
      ...plan.inText.map((l) => ({ ...l, placement: "in_text" })),
      ...related.map((l) => ({ ...l, placement: "related_box" })),
    ];
    if (rows.length) {
      await sql`
        INSERT INTO article_internal_links (article_id, target_url, target_type, entity_name, placement, status, created_by)
        SELECT ${articleId}::uuid, t.url, t.type, t.name, t.placement, 'applied', ${by}
        FROM unnest(${rows.map((r) => r.url)}::text[], ${rows.map((r) => r.type)}::text[], ${rows.map((r) => r.name)}::text[], ${rows.map((r) => r.placement)}::text[])
          AS t(url, type, name, placement)`;
    }
  } catch (err) {
    console.error("[news/links] storing links failed (run scripts/setup-db.mjs):", err);
  }
  return { inText: plan.inText, related, mentions: mentioned.length };
}

// Editor actions on one stored link. Changes to the text are written to the
// article, so the editor must have no unsaved edits (checked by the panel).
export async function linkAction(
  articleId: string,
  linkId: number,
  action: "remove" | "restore" | "to_text" | "to_related",
  by: string
): Promise<InternalLink[]> {
  const links = await getLinks(articleId);
  const link = links.find((l) => l.id === linkId);
  if (!link) throw new Error("Link not found.");
  const a = (await sql`SELECT content_html, status FROM articles WHERE id = ${articleId} AND type = 'news' LIMIT 1`)[0];
  if (!a) throw new Error("News article not found.");
  if (["published", "scheduled"].includes(a.status) && (action === "to_text" || (action === "remove" && link.placement === "in_text"))) {
    throw new Error("Unpublish the article before changing links in its text.");
  }
  let html = String(a.content_html || "");
  let placement = link.placement;
  let status: LinkStatus = link.status;

  if (action === "remove") {
    if (link.placement === "in_text") html = removeLink(html, link.targetUrl);
    status = "removed";
  } else if (action === "restore") {
    status = "applied";
    placement = "related_box";
  } else if (action === "to_related") {
    html = removeLink(html, link.targetUrl);
    placement = "related_box";
    status = "applied";
  } else if (action === "to_text") {
    if (link.targetType === "site_article") throw new Error("Blog articles are listed in the Related box only.");
    const inText = links.filter((l) => l.status === "applied" && l.placement === "in_text" && l.id !== link.id).length;
    if (inText >= MAX_IN_TEXT) throw new Error(`At most ${MAX_IN_TEXT} links in the text. Move one to the Related box first.`);
    if (!hasLink(html, link.targetUrl)) {
      const next = applyLink(html, link.entityName, link.targetUrl, { skipLede: true });
      if (next === html) throw new Error(`"${link.entityName}" isn't mentioned outside the first paragraph, a heading or a caption.`);
      html = next;
    }
    placement = "in_text";
    status = "applied";
  }

  if (html !== a.content_html) await writeHtml(articleId, html);
  await sql`
    UPDATE article_internal_links SET placement = ${placement}, status = ${status}, created_by = ${by}
    WHERE id = ${linkId} AND article_id = ${articleId}`;
  return getLinks(articleId);
}
