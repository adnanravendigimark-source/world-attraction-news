// Track B2 — the blog content plan. Topics are typed in by an editor or
// suggested by AI for a destination; each points at a city or a country and
// is flagged when the site already has a similar article.

import { sql } from "../db";
import { slugifyCountry } from "../countries";
import { resolveOrCreateCity } from "../cities";
import { loadGazetteer, resolvePlace } from "../news/places";
import { chatJson } from "../news/aiClient";
import { researchModel } from "../news/research";

export const TOPIC_TYPES = [
  { value: "travel_guide", label: "Travel guide", words: 1800 },
  { value: "things_to_do", label: "Things to do", words: 1500 },
  { value: "attractions", label: "Attractions", words: 1500 },
  { value: "itinerary", label: "Itinerary", words: 1500 },
  { value: "best_time", label: "Best time to visit", words: 1000 },
  { value: "food", label: "Food", words: 1200 },
  { value: "tickets", label: "Tickets", words: 1000 },
  { value: "history", label: "History", words: 1200 },
] as const;
export type TopicType = (typeof TOPIC_TYPES)[number]["value"];
export const TOPIC_STATUSES = ["suggested", "queued", "generating", "drafted", "dismissed"] as const;
export const SUGGEST_PROMPT_VERSION = "blog-suggest-2026-10-12";

export interface BlogTopic {
  id: string;
  title: string;
  angle: string;
  topicType: string;
  targetWords: number;
  cityId: string | null;
  countryId: string | null;
  destination: string; // "Florence, Italy" or "Italy"
  source: "manual" | "ai_suggested";
  status: string;
  similarTitle: string;
  articleId: string | null;
  articleStatus: string | null; // the draft's status in Articles (pending, published…)
  createdAt: string;
}

export const defaultWords = (type: string) => TOPIC_TYPES.find((t) => t.value === type)?.words ?? 1500;

// ---------------------------------------------------------------- duplicates

const STOP = new Set("a an and the of in on at to for from with by best top guide your how what when where is are things do visit travel".split(" "));
// Different words for the same intent count as one.
const INTENTS: [RegExp, string][] = [
  [/\b(best time to (visit|go)|when to (visit|go)|best season|best months?)\b/g, " zwhen "],
  [/\b(things to do|what to do|activities)\b/g, " zdo "],
  [/\b(where to eat|what to eat|food guide|places to eat|cuisine|dishes)\b/g, " zfood "],
  [/\b(tickets?|how to book|admission|entry fees?)\b/g, " zticket "],
  [/\b(itinerary|\d+ days? in|days? trip)\b/g, " zitinerary "],
];
export function topicTokens(title: string): Set<string> {
  let t = String(title || "").toLowerCase();
  for (const [re, tok] of INTENTS) t = t.replace(re, tok);
  return new Set(
    t
      .normalize("NFKD")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .map((w) => w.replace(/s$/, ""))
      .filter((w) => w.length > 2 && !STOP.has(w))
  );
}

// The most similar existing title, if it is close enough to call a duplicate.
export function findSimilar(title: string, existing: string[], min = 0.6): string {
  const a = topicTokens(title);
  if (a.size === 0) return "";
  let best = "";
  let bestScore = 0;
  for (const t of existing) {
    const b = topicTokens(t);
    if (b.size === 0) continue;
    // Same place, different intent (food vs things to do vs overall guide) is not a duplicate.
    const ia = [...a].filter((w) => w.startsWith("z")).sort().join();
    const ib = [...b].filter((w) => w.startsWith("z")).sort().join();
    if (ia !== ib) continue;
    let inter = 0;
    for (const w of a) if (b.has(w)) inter++;
    const score = inter / Math.min(a.size, b.size);
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return bestScore >= min ? best : "";
}

// Types a destination needs only one article of.
const SINGLE_TYPES = new Set(["travel_guide", "best_time", "tickets", "history", "itinerary"]);
async function sameTypeTitle(type: string, dest: { cityId: string | null; countryId: string | null }): Promise<string> {
  if (!SINGLE_TYPES.has(type)) return "";
  const row = (await sql`
    SELECT title FROM blog_topics
    WHERE topic_type = ${type} AND status <> 'dismissed'
      AND ((${dest.cityId}::uuid IS NOT NULL AND city_id = ${dest.cityId}) OR (${dest.countryId}::uuid IS NOT NULL AND country_id = ${dest.countryId}))
    ORDER BY created_at LIMIT 1
  `.catch(() => []))[0] as any;
  return row ? String(row.title) : "";
}

async function existingTitles(): Promise<string[]> {
  const a = (await sql`SELECT title FROM articles WHERE type = 'guide' AND status NOT IN ('rejected')`.catch(() => [])) as any[];
  const t = (await sql`SELECT title FROM blog_topics WHERE status <> 'dismissed'`.catch(() => [])) as any[];
  return [...a, ...t].map((r) => String(r.title));
}

// -------------------------------------------------------------- destinations

// A city (on the site, or a known city that is then added) or a country.
export async function resolveDestination(text: string): Promise<{ cityId: string | null; countryId: string | null; label: string }> {
  const name = String(text || "").trim();
  if (!name) throw new Error("Choose a destination (a city or a country).");
  const site = (await sql`SELECT id, name, country FROM cities WHERE lower(name) = lower(${name}) LIMIT 1`)[0];
  if (site) return { cityId: site.id, countryId: null, label: `${site.name}, ${site.country}` };
  const g = await loadGazetteer();
  const p = resolvePlace(name, g);
  const entry = p.known ? g.find((e) => e.key === p.key) : null;
  if (entry?.country) {
    const country = g.find((e) => e.key === entry.country);
    const city = await resolveOrCreateCity(entry.name, country?.name || "");
    return { cityId: city.id, countryId: null, label: `${city.name}, ${city.country}` };
  }
  const countryName = entry ? entry.name : "";
  const fromSite = (await sql`SELECT id, name FROM countries WHERE lower(name) = lower(${name}) LIMIT 1`)[0];
  if (fromSite) return { cityId: null, countryId: fromSite.id, label: fromSite.name };
  if (countryName) {
    const row = (await sql`
      INSERT INTO countries (slug, name) VALUES (${slugifyCountry(countryName)}, ${countryName})
      ON CONFLICT (slug) DO UPDATE SET name = countries.name RETURNING id, name
    `)[0];
    return { cityId: null, countryId: row.id, label: row.name };
  }
  throw new Error(`"${name}" isn't a city or country we know. Add it under Destinations first, or check the spelling.`);
}

// ----------------------------------------------------------------- reading

const SELECT = `
  SELECT t.*, ci.name AS city_name, ci.country AS city_country, co.name AS country_name, ar.status AS article_status
  FROM blog_topics t
  LEFT JOIN articles ar ON ar.id = t.article_id
  LEFT JOIN cities ci ON ci.id = t.city_id
  LEFT JOIN countries co ON co.id = t.country_id
`;

function rowToTopic(r: any): BlogTopic {
  return {
    id: r.id,
    title: r.title,
    angle: r.angle || "",
    topicType: r.topic_type,
    targetWords: Number(r.target_words) || 1500,
    cityId: r.city_id ?? null,
    countryId: r.country_id ?? null,
    destination: r.city_name ? `${r.city_name}, ${r.city_country}` : r.country_name || "",
    source: r.source,
    status: r.status,
    similarTitle: r.similar_title || "",
    articleId: r.article_id ?? null,
    articleStatus: r.article_status ?? null,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  };
}

export async function listTopics(): Promise<BlogTopic[]> {
  const rows = await sql(`${SELECT} WHERE t.status <> 'dismissed' ORDER BY t.created_at DESC LIMIT 300`, []);
  return rows.map(rowToTopic);
}

// ----------------------------------------------------------------- writing

export async function createTopic(input: {
  title: string;
  destination: string;
  angle?: string;
  topicType?: string;
  targetWords?: number;
  createdBy?: string;
}): Promise<BlogTopic> {
  const title = String(input.title || "").trim().slice(0, 200);
  if (title.length < 5) throw new Error("Write the topic as a short title, for example \"Best time to visit Florence\".");
  const type = TOPIC_TYPES.some((t) => t.value === input.topicType) ? String(input.topicType) : "travel_guide";
  const words = Math.min(Math.max(Math.round(Number(input.targetWords) || defaultWords(type)), 600), 3000);
  const dest = await resolveDestination(input.destination);
  const similar = (await sameTypeTitle(type, dest)) || findSimilar(title, await existingTitles());
  const rows = await sql`
    INSERT INTO blog_topics (title, angle, topic_type, target_words, city_id, country_id, source, status, similar_title, created_by)
    VALUES (${title}, ${String(input.angle || "").trim().slice(0, 300)}, ${type}, ${words}, ${dest.cityId}, ${dest.countryId},
            'manual', 'queued', ${similar}, ${input.createdBy || ""})
    RETURNING id
  `;
  return (await getTopic(rows[0].id))!;
}

export async function getTopic(id: string): Promise<BlogTopic | null> {
  const rows = await sql(`${SELECT} WHERE t.id = $1 LIMIT 1`, [id]);
  return rows[0] ? rowToTopic(rows[0]) : null;
}

export async function setTopicStatus(ids: string[], status: "queued" | "dismissed"): Promise<number> {
  const rows = await sql`
    UPDATE blog_topics SET status = ${status}, updated_at = now()
    WHERE id = ANY(${ids}::uuid[]) AND status IN ('suggested', 'queued')
    RETURNING id
  `;
  return rows.length;
}

// ----------------------------------------------------------------- suggest

const SUGGEST_PROMPT = `You plan evergreen travel articles for a travel website.
Suggest article topics for ONE destination. Each topic is something travellers search for and that can be answered with researched facts.
Rules:
- Mix the types: travel_guide, things_to_do, attractions, itinerary, best_time, food, tickets, history.
- Titles are specific, plain and search-friendly (for example "Best Time to Visit Florence: Weather, Crowds and Prices by Month"), under 75 characters, no clickbait, no years.
- angle: one sentence saying what the article covers and for whom.
- Do not repeat or closely rephrase any title in the EXISTING list.
Return JSON: {"topics":[{"title","angle","type"}]} with 10 topics.`;

export async function suggestTopics(destination: string, createdBy = ""): Promise<BlogTopic[]> {
  if (!process.env.OPENAI_API_KEY?.trim()) throw new Error("OPENAI_API_KEY is not set.");
  const dest = await resolveDestination(destination);
  const existing = await existingTitles();
  const { json } = await chatJson({
    kind: "suggest",
    log: { promptVersion: SUGGEST_PROMPT_VERSION },
    model: researchModel(),
    temperature: 0.7,
    timeoutMs: 45_000,
    system: SUGGEST_PROMPT,
    user: `DESTINATION: ${dest.label}\n\nEXISTING:\n${existing.slice(0, 80).map((t) => `- ${t}`).join("\n") || "(none)"}`,
  });
  const ideas: any[] = Array.isArray(json?.topics) ? json.topics : [];
  const seen = [...existing];
  const ids: string[] = [];
  for (const idea of ideas.slice(0, 12)) {
    const title = String(idea?.title || "").trim().slice(0, 200);
    if (title.length < 5) continue;
    const type = TOPIC_TYPES.some((t) => t.value === idea?.type) ? String(idea.type) : "travel_guide";
    const similar = (await sameTypeTitle(type, dest)) || findSimilar(title, seen);
    seen.push(title);
    const row = (await sql`
      INSERT INTO blog_topics (title, angle, topic_type, target_words, city_id, country_id, source, status, similar_title, created_by)
      VALUES (${title}, ${String(idea?.angle || "").trim().slice(0, 300)}, ${type}, ${defaultWords(type)}, ${dest.cityId}, ${dest.countryId},
              'ai_suggested', 'suggested', ${similar}, ${createdBy})
      RETURNING id
    `)[0];
    ids.push(row.id);
  }
  if (ids.length === 0) throw new Error("No topic ideas came back. Try again.");
  const rows = await sql(`${SELECT} WHERE t.id = ANY($1::uuid[]) ORDER BY t.created_at`, [ids]);
  return rows.map(rowToTopic);
}
