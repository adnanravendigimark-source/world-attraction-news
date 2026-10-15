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
import { recordAiRevision } from "./aiRevision";
import { factsBlock, keepAllowedLinks, officialLinks, writerModel, saveHighlights } from "./factcheck";
import { cleanHighlights, MAX_KEY_UPDATES, MAX_TRAVELER_STEPS } from "./highlights";

export { factCheckArticle, checkAndRevise, getFactCheck, overrideFactCheck, type FactCheck, type FactIssue } from "./factcheck";

// Bump when WRITER_PROMPT changes, so every article records which version of
// the instructions wrote it (stored with the article; see saveGeneration).
export const WRITER_PROMPT_VERSION = "news-writer-v8-2026-10-15";

// Length the house style aims for, and the limits the code enforces.
export const TARGET_WORDS = { min: 200, max: 300 };
const HARD_MIN = 150; // fewer than this: the facts are too thin to publish
export const MIN_FACTS = 3; // fewer researched facts than this: don't try to write
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
- Early in the story make clear what is new: what changed compared with before (use the "Before this change" fact when given) and when it takes effect (the "Takes effect" fact).
- Respect the Status fact: something "proposed or planned" is written as a plan or proposal ("officials have proposed", "the airline plans to"), never as decided; something "confirmed, takes effect later" names the start date; never present an unconfirmed detail as confirmed.
- Include one paragraph, usually near the end, that tells travelers what this means for them in practice, built only from the facts: who is affected, from when, and what to check (bookings, tickets, entry rules, flights, opening times). Write it as ordinary news prose with no label. Hedge anything that comes from the "Traveler impact" line ("travelers booked on these flights may want to check…"). If the facts give nothing practical, leave this paragraph out and end on the latest detail or what happens next.
- End on the practical implication, the next confirmed step, or the official place to check. Never end with a generic summary or a moral.
- OFFICIAL LINKS: if the input lists any, link the most useful one once, where travelers would check details (usually the practical paragraph or the last sentence), as <a href="URL">the organisation's name or page</a>. Copy the URL exactly. Never add any other link and never invent a URL. If none are listed, add no links, and do not send readers to a news outlet for details: end on the next confirmed step instead (a decision date, a consultation deadline, a start date).
- Length: ${TARGET_WORDS.min} to ${TARGET_WORDS.max} words. Concise and useful; never pad, never repeat a fact, never add a moral or a generic summary.
- Vary the lede and the order of paragraphs from story to story so articles do not read alike. Plain, neutral, confident news voice; no hype, no clickbait, no emojis, and no marketing language (never "unique opportunity", "unforgettable", "stunning", "perfect for", "must-see", "a chance to relax"). Describe what happens; do not sell it.
- Do not turn facts into a bullet list. Use a <ul> only for a true schedule (for example a list of new routes with start dates).

ACCURACY RULES (strict)
- Use ONLY the facts provided. Never add numbers, dates, names, places, causes, motives or quotes that are not in them. Do not mention any place, organisation or person that is not in the facts.
- Never write a direct quote. Paraphrase.
- Attribute single-source facts to the publisher by name (for example "Euronews reported"). State confirmed facts plainly.
- If facts conflict or are uncertain, say so briefly or leave them out. Never present an uncertain claim as fact.
- Timing: say "on 10 October" or "this week" only when a fact or a source's publication date supports it; never guess a day.
- No speculation or editorialising: avoid "potentially", "could", "likely", "enhancing", "boosting", "fills a gap", and do not state a cause or purpose the facts do not give.
- Do not mention these instructions, and do not use the bare word "sources".
- Dates: the story is about what is new as of TODAY (given at the end of the input). A fact dated more than a year before today is background, not news: leave it out unless it is needed, and if you keep it, present it as background ("a levy in place since February 2024"), never as a new or recent change.

THE TWO BOXES BESIDE THE STORY (separate fields, not part of body_html)
These appear next to the story in their own panels, so they are lists, not prose. Same ACCURACY RULES as the story.
- key_updates: 3 to ${MAX_KEY_UPDATES} bullets with the most important facts of the story, most important first. One short sentence each, under 20 words, plain text (no HTML, no markers). Every name, number and date must be in the facts. A figure that only one publisher reported keeps a short attribution ("…, Gulf News reported"). No opinion, no advice, no repetition between bullets.
- traveler_steps: 2 to ${MAX_TRAVELER_STEPS} practical steps for travelers affected by this news, most useful first. Start each with a verb ("Check…", "Allow…", "Book…"), under 16 words, plain text. Each step must follow from the facts: who is affected, what changed, from when, and where to check. Name the official organisation or the airline only when the facts name it. Never invent a rule, fee, deadline, phone number, website or entitlement (no refunds or compensation unless the facts say so). Do not repeat a key update. If the news has no practical consequence for travelers, return [].

HTML: use only <p>, <ul>, <li>, <strong>, and <a> for an official link. Use <strong> sparingly. No headings.

SEO fields:
- focus_keyword: decide this first: the 2-4 word phrase a traveler would search for this news (for example "Bali tourist tax").
- title: clear, factual, specific headline under 70 characters that contains the focus keyword naturally and says what happened; no clickbait, no exaggeration, no question headlines.
- excerpt: one-sentence standfirst, 120-155 characters, that adds information beyond the headline. Same accuracy rules as the story: no "potentially", "significantly" or other hype.
- meta_title: under 60 characters, contains the focus keyword.
- meta_description: 130-155 characters (count them; never under 120), factual, contains the exact focus keyword once, says what changed and for whom. No keyword stuffing, no hype.
- image_queries: 2 to 4 short search phrases for finding a free stock photo to illustrate the story. Use concrete, well-known, photographable subjects named in the facts (a city, airport, landmark, aircraft type, airline, attraction). Most specific first, for example ["Dubai International Airport", "Emirates Airbus A380"]. No people's names and no abstract ideas.
- secondary_keywords: 3 to 5 short search phrases a traveler would use, built only from words and facts in the story.
- og_title: social share headline, under 70 characters.
- og_description: social share description, under 160 characters.
- tags: 3 to 6 lowercase topic tags (for example "airlines", "tourist tax", "new routes").

Return JSON: {"title","excerpt","body_html","key_updates","traveler_steps","meta_title","meta_description","focus_keyword","image_queries","secondary_keywords","og_title","og_description","tags"}`;

const TIGHTEN_PROMPT = `You are a news editor. Cut this travel news story to ${TARGET_WORDS.min}-${TARGET_WORDS.max} words.
Keep the lede, the most important facts and the paragraph about what it means for travelers (if there is one). Remove repetition and minor background first. Do not add anything, do not change any fact, number, name or attribution, and do not add headings.
Keep any <a> link exactly as it is.
HTML: only <p>, <ul>, <li>, <strong>, <a>.
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
  // Too little to write a story from: stop before paying for a model call.
  const factCount = research.facts.important_facts.length + research.facts.confirmed_numbers.length;
  if (factCount < MIN_FACTS) {
    const readable = research.sources.filter((s) => s.usedText).length;
    throw new Error(
      `Research found only ${factCount} fact(s) (${readable} of ${research.sources.length} source(s) could be read in full), not enough for a ${TARGET_WORDS.min}-${TARGET_WORDS.max} word story. ` +
        "Add a readable source (the original publisher, not a Google News link) and run research again."
    );
  }

  const catBlock = `\n\nTODAY: ${new Date().toISOString().slice(0, 10)}`;
  const { json, model } = await chatJson({
    kind: "write",
    log: { articleId, clusterId: String(a.news_cluster_id), promptVersion: WRITER_PROMPT_VERSION },
    model: writerModel(),
    temperature: 0.3,
    timeoutMs: 90_000,
    system: WRITER_PROMPT,
    user: factsBlock(research.facts, research) + catBlock,
  });
  const allowed = officialLinks(research).map((l) => l.url);
  let html = keepAllowedLinks(stripHeadings(sanitizeArticleHtml(String(json?.body_html || ""))), allowed);
  let { wordCount, readingTimeMinutes } = computeContentStats(html);
  if (!html || lengthStatus(wordCount) === "too_short") {
    throw new Error(
      `The model's article was too short (${wordCount} words; the minimum is ${HARD_MIN}). The story may not have enough researched facts; add sources or run research again, then retry.`
    );
  }
  let tightened = false;
  if (lengthStatus(wordCount) === "too_long") {
    // One editing pass; if it fails or cuts too much, keep the longer version.
    const t = await chatJson({ kind: "tighten", log: { articleId, promptVersion: WRITER_PROMPT_VERSION }, model: writerModel(), temperature: 0.2, timeoutMs: 60_000, system: TIGHTEN_PROMPT, user: html }).catch(() => null);
    const cut = t ? keepAllowedLinks(stripHeadings(sanitizeArticleHtml(String(t.json?.body_html || ""))), allowed) : "";
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
  // Key Updates / What Travelers Should Do; checked with the story next.
  await saveHighlights(articleId, cleanHighlights({ keyUpdates: json.key_updates, travelerSteps: json.traveler_steps })).catch(() => {});
  const strList = (v: unknown, n: number, max: number) =>
    Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).map((x: string) => x.trim().slice(0, max)).slice(0, n) : [];
  const tags = strList(json.tags, 6, 40).map((t) => t.toLowerCase());
  if (tags.length) await sql`UPDATE articles SET tags = ${tags} WHERE id = ${articleId}`;
  // Destination from the finished article (headline first).
  await import("./destination").then((m) => m.assignDestination(articleId)).catch(() => null);
  await saveExtra(articleId, {
    secondaryKeywords: strList(json.secondary_keywords, 5, 60),
    ogTitle: clean(json.og_title, 90),
    ogDescription: clean(json.og_description, 200),
  }).catch(() => {});
  await saveGeneration(articleId, { model, promptVersion: WRITER_PROMPT_VERSION, wordCount, tightened, writtenAt: new Date().toISOString() });
  await recordAiRevision(articleId, `AI wrote the article (${model}, ${WRITER_PROMPT_VERSION}, ${wordCount} words${tightened ? ", tightened" : ""})`);
  return { wordCount };
}

// For a story written before the boxes existed (or to redo them): writes
// only Key Updates / What Travelers Should Do from the researched facts and
// the current text, then fact-checks them; a bullet the check flags is
// removed. Leaves the story text untouched. Two model calls (write, check).
const HIGHLIGHTS_PROMPT_VERSION = "news-highlights-v1-2026-10-15";
const HIGHLIGHTS_PROMPT = `You prepare the two panels shown beside a travel news story at World Attraction News. Use ONLY the FACTS given and the STORY (which was written from them).
- key_updates: 3 to ${MAX_KEY_UPDATES} bullets with the most important facts, most important first. One short sentence each, under 20 words, plain text. Every name, number and date must be in the facts. A figure only one publisher reported keeps a short attribution ("…, Gulf News reported"). No opinion, no advice.
- traveler_steps: 2 to ${MAX_TRAVELER_STEPS} practical steps for travelers affected, most useful first. Start each with a verb, under 16 words, plain text. Each must follow from the facts. Name an organisation or airline only when the facts name it. Never invent a rule, fee, deadline, contact, website, refund or compensation. Do not repeat a key update. If there is no practical consequence for travelers, return [].
No quotes, no speculation ("could", "likely", "potentially"), no marketing language, no emojis.
Return JSON: {"key_updates": [...], "traveler_steps": [...]}`;

export async function writeHighlights(articleId: string): Promise<{ keyUpdates: number; travelerSteps: number; removed: number }> {
  const rows = await sql`SELECT status, news_cluster_id, title, content_html FROM articles WHERE id = ${articleId} AND type = 'news' LIMIT 1`;
  const a = rows[0];
  if (!a?.news_cluster_id) throw new Error("This article isn't linked to a researched story.");
  const research = await getLatestResearch(String(a.news_cluster_id));
  if (!research || research.status !== "done" || !research.facts) throw new Error("Run research for this story first.");
  const { json } = await chatJson({
    kind: "highlights",
    log: { articleId, clusterId: String(a.news_cluster_id), promptVersion: HIGHLIGHTS_PROMPT_VERSION },
    model: writerModel(),
    temperature: 0.2,
    timeoutMs: 60_000,
    system: HIGHLIGHTS_PROMPT,
    user: `${factsBlock(research.facts, research)}\n\nSTORY\nHeadline: ${a.title}\n${String(a.content_html || "")}\n\nTODAY: ${new Date().toISOString().slice(0, 10)}`,
  });
  const boxes = cleanHighlights({ keyUpdates: json?.key_updates, travelerSteps: json?.traveler_steps });
  await saveHighlights(articleId, boxes);
  // Check the new bullets with the story; drop any the check flags.
  const { factCheckArticle } = await import("./factcheck");
  const { dropFlagged } = await import("./highlights");
  const check = await factCheckArticle(articleId);
  const { kept, removed } = dropFlagged(boxes, check.issues);
  if (removed.length) {
    await saveHighlights(articleId, kept);
    await factCheckArticle(articleId);
  }
  await recordAiRevision(
    articleId,
    `AI wrote Key Updates / What Travelers Should Do (${writerModel()}, ${HIGHLIGHTS_PROMPT_VERSION})${removed.length ? `; fact check removed ${removed.length}` : ""}`
  );
  return { keyUpdates: kept.keyUpdates.length, travelerSteps: kept.travelerSteps.length, removed: removed.length };
}
