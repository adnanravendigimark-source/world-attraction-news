// Track B3 — research for a blog topic. Reads Wikipedia, Wikivoyage and any
// pages the editor adds, keeps the passages that matter for the topic, and
// asks the model to extract cited facts grouped by subtopic. Facts that go
// out of date (prices, hours, tickets, entry rules) are flagged with the date
// they were read. Source text is used for facts only and never stored.

import { sql } from "../db";
import { fetchPageText, isPublicUrl } from "../news/extract";
import { chatJson } from "../news/aiClient";
import { researchModel } from "../news/research";
import { getTopic, type BlogTopic } from "./topics";

export const BLOG_RESEARCH_PROMPT_VERSION = "blog-research-2026-10-12";
const UA = "WorldAttractionNewsBot/1.0 (https://www.worldattractionnews.com; research)";
const PER_SOURCE = 6000;
const TOTAL = 26000;
export const MIN_FACTS = 12;

export const SUBTOPICS = ["places", "practical", "tickets", "seasons", "transport", "food", "history", "other"] as const;

export interface BlogSource {
  n: number;
  title: string;
  url: string;
  publisher: string;
  ok: boolean;
  chars: number;
  note: string;
}
export interface BlogFact {
  subtopic: string;
  claim: string;
  sources: number[];
  volatile: boolean; // prices, opening hours, tickets, entry rules: check before relying on it
}
export interface BlogResearch {
  id: string;
  topicId: string;
  status: "running" | "done" | "failed";
  model: string;
  facts: BlogFact[];
  sources: BlogSource[];
  error: string;
  createdAt: string;
  finishedAt: string | null;
}

// Words that make a passage useful for each kind of article.
const TYPE_WORDS: Record<string, string[]> = {
  best_time: ["climate", "weather", "season", "summer", "winter", "spring", "autumn", "month", "temperature", "rain", "festival", "crowd", "peak", "holiday"],
  food: ["cuisine", "dish", "food", "restaurant", "market", "wine", "eat", "speciality", "specialty", "cafe", "bakery", "trattoria"],
  tickets: ["ticket", "admission", "price", "entry", "opening", "hours", "booking", "reservation", "queue", "pass", "free", "€", "$"],
  history: ["history", "century", "founded", "war", "built", "empire", "republic", "medieval", "ancient", "renaissance", "dynasty"],
  attractions: ["museum", "cathedral", "palace", "church", "park", "square", "tower", "gallery", "monument", "landmark", "basilica", "castle"],
  things_to_do: ["museum", "walk", "tour", "beach", "park", "market", "view", "festival", "nightlife", "shopping", "hike", "district"],
  itinerary: ["district", "neighbourhood", "neighborhood", "day", "walk", "museum", "square", "station", "near", "minutes"],
  travel_guide: ["airport", "train", "bus", "metro", "transport", "stay", "district", "safety", "currency", "language", "climate", "museum"],
};

// Keeps the opening paragraphs and the paragraphs most about the topic.
export function pickPassages(text: string, topicWords: string[], budget = PER_SOURCE): string {
  const paras = String(text || "")
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 60 && !/^=+.*=+$/.test(p));
  if (paras.length === 0) return "";
  const words = topicWords.map((w) => w.toLowerCase());
  const score = (p: string) => {
    const l = p.toLowerCase();
    return words.reduce((n, w) => n + (l.includes(w) ? 1 : 0), 0);
  };
  const head = paras.slice(0, 3);
  const rest = paras
    .slice(3)
    .map((p, i) => ({ p, i, s: score(p) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i);
  const out: string[] = [];
  let used = 0;
  for (const p of [...head, ...rest.map((x) => x.p)]) {
    if (used + p.length > budget) continue;
    out.push(p);
    used += p.length;
  }
  return out.join("\n");
}

async function wikiExtract(host: string, title: string): Promise<{ title: string; url: string; text: string } | null> {
  const api = `https://${host}/w/api.php?action=query&prop=extracts&explaintext=1&redirects=1&format=json&formatversion=2&titles=${encodeURIComponent(title)}`;
  const res = await fetch(api, { headers: { "User-Agent": UA }, cache: "no-store", signal: AbortSignal.timeout(12_000) });
  if (!res.ok) return null;
  const d = await res.json();
  const page = d?.query?.pages?.[0];
  if (!page || page.missing || !page.extract) return null;
  return { title: page.title, url: `https://${host}/wiki/${encodeURIComponent(String(page.title).replace(/ /g, "_"))}`, text: String(page.extract) };
}

async function wikiSearch(host: string, q: string, limit = 3): Promise<string[]> {
  const api = `https://${host}/w/api.php?action=query&list=search&format=json&formatversion=2&srlimit=${limit}&srsearch=${encodeURIComponent(q)}`;
  const res = await fetch(api, { headers: { "User-Agent": UA }, cache: "no-store", signal: AbortSignal.timeout(12_000) }).catch(() => null);
  if (!res?.ok) return [];
  const d = await res.json();
  return (d?.query?.search || []).map((s: any) => String(s.title));
}

// Wikipedia searches that find the right background page for each kind of
// article ("Climate of Barcelona", "History of Florence").
export function topicQueries(type: string, dest: string, title: string): string[] {
  const q: Record<string, string[]> = {
    best_time: [`Climate of ${dest}`, `${dest} festivals`],
    history: [`History of ${dest}`],
    food: [`${dest} cuisine`, `cuisine of ${dest}`],
    attractions: [`Tourism in ${dest}`, `Culture of ${dest}`],
    things_to_do: [`Tourism in ${dest}`, `Culture of ${dest}`],
    itinerary: [`Tourism in ${dest}`, `Transport in ${dest}`],
    travel_guide: [`Tourism in ${dest}`, `Transport in ${dest}`],
    tickets: [title.replace(/\b(tickets?|how to book|guide|prices?)\b/gi, "").trim() || title],
  };
  // The topic title itself only for tickets (it names the attraction); for
  // other types it finds pages that merely share the city's name.
  return q[type] || [`Tourism in ${dest}`];
}

// Pages that share the destination's name but are not about travel.
const OFF_TOPIC = /^List of|\b(film|movie|F\.?C\.?|football|basketball|club|album|song|novel|band|TV series|season|video game|disambiguation|election|squad|players?)\b/i;
export function isOffTopicTitle(title: string): boolean {
  return OFF_TOPIC.test(title);
}

function destinationName(t: BlogTopic): string {
  return t.destination.split(",")[0].trim();
}

// Collects source text for the topic. Exported for tests with fetch mocked.
export async function gatherSources(topic: BlogTopic, extraUrls: string[] = []): Promise<{ sources: BlogSource[]; blocks: string[] }> {
  const dest = destinationName(topic);
  const words = [...(TYPE_WORDS[topic.topicType] || []), ...topic.title.toLowerCase().split(/\W+/).filter((w) => w.length > 3)];
  const sources: BlogSource[] = [];
  const blocks: string[] = [];
  let total = 0;
  const add = (title: string, url: string, publisher: string, text: string, note = "") => {
    const n = sources.length + 1;
    const body = pickPassages(text, words, Math.min(PER_SOURCE, TOTAL - total));
    const ok = body.length >= 300;
    sources.push({ n, title, url, publisher, ok, chars: body.length, note: ok ? note || "read" : note || "too little text" });
    if (ok) {
      blocks.push(`SOURCE ${n} — ${publisher}: ${title}\n${body}`);
      total += body.length;
    }
  };

  // Destination pages first: Wikivoyage (practical) and Wikipedia (background).
  const wanted: [string, string, string][] = [["en.wikivoyage.org", dest, "Wikivoyage"], ["en.wikipedia.org", dest, "Wikipedia"]];
  // Pages about the topic itself, e.g. "Uffizi" or "Tuscan cuisine".
  const seen = new Set([dest.toLowerCase()]);
  for (const q of topicQueries(topic.topicType, dest, topic.title)) {
    if (wanted.length >= 5) break;
    for (const t of await wikiSearch("en.wikipedia.org", q.slice(0, 200), 3)) {
      if (seen.has(t.toLowerCase()) || isOffTopicTitle(t)) continue;
      seen.add(t.toLowerCase());
      wanted.push(["en.wikipedia.org", t, "Wikipedia"]);
      break; // best match per query
    }
  }

  for (const [host, title, publisher] of wanted.slice(0, 5)) {
    if (total >= TOTAL) break;
    const page = await wikiExtract(host, title).catch(() => null);
    if (page) add(page.title, page.url, publisher, page.text);
    else sources.push({ n: sources.length + 1, title, url: `https://${host}/wiki/${encodeURIComponent(title)}`, publisher, ok: false, chars: 0, note: "not found" });
  }
  for (const url of extraUrls.slice(0, 5)) {
    if (total >= TOTAL) break;
    if (!isPublicUrl(url)) {
      sources.push({ n: sources.length + 1, title: url, url, publisher: "", ok: false, chars: 0, note: "not a public web address" });
      continue;
    }
    const page = await fetchPageText(url);
    const host = (() => {
      try {
        return new URL(page.finalUrl || url).hostname.replace(/^www\./, "");
      } catch {
        return "";
      }
    })();
    if (page.ok) add(page.title || url, page.finalUrl || url, host, page.text.replace(/\. /g, ".\n"));
    else sources.push({ n: sources.length + 1, title: url, url, publisher: host, ok: false, chars: 0, note: page.error || "could not read" });
  }
  return { sources, blocks };
}

const SYSTEM_PROMPT = `You are a careful research assistant for a travel website. Extract FACTS for one article from the numbered sources.
Rules:
- Use ONLY what the sources state. Never use outside knowledge, never guess. Paraphrase; never copy sentences.
- Each fact is one short, specific statement useful to a traveller (names, places, distances, months, temperatures, dishes, dates, how to get there, what it costs).
- sources: the numbers of the sources that state it.
- subtopic: one of places, practical, tickets, seasons, transport, food, history, other.
- volatile: true ONLY for things that can change and must be checked before visiting: prices, fees, opening hours, ticket and booking rules, entry or visa rules, timetables, temporary closures. Climate, weather, seasons, history, geography and descriptions of places are NOT volatile.
- Prefer facts relevant to the TOPIC; include background facts only when they help the article.
- Return 25 to 45 facts when the sources allow; fewer if they don't. Never pad.
Return JSON: {"facts":[{"subtopic","claim","sources","volatile"}]}`;

export function normalizeBlogFacts(raw: any, sourceNumbers: number[]): BlogFact[] {
  const valid = new Set(sourceNumbers);
  const out: BlogFact[] = [];
  const seen = new Set<string>();
  for (const f of Array.isArray(raw?.facts) ? raw.facts : []) {
    const claim = String(f?.claim || "").replace(/\s+/g, " ").trim();
    const src = (Array.isArray(f?.sources) ? f.sources : []).map(Number).filter((n: number) => valid.has(n));
    if (claim.length < 15 || src.length === 0) continue; // uncited facts are dropped
    const key = claim.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const subtopic = (SUBTOPICS as readonly string[]).includes(f?.subtopic) ? f.subtopic : "other";
    // Climate and history don't go out of date, whatever the model says.
    const volatile = !!f?.volatile && subtopic !== "seasons" && subtopic !== "history";
    out.push({ subtopic, claim: claim.slice(0, 400), sources: [...new Set<number>(src)], volatile });
  }
  return out;
}

function rowToResearch(r: any): BlogResearch {
  const iso = (v: any) => (v ? (v instanceof Date ? v.toISOString() : String(v)) : null);
  return {
    id: r.id,
    topicId: r.topic_id,
    status: r.status,
    model: r.model || "",
    facts: Array.isArray(r.facts) ? r.facts : [],
    sources: Array.isArray(r.sources) ? r.sources : [],
    error: r.error || "",
    createdAt: iso(r.created_at)!,
    finishedAt: iso(r.finished_at),
  };
}

export async function getLatestBlogResearch(topicId: string): Promise<BlogResearch | null> {
  const rows = await sql`SELECT * FROM blog_research WHERE topic_id = ${topicId} ORDER BY created_at DESC LIMIT 1`.catch(() => []);
  return rows[0] ? rowToResearch(rows[0]) : null;
}

export async function runBlogResearch(topicId: string, opts: { urls?: string[] } = {}): Promise<BlogResearch> {
  if (!process.env.OPENAI_API_KEY?.trim()) throw new Error("OPENAI_API_KEY is not set.");
  const topic = await getTopic(topicId);
  if (!topic) throw new Error("Topic not found.");
  const urls = [...new Set([...(opts.urls || []), ...((await topicUrls(topicId)) || [])].map((u) => u.trim()).filter(Boolean))];
  if (opts.urls?.length) await sql`UPDATE blog_topics SET source_urls = ${urls} WHERE id = ${topicId}`.catch(() => {});

  const model = researchModel();
  const id = (await sql`INSERT INTO blog_research (topic_id, status, model) VALUES (${topicId}, 'running', ${model}) RETURNING id`)[0].id as string;
  const fail = async (msg: string, sources: BlogSource[] = []) => {
    await sql`UPDATE blog_research SET status = 'failed', error = ${msg.slice(0, 500)}, sources = ${JSON.stringify(sources)}::jsonb, finished_at = now() WHERE id = ${id}`;
    return (await getLatestBlogResearch(topicId))!;
  };

  const { sources, blocks } = await gatherSources(topic, urls).catch(() => ({ sources: [] as BlogSource[], blocks: [] as string[] }));
  // Never write from model memory: no readable source, no AI call.
  if (blocks.length === 0) {
    return fail("No source could be read for this topic. Add a page about it (for example the official tourism site) and run research again.", sources);
  }
  let ai;
  try {
    ai = await chatJson({
      kind: "blog_research",
      log: { promptVersion: BLOG_RESEARCH_PROMPT_VERSION },
      model,
      temperature: 0.1,
      timeoutMs: 90_000,
      system: SYSTEM_PROMPT,
      user: `TOPIC: ${topic.title}\nDESTINATION: ${topic.destination}\nARTICLE TYPE: ${topic.topicType}${topic.angle ? `\nANGLE: ${topic.angle}` : ""}\n\n${blocks.join("\n\n---\n\n")}`,
    });
  } catch (err: any) {
    return fail(String(err?.message || err), sources);
  }
  const facts = normalizeBlogFacts(ai.json, sources.filter((s) => s.ok).map((s) => s.n));
  if (facts.length < MIN_FACTS) {
    return fail(`Research found only ${facts.length} cited facts (at least ${MIN_FACTS} are needed). Add a page about this topic and run research again.`, sources);
  }
  await sql`
    UPDATE blog_research SET status = 'done', facts = ${JSON.stringify(facts)}::jsonb, sources = ${JSON.stringify(sources)}::jsonb,
      tokens_in = ${ai.tokensIn}, tokens_out = ${ai.tokensOut}, finished_at = now()
    WHERE id = ${id}
  `;
  return (await getLatestBlogResearch(topicId))!;
}

async function topicUrls(topicId: string): Promise<string[]> {
  const r = (await sql`SELECT source_urls FROM blog_topics WHERE id = ${topicId}`.catch(() => []))[0] as any;
  return Array.isArray(r?.source_urls) ? r.source_urls : [];
}

// The fact list a blog article is checked against (Track B5), numbered F1…
export async function blogFactsText(articleId: string): Promise<string> {
  const t = (await sql`
    SELECT t.id, ci.name AS city, ci.country AS city_country, co.name AS country
    FROM blog_topics t LEFT JOIN cities ci ON ci.id = t.city_id LEFT JOIN countries co ON co.id = t.country_id
    WHERE t.article_id = ${articleId} LIMIT 1`.catch(() => []))[0] as any;
  if (!t) return "";
  // The destination's own names are given, not claims to check.
  const where = [t.city, t.city_country, t.country].filter(Boolean).join(", ");
  const r = await getLatestBlogResearch(String(t.id));
  if (!r || r.status !== "done" || r.facts.length === 0) return "";
  const src = r.sources.filter((s) => s.ok).map((s) => `[${s.n}] ${s.publisher}: ${s.title}`).join("\n");
  return `DESTINATION: ${where}\n\nSOURCES\n${src}\n\nFACTS\n${r.facts.map((f, i) => `F${i + 1} ${f.claim} [${f.sources.join(", ")}]${f.volatile ? " (check before visiting)" : ""}`).join("\n")}`;
}
