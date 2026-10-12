// Tags news with the places it mentions (cities, islands, regions and
// countries) so editors can search fresh news by destination: "Barcelona",
// "Bali", "New Delhi", "Italy". A city also tags its country, so a search for
// "Italy" finds a story about Venice.
//
// Places are stored lowercase on news_items.places and, as the union of their
// items, on story_clusters.places.

import { sql } from "../db";
import { CITIES, COUNTRIES } from "./placeData";

export interface PlaceEntry {
  name: string; // display name
  key: string; // stored tag (lowercase)
  country: string; // country key ("" for a country itself)
  patterns: string[]; // names to look for in text
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const placeKey = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export function buildGazetteer(siteCities: { name: string; country: string }[] = []): PlaceEntry[] {
  const out = new Map<string, PlaceEntry>();
  for (const [name, aliases] of Object.entries(COUNTRIES)) {
    out.set(placeKey(name), { name, key: placeKey(name), country: "", patterns: [name, ...aliases] });
  }
  const addCity = (name: string, country: string, aliases: string[] = []) => {
    const key = placeKey(name);
    const prev = out.get(key);
    if (prev) {
      prev.patterns = [...new Set([...prev.patterns, ...aliases])];
      return;
    }
    out.set(key, { name, key, country: placeKey(country), patterns: [name, ...aliases] });
  };
  for (const [name, country, aliases] of CITIES) addCity(name, country, aliases || []);
  for (const c of siteCities) if (c.name && c.country) addCity(c.name, c.country);
  return [...out.values()];
}

// One regex per entry, matched case-sensitively on word boundaries so
// "Turkey" the country is found but "turkey dinner" is not.
const compiled = new WeakMap<PlaceEntry[], { entry: PlaceEntry; re: RegExp }[]>();
function matchers(g: PlaceEntry[]) {
  let m = compiled.get(g);
  if (!m) {
    m = g.map((entry) => ({
      entry,
      re: new RegExp(`(?<![\\p{L}\\p{N}])(?:${entry.patterns.map(esc).join("|")})(?![\\p{L}\\p{N}])`, "u"),
    }));
    compiled.set(g, m);
  }
  return m;
}

export function findPlaces(text: string, g: PlaceEntry[]): string[] {
  const t = String(text || "");
  if (!t) return [];
  const found = new Set<string>();
  for (const { entry, re } of matchers(g)) {
    if (re.test(t)) {
      found.add(entry.key);
      if (entry.country) found.add(entry.country);
    }
  }
  return [...found].sort();
}

// What an editor typed, resolved to a stored tag. Unknown places are still
// searchable by text, see listStories.
export function resolvePlace(q: string, g: PlaceEntry[]): { key: string; name: string; known: boolean; country: string } {
  const k = placeKey(q);
  if (!k) return { key: "", name: "", known: false, country: "" };
  const hit =
    g.find((e) => e.key === k) ||
    g.find((e) => e.patterns.some((p) => placeKey(p) === k));
  if (hit) return { key: hit.key, name: hit.name, known: true, country: hit.country };
  return { key: k, name: q.trim(), known: false, country: "" };
}

export async function loadGazetteer(): Promise<PlaceEntry[]> {
  const cities = (await sql`SELECT name, country FROM cities`.catch(() => [])) as any[];
  return buildGazetteer(cities.map((c) => ({ name: String(c.name || ""), country: String(c.country || "") })));
}

// Tags items that have not been tagged yet (newest first), then refreshes the
// places of the stories they belong to. Safe to call often.
export async function tagPlaces(limit = 3000): Promise<{ items: number; stories: number }> {
  const rows = (await sql`
    SELECT id, title, description FROM news_items
    WHERE places IS NULL AND COALESCE(published_at, created_at) > now() - interval '14 days'
    ORDER BY COALESCE(published_at, created_at) DESC
    LIMIT ${limit}
  `.catch(() => [])) as any[];
  if (rows.length === 0) return { items: 0, stories: 0 };
  const g = await loadGazetteer();
  const ids = rows.map((r) => r.id);
  const tags = rows.map((r) => `{${findPlaces(`${r.title}. ${r.description || ""}`, g).map((p) => `"${p.replace(/"/g, "")}"`).join(",")}}`);
  await sql`
    UPDATE news_items i SET places = t.places::text[]
    FROM unnest(${ids}::uuid[], ${tags}::text[]) AS t(id, places)
    WHERE i.id = t.id
  `;
  const st = (await sql`
    UPDATE story_clusters c SET places = COALESCE((
      SELECT array_agg(DISTINCT p ORDER BY p) FROM news_items i, unnest(i.places) p WHERE i.cluster_id = c.id
    ), '{}')
    WHERE c.id IN (SELECT DISTINCT cluster_id FROM news_items WHERE id = ANY(${ids}::uuid[]) AND cluster_id IS NOT NULL)
    RETURNING c.id
  `.catch(() => [])) as any[];
  return { items: rows.length, stories: st.length };
}

// Stories change as items are grouped; keep cluster places in step.
export async function refreshStoryPlaces(): Promise<void> {
  await sql`
    UPDATE story_clusters c SET places = COALESCE((
      SELECT array_agg(DISTINCT p ORDER BY p) FROM news_items i, unnest(i.places) p WHERE i.cluster_id = c.id
    ), '{}')
    WHERE c.last_seen_at > now() - interval '14 days' AND c.status NOT IN ('ignored', 'merged')
  `.catch(() => {});
}
