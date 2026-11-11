// The "anchor" of a blog topic: the real thing it is about, from Wikidata.
// Exact name, coordinates, country, the places it sits in (district, city,
// region), official website, its own photo (P18) and Commons category.
//
// Why: topics were trusted blindly. "Sagrada Familia 2027" filed under the
// United States was researched from pages about the United States and
// illustrated with the Space Needle and a church in New Mexico. Every later
// step (research, destination, photos) now starts from this anchor.

import { COUNTRIES } from "../news/placeData";

const UA = "WorldAttractionNewsBot/1.0 (https://www.worldattractionnews.com; research)";

export interface Anchor {
  qid: string;
  label: string;
  wikiTitle: string;
  lat: number | null;
  lon: number | null;
  country: string; // English name of P17, "" if none
  places: string[]; // P131 chain, nearest first: ["Sagrada Família", "Eixample", "Barcelona", …]
  officialSite: string;
  image: string; // Commons file name (P18), without "File:"
  commonsCategory: string; // P373
}

async function jget(url: string): Promise<any> {
  const res = await fetch(url, { headers: { "User-Agent": UA }, cache: "no-store", signal: AbortSignal.timeout(12_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const value = (claims: any, p: string): any => {
  for (const c of claims?.[p] || []) {
    // Preferred or normal rank; a deprecated value is a known error.
    if (c?.rank === "deprecated") continue;
    const v = c?.mainsnak?.datavalue?.value;
    if (v !== undefined && v !== null) return v;
  }
  return null;
};
const itemId = (claims: any, p: string): string => {
  const v = value(claims, p);
  return v && typeof v === "object" && /^Q\d+$/.test(String(v.id)) ? String(v.id) : "";
};

// Fields of one Wikidata entity (no network). Pure; exported for tests.
export function parseEntity(e: any): Omit<Anchor, "wikiTitle" | "country" | "places"> & { countryId: string; locatedIn: string } {
  const c = e?.claims || {};
  const coord = value(c, "P625");
  const site = value(c, "P856");
  return {
    qid: String(e?.id || ""),
    label: String(e?.labels?.en?.value || ""),
    lat: coord && typeof coord.latitude === "number" ? coord.latitude : null,
    lon: coord && typeof coord.longitude === "number" ? coord.longitude : null,
    officialSite: typeof site === "string" && /^https?:\/\//i.test(site) ? site : "",
    image: typeof value(c, "P18") === "string" ? String(value(c, "P18")) : "",
    commonsCategory: typeof value(c, "P373") === "string" ? String(value(c, "P373")) : "",
    countryId: itemId(c, "P17"),
    locatedIn: itemId(c, "P131"),
  };
}

async function entities(ids: string[], props = "labels|claims"): Promise<Record<string, any>> {
  if (ids.length === 0) return {};
  const d = await jget(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&languages=en&props=${props}&ids=${ids.join("|")}`);
  return d?.entities || {};
}

// The Wikidata item of an English Wikipedia page.
export async function qidForTitle(title: string): Promise<{ qid: string; title: string } | null> {
  const d = await jget(
    `https://en.wikipedia.org/w/api.php?action=query&prop=pageprops&ppprop=wikibase_item&redirects=1&format=json&formatversion=2&titles=${encodeURIComponent(title)}`
  );
  const page = d?.query?.pages?.[0];
  const qid = page?.pageprops?.wikibase_item;
  return qid && /^Q\d+$/.test(qid) ? { qid, title: String(page.title) } : null;
}

// Anchor for an English Wikipedia page, or null when it has no Wikidata item
// or Wikidata can't be reached. `depth` is how far up "located in" to go.
export async function anchorForTitle(title: string, depth = 5): Promise<Anchor | null> {
  const hit = await qidForTitle(title).catch(() => null);
  if (!hit) return null;
  const ents = await entities([hit.qid]).catch(() => ({} as Record<string, any>));
  const e = ents[hit.qid];
  if (!e) return null;
  const base = parseEntity(e);
  // Country name and the "located in" chain (Sagrada Família -> Eixample -> Barcelona).
  const places: string[] = [];
  let country = "";
  let next = base.locatedIn;
  let first = true;
  const seen = new Set([hit.qid]);
  // The country is always looked up; the chain only `depth` levels up.
  for (let i = 0; i < Math.max(1, depth) && (next || (first && base.countryId)); i++) {
    if (depth === 0) next = "";
    const ids = [next, first ? base.countryId : ""].filter((x) => x && !seen.has(x));
    if (ids.length === 0) break;
    const got = await entities(ids).catch(() => ({} as Record<string, any>));
    if (first && base.countryId) country = String(got[base.countryId]?.labels?.en?.value || "");
    first = false;
    const p = next ? got[next] : null;
    if (!p) break;
    seen.add(next);
    const parsed = parseEntity(p);
    if (parsed.label && parsed.label !== country) places.push(parsed.label);
    next = parsed.locatedIn;
  }
  const { countryId: _c, locatedIn: _l, ...rest } = base;
  // The page title is the name people use ("Sagrada Família"); the Wikidata
  // label can be the formal one ("Basilica and Expiatory Church of the Holy Family").
  const label = hit.title.replace(/\s*\([^)]*\)$/, "") || rest.label;
  return { ...rest, label, wikiTitle: hit.title, country, places };
}

// Great-circle distance in km. Pure; exported for tests.
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

const fold = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

// One name per country, so "Czechia" and "Czech Republic" or "United States
// of America" and "USA" compare equal. Pure; exported for tests.
export function canonicalCountry(name: string): string {
  const n = fold(String(name || "")).replace(/^the /, "");
  if (!n) return "";
  if (n === "united states of america") return "united states";
  for (const [c, aliases] of Object.entries(COUNTRIES)) {
    if (fold(c) === n || aliases.some((a) => fold(a) === n)) return fold(c);
  }
  return n;
}

// Where a topic really belongs when its subject sits in another country than
// the one it was filed under: the nearest place in the "located in" chain
// that `isCity` accepts (a city the site knows), else the subject's country.
// Returns null when the filing is already right. Pure; exported for tests.
export function correctedDestination(
  anchor: Pick<Anchor, "country" | "places">,
  filedCountry: string,
  isCity: (name: string, country: string) => boolean
): { city: string; country: string } | null {
  if (!anchor.country || !filedCountry) return null;
  if (canonicalCountry(anchor.country) === canonicalCountry(filedCountry)) return null;
  const city = anchor.places.find((p) => isCity(p, anchor.country)) || "";
  return { city, country: anchor.country };
}
