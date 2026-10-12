// Picks the destination (city) a news article is about, from the article
// itself: the city named in the headline, else the summary, else the city
// named most often in the text. A city that isn't on the site yet is created
// with its country. Stories that only name a country get no destination,
// because destination pages are cities.

import { sql } from "../db";
import { resolveOrCreateCity } from "../cities";
import { findPlaces, loadGazetteer, type PlaceEntry } from "./places";

const plain = (html: string) => String(html || "").replace(/<figure[\s\S]*?<\/figure>/gi, " ").replace(/<[^>]+>/g, " ");

export function pickCity(g: PlaceEntry[], parts: { title: string; excerpt: string; body: string }): PlaceEntry | null {
  const cityIn = (text: string) => findPlaces(text, g).map((k) => g.find((e) => e.key === k)!).filter((e) => e && e.country);
  for (const text of [parts.title, parts.excerpt]) {
    const found = cityIn(text);
    if (found.length) {
      // the one named first in the text
      return found.sort((a, b) => firstIndex(text, a) - firstIndex(text, b))[0];
    }
  }
  const body = plain(parts.body);
  const found = cityIn(body);
  if (found.length === 0) return null;
  const count = (e: PlaceEntry) => e.patterns.reduce((n, p) => n + (body.split(p).length - 1), 0);
  const ranked = found.map((e) => [e, count(e)] as const).sort((a, b) => b[1] - a[1]);
  // Only when one city clearly leads; a round-up of many cities gets none.
  return ranked.length === 1 || ranked[0][1] > ranked[1][1] ? ranked[0][0] : null;
}

function firstIndex(text: string, e: PlaceEntry): number {
  const idx = e.patterns.map((p) => text.indexOf(p)).filter((i) => i >= 0);
  return idx.length ? Math.min(...idx) : Infinity;
}

// Sets the article's destination when it has none. Returns the city id.
export async function assignDestination(articleId: string): Promise<string | null> {
  const a = (await sql`SELECT title, excerpt, content_html, city_id FROM articles WHERE id = ${articleId} AND type = 'news' LIMIT 1`)[0];
  if (!a || a.city_id) return a?.city_id ?? null;
  const g = await loadGazetteer();
  const city = pickCity(g, { title: String(a.title || ""), excerpt: String(a.excerpt || ""), body: String(a.content_html || "") });
  if (!city) return null;
  const country = g.find((e) => e.key === city.country);
  if (!country) return null;
  const site = (await sql`SELECT id FROM cities WHERE lower(name) = ${city.key} LIMIT 1`)[0];
  const id = site?.id ?? (await resolveOrCreateCity(city.name, country.name)).id;
  await sql`UPDATE articles SET city_id = ${id} WHERE id = ${articleId} AND city_id IS NULL`;
  return id;
}
