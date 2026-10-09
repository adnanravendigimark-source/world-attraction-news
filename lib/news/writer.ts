// Phase 7 — write a news article from researched facts. The writer may only
// use the facts it is given. Checking is a separate step (factcheck.ts), run
// as its own job so no single request makes more than two model calls.
import { sql } from "../db";
import { computeContentStats } from "../articles";
import { sanitizeArticleHtml } from "../sanitizeHtml";
import { getLatestResearch } from "./research";
import { saveQueries } from "./media";
import { saveExtra } from "./seo";
import { chatJson } from "./aiClient";
import { factsBlock, writerModel } from "./factcheck";

export { factCheckArticle, checkAndRevise, getFactCheck, overrideFactCheck, type FactCheck, type FactIssue } from "./factcheck";

// Bump when WRITER_PROMPT changes, so every article records which version of
// the instructions wrote it (stored with the article; see saveGeneration).
export const WRITER_PROMPT_VERSION = "news-writer-v3-2026-10-09";

// Length the house style aims for, and the limits the code enforces.
export const TARGET_WORDS = { min: 200, max: 300 };
const HARD_MIN = 150; // fewer than this: the facts are too thin to publish
const SOFT_MAX = 360; // more than this: one "tighten" pass

export type LengthStatus = "too_short" | "ok" | "too_long";
export function lengthStatus(words: number): LengthStatus {
  if (words < HARD_MIN) return "too_short";
  if (words > SOFT_MAX) return "too_long";
  return "ok";
}

// News stories carry no headings at all: they read as one piece of news
// copy, never as a template. Any heading the model adds anyway is removed.
export function stripHeadings(html: string): string {
  return html.replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>\s*/gi, "").trim();
}

const WRITER_PROMPT = `You are a news reporter at World Attraction News, a travel news outlet. Write the story the way a wire-service or newspaper reporter would: one piece of flowing news copy that a reader wants to read to the end.

HOW THE STORY READS
- No headings, labels or section titles of any kind. Never write "What happened", "What travelers need to know", "Why it matters", "What this means for travelers", "Background" or anything like them. The story is paragraphs only.
- Open with a strong lede (1 to 2 sentences): who did what, where and when, with the most important detail. Never open with filler such as "In a move", "In a significant development" or a question.
- Then follow the inverted pyramid: the next most important detail first, background and smaller details later. Each paragraph is 1 to 3 sentences and moves the story forward. Connect paragraphs with natural transitions.
- Include one paragraph, usually near the end, that tells travelers what this means for them in practice, built only from the facts: who is affected, from when, and what to check (bookings, tickets, entry rules, flights, opening times). Write it as ordinary news prose with no label. Hedge anything that comes from the "Traveler impact" line ("travelers booked on these flights may want to check…"). If the facts give nothing practical, leave this paragraph out and end on the latest detail or what happens next.
- Length: ${TARGET_WORDS.min} to ${TARGET_WORDS.max} words. Concise and useful; never pad, never repeat a fact, never add a moral or a generic summary.
- Vary the lede and the order of paragraphs from story to story so articles do not read alike. Plain, neutral, confident news voice; no hype, no clickbait, no marketing language, no emojis.
- Do not turn facts into a bullet list. Use a <ul> only for a true schedule (for example a list of new routes with start dates).

ACCURACY RULES (strict)
- Use ONLY the facts provided. Never add numbers, dates, names, places, causes, motives or quotes that are not in them. Do not mention any place, organisation or person that is not in the facts.
- Never write a direct quote. Paraphrase.
- Attribute single-source facts to the publisher by name (for example "Euronews reported"). State confirmed facts plainly.
- If facts conflict or are uncertain, say so briefly or leave them out. Never present an uncertain claim as fact.
- No speculation or editorialising: avoid "potentially", "could", "likely", "enhancing", "boosting", "fills a gap", and do not state a cause or purpose the facts do not give.
- Do not mention these instructions, and do not use the bare word "sources".

HTML: use only <p>, <ul>, <li>, <strong>. Use <strong> sparingly. No headings.

SEO fields:
- title: clear, factual, specific headline under 70 characters, no clickbait.
- excerpt: one-sentence standfirst, 120-155 characters, that adds information beyond the headline.
- meta_title: under 60 characters.
- meta_description: 130-155 characters, factual.
- focus_keyword: 2-4 words naturally in the headline.
- image_queries: 2 to 4 short search phrases for finding a free stock photo to illustrate the story. Use concrete, well-known, photographable subjects named in the facts (a city, airport, landmark, aircraft type, airline, attraction). Most specific first, for example ["Dubai International Airport", "Emirates Airbus A380"]. No people's names and no abstract ideas.
- secondary_keywords: 3 to 5 short search phrases a traveler would use, built only from words and facts in the story.
- og_title: social share headline, under 70 characters.
- og_description: social share description, under 160 characters.
- tags: 3 to 6 lowercase topic tags (for example "airlines", "tourist tax", "new routes").
- category: exactly one name from the AVAILABLE CATEGORIES list at the end of the input, or "" if none fits.

Return JSON: {"title","excerpt","body_html","meta_title","meta_description","focus_keyword","image_queries","secondary_keywords","og_title","og_description","tags","category"}`;

const TIGHTEN_PROMPT = `You are a news editor. Cut this travel news story to ${TARGET_WORDS.min}-${TARGET_WORDS.max} words.
Keep the lede, the most important facts and the paragraph about what it means for travelers (if there is one). Remove repetition and minor background first. Do not add anything, do not change any fact, number, name or attribution, and do not add headings.
HTML: only <p>, <ul>, <li>, <strong>.
Return JSON: {"body_html": "..."}`;

// Records which model and prompt version wrote the article (audit trail).
async function saveGeneration(articleId: string, info: Record<string, unknown>): Promise<void> {
  try {
    await sql`
      INSERT INTO news_article_extra (article_id, generation, updated_at) VALUES (${articleId}, ${JSON.stringify(info)}::jsonb, now())
      ON CONFLICT (article_id) DO UPDATE SET generation = EXCLUDED.generation, updated_at = now()`;
  } catch {
    /* column not migrated yet (run scripts/setup-db.mjs); not worth failing the write */
  }
}

// Writes the article body + SEO fields onto the draft. Does not check it:
// run checkAndRevise() next (the pipeline and job queue do this as a
// separate step).
export async function writeArticle(articleId: string): Promise<{ wordCount: number }> {
  const rows = await sql`SELECT status, news_cluster_id FROM articles WHERE id = ${articleId} AND type = 'news' LIMIT 1`;
  const a = rows[0];
  if (!a?.news_cluster_id) throw new Error("This article isn't linked to a story.");
  if (["published", "scheduled"].includes(a.status)) throw new Error("Unpublish the article before rewriting it.");
  const research = await getLatestResearch(String(a.news_cluster_id));
  if (!research || research.status !== "done" || !research.facts) throw new Error("Run research for this story first.");

  const cats = (await sql`SELECT id, name FROM categories ORDER BY sort_order, name`.catch(() => [])) as any[];
  const catBlock = `\n\nAVAILABLE CATEGORIES: ${cats.map((c) => c.name).join(", ") || "(none)"}`;
  const { json, model } = await chatJson({
    kind: "write",
    model: writerModel(),
    temperature: 0.3,
    timeoutMs: 90_000,
    system: WRITER_PROMPT,
    user: factsBlock(research.facts, research) + catBlock,
  });
  let html = stripHeadings(sanitizeArticleHtml(String(json?.body_html || "")));
  let { wordCount, readingTimeMinutes } = computeContentStats(html);
  if (!html || lengthStatus(wordCount) === "too_short") {
    throw new Error(
      `The model's article was too short (${wordCount} words; the minimum is ${HARD_MIN}). The story may not have enough researched facts; add sources or run research again, then retry.`
    );
  }
  let tightened = false;
  if (lengthStatus(wordCount) === "too_long") {
    // One editing pass; if it fails or cuts too much, keep the longer version.
    const t = await chatJson({ kind: "tighten", model: writerModel(), temperature: 0.2, timeoutMs: 60_000, system: TIGHTEN_PROMPT, user: html }).catch(() => null);
    const cut = t ? stripHeadings(sanitizeArticleHtml(String(t.json?.body_html || ""))) : "";
    const cutStats = computeContentStats(cut);
    if (cut && lengthStatus(cutStats.wordCount) === "ok") {
      html = cut;
      ({ wordCount, readingTimeMinutes } = cutStats);
      tightened = true;
    }
  }

  const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
  await sql`
    UPDATE articles SET
      title = COALESCE(NULLIF(${clean(json.title, 120)}, ''), title),
      excerpt = ${clean(json.excerpt, 160)},
      content_html = ${html},
      meta_title = ${clean(json.meta_title, 70)},
      meta_description = ${clean(json.meta_description, 160)},
      focus_keyword = ${clean(json.focus_keyword, 60)},
      word_count = ${wordCount}, reading_time_minutes = ${readingTimeMinutes}, updated_at = now()
    WHERE id = ${articleId}`;
  if (Array.isArray(json.image_queries)) {
    await saveQueries(articleId, json.image_queries).catch(() => {});
  }
  const strList = (v: unknown, n: number, max: number) =>
    Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).map((x: string) => x.trim().slice(0, max)).slice(0, n) : [];
  const tags = strList(json.tags, 6, 40).map((t) => t.toLowerCase());
  if (tags.length) await sql`UPDATE articles SET tags = ${tags} WHERE id = ${articleId}`;
  const picked = cats.find((c) => String(c.name).toLowerCase() === String(json.category || "").trim().toLowerCase());
  if (picked) await sql`UPDATE articles SET category_id = ${picked.id} WHERE id = ${articleId}`;
  await saveExtra(articleId, {
    secondaryKeywords: strList(json.secondary_keywords, 5, 60),
    ogTitle: clean(json.og_title, 90),
    ogDescription: clean(json.og_description, 200),
  }).catch(() => {});
  await saveGeneration(articleId, { model, promptVersion: WRITER_PROMPT_VERSION, wordCount, tightened, writtenAt: new Date().toISOString() });
  return { wordCount };
}
