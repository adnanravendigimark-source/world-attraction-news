// "Find news for Barcelona": a one-off Google News search for a place, last 7
// hours only, stored through the normal pipeline (relevance filter, grouping,
// scoring, place tags). The stories then appear in Trending News with the
// usual Generate article button. No OpenAI calls.

import { sql } from "../db";
import { newsWindowDays } from "./trend";
import { collectSource } from "./collector";
import { rowToSource } from "./sources";
import { mergeDuplicateClusters, runClustering } from "./cluster";
import { runTrendScoring } from "./trend";
import { loadFilterConfig } from "./filter";
import { checkFreshStories } from "./readability";
import { loadGazetteer, refreshStoryPlaces, resolvePlace, tagPlaces } from "./places";

// Stored with a placeholder address so the scheduled fetch never runs it
// (it is inactive) and it never clashes with a real feed.
export const SEARCH_SOURCE_URL = "search:destination";
const TRAVEL_WORDS = "travel OR tourism OR tourists OR visitors OR airport OR airline OR flights OR hotel OR attraction OR museum OR visa OR cruise OR festival";

// Lowest general filter score a destination-search item may have.
export const PLACE_FLOOR = 15;

export function placeSearchUrl(names: string[]): string {
  const uniq = [...new Set(names.map((n) => n.trim()).filter(Boolean))].slice(0, 3);
  const who = uniq.length > 1 ? `(${uniq.map((n) => `"${n}"`).join(" OR ")})` : `"${uniq[0] || ""}"`;
  const q = `${who} (${TRAVEL_WORDS}) when:1d`;
  return `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
}

async function searchSource() {
  const found = await sql`SELECT * FROM news_sources WHERE rss_url = ${SEARCH_SOURCE_URL} LIMIT 1`;
  if (found[0]) return rowToSource(found[0]);
  const rows = await sql`
    INSERT INTO news_sources (name, type, url, rss_url, api_provider, query, category, country, is_active, reliability_score, fetch_interval_minutes)
    VALUES ('Destination search', 'google_news_rss', 'https://news.google.com', ${SEARCH_SOURCE_URL}, 'google_news', '', 'Destinations', '', false, 60, 1440)
    RETURNING *
  `;
  return rowToSource(rows[0]);
}

export async function searchPlaceNews(query: string): Promise<{ place: string; known: boolean; found: number; added: number; error?: string }> {
  const g = await loadGazetteer();
  const p = resolvePlace(query, g);
  if (!p.key) throw new Error("Type a city or country, for example Barcelona, Bali or Italy.");
  const entry = g.find((e) => e.key === p.key);
  const names = entry ? entry.patterns : [p.name];
  const source = await searchSource();
  const r = await collectSource({ ...source, rssUrl: placeSearchUrl(names), etag: "", lastModified: "", query: p.name } as any);
  await sql`UPDATE news_sources SET query = ${p.name} WHERE id = ${source.id}`.catch(() => {});
  await tagPlaces().catch(() => {});
  // The editor asked for this place and the search itself requires travel
  // words, so items about the place are kept even when the general filter
  // scores them low ("Florence Cathedral begins bell tower restoration").
  // Items scoring under PLACE_FLOOR, or not about the place, stay out.
  const { relevantMin } = await loadFilterConfig();
  const days = await newsWindowDays();
  const like = `%${p.name.replace(/[%_\\]/g, (c) => "\\" + c)}%`;
  const promoted = (await sql`
    UPDATE news_items i SET filter_status = 'relevant', relevance_score = ${relevantMin},
      filter_reason = 'destination search: ' || COALESCE(i.filter_reason, '')
    FROM news_sources s
    WHERE s.id = i.source_id AND s.rss_url = ${SEARCH_SOURCE_URL}
      AND i.filter_status IN ('borderline', 'irrelevant') AND COALESCE(i.relevance_score, 0) >= ${PLACE_FLOOR}
      AND COALESCE(i.published_at, i.created_at) > now() - (${days}::int * interval '1 day')
      AND (${p.key} = ANY(COALESCE(i.places, '{}')) OR i.title ILIKE ${like})
    RETURNING i.id
  `.catch(() => [])) as any[];
  if (r.added > 0 || promoted.length > 0) {
    await runClustering({ windowDays: Math.max(2, days) });
    await mergeDuplicateClusters().catch(() => {});
    await runTrendScoring().catch(() => {});
  }
  await tagPlaces().catch(() => {});
  await refreshStoryPlaces();
  // Open the sources of the stories found (no AI): stories nobody could
  // research are hidden, and more coverage is searched for where needed.
  const fresh = (await sql`
    SELECT id FROM story_clusters
    WHERE ${p.key} = ANY(places) AND last_seen_at > now() - (${days}::int * interval '1 day')
      AND status NOT IN ('ignored', 'merged') AND readable_checked_at IS NULL
    ORDER BY trend_score DESC NULLS LAST LIMIT 12
  `.catch(() => [])) as any[];
  await checkFreshStories({ ids: fresh.map((r) => r.id), budgetMs: 30_000 });
  return { place: p.name, known: p.known, found: r.found, added: r.added, error: r.error };
}
