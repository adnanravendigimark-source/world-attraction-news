import { createHash } from "crypto";
import { sql } from "../db";
import { parseFeed, type ParsedFeedItem } from "./rss";
import { fetchNewsApi, fetchCurrents } from "./providers";
import { getNewsSources, rowToSource, type NewsSource } from "./sources";
import { mergeDuplicateClusters, runClustering } from "./cluster";
import { runTrendScoring } from "./trend";
import { isTravelSource, loadFilterConfig, scoreRelevance } from "./filter";
import { isPublicUrl } from "./extract";

const USER_AGENT = "WorldAttractionNewsBot/1.0 (+news discovery; contact via site)";
const MAX_BYTES = 3 * 1024 * 1024;
const MAX_ITEMS_PER_SOURCE = 50;
const MAX_AGE_DAYS = 14;
const CONCURRENCY = 4;

export interface SourceResult {
  sourceId: string;
  name: string;
  status: "ok" | "not_modified" | "error" | "skipped";
  found: number;
  added: number;
  error?: string;
}

export interface FetchRunSummary {
  runId: number | null;
  trigger: string;
  sourcesChecked: number;
  itemsFound: number;
  itemsNew: number;
  errors: number;
  clustered: number;
  results: SourceResult[];
}

export function hashTitle(title: string): string {
  const norm = title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return createHash("sha256").update(norm).digest("hex");
}

async function fetchFeedXml(
  source: NewsSource
): Promise<{ notModified: true } | { notModified: false; xml: string; etag: string; lastModified: string }> {
  const headers: Record<string, string> = {
    "User-Agent": USER_AGENT,
    Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5",
  };
  if (source.etag) headers["If-None-Match"] = source.etag;
  if (source.lastModified) headers["If-Modified-Since"] = source.lastModified;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(source.rssUrl, { headers, signal: ctrl.signal, redirect: "follow", cache: "no-store" });
    if (res.status === 304) return { notModified: true };
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const len = Number(res.headers.get("content-length") || 0);
    if (len > MAX_BYTES) throw new Error("Feed too large.");
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) throw new Error("Feed too large.");
    const xml = new TextDecoder("utf-8").decode(buf);
    if (!/<(rss|feed|rdf:RDF)\b/i.test(xml.slice(0, 3000))) throw new Error("Response is not an RSS/Atom feed.");
    return {
      notModified: false,
      xml,
      etag: res.headers.get("etag") || "",
      lastModified: res.headers.get("last-modified") || "",
    };
  } catch (err: any) {
    if (err?.name === "AbortError") throw new Error("Timed out after 15s.");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function storeItems(source: NewsSource, items: ParsedFeedItem[]): Promise<number> {
  const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 3600 * 1000;
  const fresh = items
    .filter((i) => i.title && (i.url || i.externalId))
    .filter((i) => !i.publishedAt || Date.parse(i.publishedAt) >= cutoff)
    .slice(0, MAX_ITEMS_PER_SOURCE);
  if (fresh.length === 0) return 0;

  const config = await loadFilterConfig();
  const travelSource = isTravelSource(source.type, source.category);
  const rel = fresh.map((i) =>
    scoreRelevance({ title: i.title, description: i.description, sourceCategory: source.category, sourceIsTravel: travelSource }, config)
  );

  const rows = await sql`
    INSERT INTO news_items
      (source_id, external_id, title, description, url, image_url, author, published_at, category, country, content_hash,
       relevance_score, relevance_category, filter_status, filter_reason)
    SELECT ${source.id}::uuid, t.external_id, t.title, t.description, t.url, t.image_url, t.author,
           NULLIF(t.published_at, '')::timestamptz, ${source.category}, ${source.country}, t.content_hash,
           t.rscore, t.rcat, t.rstatus, t.rreason
    FROM unnest(
      ${fresh.map((i) => i.externalId)}::text[],
      ${fresh.map((i) => i.title)}::text[],
      ${fresh.map((i) => i.description)}::text[],
      ${fresh.map((i) => i.url)}::text[],
      ${fresh.map((i) => i.imageUrl)}::text[],
      ${fresh.map((i) => i.author)}::text[],
      ${fresh.map((i) => i.publishedAt || "")}::text[],
      ${fresh.map((i) => hashTitle(i.title))}::text[],
      ${rel.map((r) => r.score)}::int[],
      ${rel.map((r) => r.category)}::text[],
      ${rel.map((r) => r.status)}::text[],
      ${rel.map((r) => r.reason)}::text[]
    ) AS t(external_id, title, description, url, image_url, author, published_at, content_hash, rscore, rcat, rstatus, rreason)
    ON CONFLICT (source_id, external_id) DO NOTHING
    RETURNING id
  `;
  return rows.length;
}

export interface FeedPreview {
  itemCount: number;
  travelCount: number; // items the travel filter would keep (relevant or borderline)
  newestAt: string | null;
  sample: { title: string; url: string; publishedAt: string | null; travel: boolean }[];
}

// Fetches and parses a feed without storing anything, so an editor can check
// a feed before adding it.
export async function previewFeed(rssUrl: string, category = ""): Promise<FeedPreview> {
  const url = String(rssUrl || "").trim();
  if (!/^https?:\/\//i.test(url) || !isPublicUrl(url)) throw new Error("Enter a public http(s) feed URL.");
  const res = await fetchFeedXml({ rssUrl: url, etag: "", lastModified: "" } as NewsSource);
  if (res.notModified) throw new Error("The server answered 304 Not Modified to a fresh request.");
  const items = parseFeed(res.xml, url);
  if (items.length === 0) throw new Error("The feed parsed but has no items.");
  const config = await loadFilterConfig().catch(() => null);
  const travel = items.map((it) =>
    config ? scoreRelevance({ title: it.title, description: it.description, sourceCategory: category, sourceIsTravel: !!category }, config).status !== "irrelevant" : true
  );
  const dates = items.map((i) => i.publishedAt).filter((d): d is string => !!d).sort();
  return {
    itemCount: items.length,
    travelCount: travel.filter(Boolean).length,
    newestAt: dates.length ? dates[dates.length - 1] : null,
    sample: items.slice(0, 5).map((it, i) => ({ title: it.title, url: it.url, publishedAt: it.publishedAt, travel: travel[i] })),
  };
}

export async function collectSource(source: NewsSource): Promise<SourceResult> {
  const base = { sourceId: source.id, name: source.name };
  try {
    let items: ParsedFeedItem[] = [];
    let etag = source.etag;
    let lastModified = source.lastModified;

    if (source.type === "newsapi") {
      items = await fetchNewsApi(source.query);
    } else if (source.type === "currents") {
      items = await fetchCurrents(source.query);
    } else {
      const res = await fetchFeedXml(source);
      if (res.notModified) {
        await sql`UPDATE news_sources SET last_fetched_at = now(), last_status = 'not_modified', last_error = '', consecutive_failures = 0 WHERE id = ${source.id}`;
        return { ...base, status: "not_modified", found: 0, added: 0 };
      }
      etag = res.etag;
      lastModified = res.lastModified;
      items = parseFeed(res.xml, source.rssUrl);
    }

    const added = await storeItems(source, items);
    await sql`
      UPDATE news_sources SET last_fetched_at = now(), last_status = 'ok', last_error = '',
        last_item_count = ${items.length}, consecutive_failures = 0, etag = ${etag}, last_modified = ${lastModified}
      WHERE id = ${source.id}
    `;
    return { ...base, status: "ok", found: items.length, added };
  } catch (err: any) {
    const message = String(err?.message || err).slice(0, 300);
    await sql`
      UPDATE news_sources SET last_fetched_at = now(), last_status = 'error', last_error = ${message},
        consecutive_failures = consecutive_failures + 1
      WHERE id = ${source.id}
    `.catch(() => {});
    return { ...base, status: "error", found: 0, added: 0, error: message };
  }
}

function isDue(s: NewsSource, now: number): boolean {
  if (!s.isActive) return false;
  if (!s.lastFetchedAt) return true;
  // Back off failing sources: double the interval per failure, capped at 12h.
  const mult = Math.min(2 ** Math.min(s.consecutiveFailures, 5), 24 * 60 / Math.max(s.fetchIntervalMinutes, 1));
  const interval = s.fetchIntervalMinutes * Math.max(1, mult) * 60 * 1000;
  // 20% tolerance so a 30-min cron isn't skipped by seconds of drift.
  return now - Date.parse(s.lastFetchedAt) >= interval * 0.8;
}

export async function runFetch(opts: { trigger: string; force?: boolean; sourceId?: string; budgetMs?: number }): Promise<FetchRunSummary> {
  const started = Date.now();
  const budget = opts.budgetMs ?? 50_000;
  let sources = await getNewsSources();
  if (opts.sourceId) sources = sources.filter((s) => s.id === opts.sourceId);
  const due = opts.force || opts.sourceId ? sources.filter((s) => s.isActive || opts.sourceId) : sources.filter((s) => isDue(s, started));
  // Higher-priority sources first, so they are the ones checked when the
  // time budget runs out.
  due.sort((a, b) => b.priority - a.priority);

  const results: SourceResult[] = [];
  const queue = [...due];
  const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    while (queue.length) {
      if (Date.now() - started > budget) break;
      const s = queue.shift()!;
      results.push(await collectSource(s));
    }
  });
  await Promise.all(workers);
  for (const s of queue) results.push({ sourceId: s.id, name: s.name, status: "skipped", found: 0, added: 0, error: "Time budget reached." });

  // Group newly stored items into story clusters (never blocks the fetch).
  let clustered = 0;
  try {
    clustered = (await runClustering()).assigned;
    await mergeDuplicateClusters().catch((err) => console.error("[news] merging duplicate stories failed:", err));
    await runTrendScoring();
  } catch (err) {
    console.error("[news] clustering/scoring failed:", err);
  }

  const summary: FetchRunSummary = {
    runId: null,
    trigger: opts.trigger,
    sourcesChecked: results.filter((r) => r.status !== "skipped").length,
    itemsFound: results.reduce((n, r) => n + r.found, 0),
    itemsNew: results.reduce((n, r) => n + r.added, 0),
    errors: results.filter((r) => r.status === "error").length,
    clustered,
    results,
  };
  try {
    const rows = await sql`
      INSERT INTO news_fetch_runs (trigger, started_at, finished_at, sources_checked, items_found, items_new, errors, summary)
      VALUES (${opts.trigger}, ${new Date(started).toISOString()}, now(), ${summary.sourcesChecked}, ${summary.itemsFound},
              ${summary.itemsNew}, ${summary.errors}, ${JSON.stringify(results)}::jsonb)
      RETURNING id
    `;
    summary.runId = rows[0]?.id ?? null;
    // Keep the run log bounded.
    await sql`DELETE FROM news_fetch_runs WHERE id < (SELECT COALESCE(MAX(id), 0) - 200 FROM news_fetch_runs)`;
  } catch (err) {
    console.error("[news] failed to write run log:", err);
  }
  return summary;
}

export { rowToSource };
