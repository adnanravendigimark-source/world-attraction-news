// Can this story be researched? Research needs at least one source whose page
// can be read in full; a story whose only link is blocked (HTTP 403, paywall,
// script-rendered page) gives the writer nothing to work with.
//
// checkReadable() opens the story's sources (no AI) and stores how many could
// be read on story_clusters.readable_sources. Stories checked with none
// readable are hidden from Trending News. findMoreSources() searches Google
// News for other publishers covering the same story and adds them to it.

import { sql } from "../db";
import { fetchPageText, isGoogleNewsRedirect, isPublicUrl } from "./extract";
import { publisherUrlForItem } from "./googleNews";
import { collectSource } from "./collector";
import { rowToSource } from "./sources";
import { refreshClusterStats } from "./cluster";
import { prepareTitle, sameStoryPrepared } from "./similarity";
import { sourceKey } from "./sourceNames";
import { loadFilterConfig } from "./filter";

const MAX_CHECK = 4;
export const RELATED_SOURCE_URL = "search:related";

// "Title - Publisher" -> "Title"
export function headlineCore(title: string): string {
  return String(title || "").replace(/\s+[-–|]\s+[^-–|]{2,60}$/, "").replace(/["“”]/g, "").trim();
}

export function relatedSearchUrl(title: string): string {
  const q = `${headlineCore(title).split(/\s+/).slice(0, 14).join(" ")} when:1d`;
  return `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
}

// AMP pages are often blocked or empty; the normal article usually is not.
export function nonAmpUrl(url: string): string {
  return url.replace(/\/amp\/?(\?.*)?$/i, "/").replace(/[?&]amp(=1)?$/i, "");
}

async function readable(it: any): Promise<boolean> {
  let url = String(it.resolved_url || it.url || "");
  if (isGoogleNewsRedirect(url)) url = await publisherUrlForItem(it).catch(() => "");
  if (!url || !isPublicUrl(url)) return false;
  const page = await fetchPageText(url);
  if (page.ok) return true;
  const alt = nonAmpUrl(url);
  return alt !== url ? (await fetchPageText(alt)).ok : false;
}

export async function checkReadable(clusterId: string): Promise<number> {
  const items = (await sql`
    SELECT i.id, i.url, i.resolved_url,
           CASE WHEN s.type = 'google_news_rss' AND i.author <> '' THEN i.author ELSE s.name END AS publisher
    FROM news_items i JOIN news_sources s ON s.id = i.source_id
    WHERE i.cluster_id = ${clusterId}
    ORDER BY s.is_official DESC, s.reliability_score DESC
  `) as any[];
  const seen = new Set<string>();
  const pick = items.filter((it) => {
    const k = sourceKey({ publisher: it.publisher, url: it.resolved_url || it.url });
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, MAX_CHECK);
  const ok = (await Promise.all(pick.map((it) => readable(it).catch(() => false)))).filter(Boolean).length;
  await sql`UPDATE story_clusters SET readable_sources = ${ok}, readable_checked_at = now() WHERE id = ${clusterId}`.catch(() => {});
  return ok;
}

async function relatedSource() {
  const found = await sql`SELECT * FROM news_sources WHERE rss_url = ${RELATED_SOURCE_URL} LIMIT 1`;
  if (found[0]) return rowToSource(found[0]);
  const rows = await sql`
    INSERT INTO news_sources (name, type, url, rss_url, api_provider, query, category, country, is_active, reliability_score, fetch_interval_minutes)
    VALUES ('More coverage search', 'google_news_rss', 'https://news.google.com', ${RELATED_SOURCE_URL}, 'google_news', '', 'General', '', false, 55, 1440)
    RETURNING *
  `;
  return rowToSource(rows[0]);
}

// Adds other publishers' reports of the same story (last 24 hours).
export async function findMoreSources(clusterId: string): Promise<number> {
  const c = (await sql`SELECT canonical_title FROM story_clusters WHERE id = ${clusterId} LIMIT 1`)[0];
  if (!c) return 0;
  const src = await relatedSource();
  const r = await collectSource({ ...src, rssUrl: relatedSearchUrl(c.canonical_title), etag: "", lastModified: "" } as any);
  if (r.status === "error") return 0;
  const target = prepareTitle(headlineCore(c.canonical_title));
  const cands = (await sql`
    SELECT id, title, description FROM news_items
    WHERE source_id = ${src.id} AND cluster_id IS NULL AND created_at > now() - interval '1 day'
  `) as any[];
  const ids = cands.filter((x) => sameStoryPrepared(prepareTitle(headlineCore(x.title), x.description || ""), target)).map((x) => x.id);
  if (ids.length === 0) return 0;
  const { relevantMin } = await loadFilterConfig();
  await sql`
    UPDATE news_items SET cluster_id = ${clusterId}, filter_status = 'relevant',
      relevance_score = GREATEST(COALESCE(relevance_score, 0), ${relevantMin}),
      filter_reason = 'more coverage of this story'
    WHERE id = ANY(${ids}::uuid[])
  `;
  await refreshClusterStats([clusterId]);
  return ids.length;
}

// Before research: make sure at least one source can be read, searching for
// more coverage once if none can.
export async function ensureReadableSources(clusterId: string): Promise<{ readable: number; added: number }> {
  let n = await checkReadable(clusterId);
  let added = 0;
  if (n === 0) {
    added = await findMoreSources(clusterId).catch(() => 0);
    if (added > 0) n = await checkReadable(clusterId);
  }
  return { readable: n, added };
}

// Checks fresh stories nobody has checked yet, best first, within a time budget.
export async function checkFreshStories(opts: { ids?: string[]; limit?: number; budgetMs?: number } = {}): Promise<number> {
  const started = Date.now();
  const budget = opts.budgetMs ?? 30_000;
  const rows = opts.ids
    ? opts.ids.map((id) => ({ id }))
    : ((await sql`
        SELECT id FROM story_clusters
        WHERE readable_checked_at IS NULL AND status NOT IN ('ignored', 'merged')
          AND last_seen_at > now() - interval '24 hours'
        ORDER BY trend_score DESC NULLS LAST LIMIT ${opts.limit ?? 8}
      `.catch(() => [])) as any[]);
  let done = 0;
  const queue = [...rows];
  const worker = async () => {
    while (queue.length && Date.now() - started < budget) {
      const r = queue.shift()!;
      await ensureReadableSources(r.id).catch(() => {});
      done++;
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  return done;
}
