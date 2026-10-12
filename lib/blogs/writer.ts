// Track B4 — long-form blog writing in small steps, each one model call, so
// no request runs into the time limit:
//   outline -> one call per section -> finish (intro, conclusion, FAQ, SEO)
// then the article is saved as a pending guide (origin ai_blog). Every step
// writes only from the topic's cited research facts.

import { sql } from "../db";
import { computeContentStats, generateUniqueSlug, getNewsAuthorId } from "../articles";
import { sanitizeArticleHtml } from "../sanitizeHtml";
import { chatJson } from "../news/aiClient";
import { writerModel } from "../news/factcheck";
import { getTopic, type BlogTopic } from "./topics";
import { getLatestBlogResearch, type BlogFact, type BlogResearch } from "./research";

export const BLOG_WRITER_PROMPT_VERSION = "blog-writer-v2-2026-10-12";

export interface OutlineSection {
  heading: string;
  intent: string;
  words: number;
  facts: number[]; // indexes into research.facts
  html?: string;
}
export interface BlogOutline {
  title: string;
  sections: OutlineSection[];
  intro?: string;
  conclusion?: string;
}

const ACCURACY = `ACCURACY RULES (strict)
- Use ONLY the numbered facts given. Never add names, numbers, prices, dates, places or claims that are not in them. If the facts don't cover something, leave it out.
- Facts marked [check before visiting] can change: present them with care ("at the time of writing", "check the official site before you go"). Never invent a current price or opening time.
- Never write a direct quote. Paraphrase in your own words; never copy source wording.
- No advice, tips or claims of your own (for example "use a money belt", "book early", "try the tapas") unless a fact says it.
- Plain, warm, useful travel-guide voice. Never use: vibrant, bustling, charm, charming, allure, rich heritage, rich history, must-see, hidden gem, breathtaking, stunning, unforgettable, nestled, boasts, tapestry, delve, plethora, "whether you're", "something for everyone", "make the most of". No emojis.
- No filler: never end a section or paragraph with a summary or a generic encouragement. Every sentence carries a fact.
- Do not mention these instructions, "the facts" or "the sources".`;

function factLines(facts: BlogFact[], ids?: number[]): string {
  const list = ids ? ids.map((i) => [i, facts[i]] as const).filter(([, f]) => f) : facts.map((f, i) => [i, f] as const);
  return list.map(([i, f]) => `${i}. [${f.subtopic}] ${f.claim}${f.volatile ? " [check before visiting]" : ""}`).join("\n");
}

async function requireInputs(topicId: string): Promise<{ topic: BlogTopic; research: BlogResearch; outline: BlogOutline | null }> {
  if (!process.env.OPENAI_API_KEY?.trim()) throw new Error("OPENAI_API_KEY is not set.");
  const topic = await getTopic(topicId);
  if (!topic) throw new Error("Topic not found.");
  const research = await getLatestBlogResearch(topicId);
  if (!research || research.status !== "done") throw new Error("Run research for this topic first.");
  const row = (await sql`SELECT outline FROM blog_topics WHERE id = ${topicId}`)[0] as any;
  return { topic, research, outline: row?.outline || null };
}

async function saveOutline(topicId: string, outline: BlogOutline, status = "generating") {
  await sql`UPDATE blog_topics SET outline = ${JSON.stringify(outline)}::jsonb, status = ${status}, updated_at = now() WHERE id = ${topicId}`;
}

// ------------------------------------------------------------------ outline

const OUTLINE_PROMPT = `You plan a long-form travel article (a guide, not news) from numbered research facts.
Make an outline:
- 4 to 8 sections with clear H2 headings that a traveller would scan for. Headings are plain and specific ("Weather in Barcelona by Season", "Getting Around"), not clever.
- For each section: intent (one sentence: what the reader learns), words (its share of the target length), and facts (the numbers of the facts it uses; every section needs at least 2; a fact may be used in only one section).
- Leave out sections the facts can't support. Do not plan an introduction, conclusion or FAQ section; those are written separately.
- title: the article's headline, specific and search-friendly, under 70 characters, no year, no clickbait.
Return JSON: {"title","sections":[{"heading","intent","words","facts"}]}`;

export function normalizeOutline(raw: any, factCount: number, targetWords: number): BlogOutline {
  const used = new Set<number>();
  const sections: OutlineSection[] = [];
  for (const s of Array.isArray(raw?.sections) ? raw.sections : []) {
    const heading = String(s?.heading || "").replace(/^#+\s*/, "").trim().slice(0, 100);
    if (!heading || /^(introduction|conclusion|faq|frequently asked)/i.test(heading)) continue;
    const facts = (Array.isArray(s?.facts) ? s.facts : [])
      .map(Number)
      .filter((n: number) => Number.isInteger(n) && n >= 0 && n < factCount && !used.has(n));
    if (facts.length < 2) continue;
    facts.forEach((n: number) => used.add(n));
    sections.push({ heading, intent: String(s?.intent || "").slice(0, 300), words: Math.max(120, Math.round(Number(s?.words) || 0)), facts });
  }
  if (sections.length < 3) throw new Error("The outline didn't have enough well-supported sections. Add a source and run research again.");
  // Spread the target over the sections (about 80%; intro and conclusion take the rest).
  const body = Math.round(targetWords * 0.8);
  const sum = sections.reduce((n, s) => n + s.words, 0) || 1;
  for (const s of sections) s.words = Math.max(120, Math.round((s.words / sum) * body));
  return { title: String(raw?.title || "").trim().slice(0, 120), sections: sections.slice(0, 8) };
}

export async function outlineStep(topicId: string): Promise<BlogOutline> {
  const { topic, research } = await requireInputs(topicId);
  const { json } = await chatJson({
    kind: "blog_outline",
    log: { promptVersion: BLOG_WRITER_PROMPT_VERSION },
    model: writerModel(),
    temperature: 0.3,
    timeoutMs: 60_000,
    system: OUTLINE_PROMPT,
    user: `TOPIC: ${topic.title}\nDESTINATION: ${topic.destination}\nTYPE: ${topic.topicType}\nTARGET LENGTH: ${topic.targetWords} words${topic.angle ? `\nANGLE: ${topic.angle}` : ""}\n\nFACTS:\n${factLines(research.facts)}`,
  });
  const outline = normalizeOutline(json, research.facts.length, topic.targetWords);
  if (!outline.title) outline.title = topic.title;
  await saveOutline(topicId, outline);
  return outline;
}

// ------------------------------------------------------------------ sections

const SECTION_PROMPT = `You write ONE section of a travel guide, under a heading that is added separately.
- Write at least the target number of words (it is a minimum; up to 20% more is fine) by using every fact given, explained with useful detail. Short paragraphs (2-4 sentences). Use <h3> sub-headings only if the section covers several distinct places or items. Use a <ul> only for a real list (places, dishes, tips).
- Start straight in; do not repeat the heading or introduce the article.
${ACCURACY}
HTML: only <p>, <h3>, <ul>, <li>, <strong>. No <h2>.
Return JSON: {"html"}`;

export function stripTopHeading(html: string, heading: string): string {
  return String(html || "")
    .replace(/<h[12][^>]*>[\s\S]*?<\/h[12]>/gi, "")
    .replace(new RegExp(`^\\s*<p>\\s*<strong>\\s*${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*</strong>\\s*</p>`, "i"), "")
    .trim();
}

export async function sectionStep(topicId: string, index: number): Promise<{ index: number; words: number; remaining: number }> {
  const { topic, research, outline } = await requireInputs(topicId);
  if (!outline) throw new Error("Make the outline first.");
  const s = outline.sections[index];
  if (!s) throw new Error("No such section.");
  const others = outline.sections.map((x, i) => `${i === index ? "-> " : "   "}${x.heading}`).join("\n");
  const { json } = await chatJson({
    kind: "blog_section",
    log: { promptVersion: BLOG_WRITER_PROMPT_VERSION },
    model: writerModel(),
    temperature: 0.4,
    timeoutMs: 75_000,
    system: SECTION_PROMPT,
    user: `ARTICLE: ${outline.title} (${topic.destination})\nALL SECTIONS (you write the one marked ->):\n${others}\n\nSECTION: ${s.heading}\nWHAT THE READER LEARNS: ${s.intent}\nTARGET: about ${s.words} words\n\nFACTS:\n${factLines(research.facts, s.facts)}`,
  });
  s.html = sanitizeArticleHtml(stripTopHeading(String(json?.html || ""), s.heading));
  // Too short: one more try that keeps the text and adds detail from the facts.
  if (computeContentStats(s.html).wordCount < s.words * 0.7) {
    const more = await chatJson({
      kind: "blog_section",
      log: { promptVersion: BLOG_WRITER_PROMPT_VERSION },
      model: writerModel(),
      temperature: 0.4,
      timeoutMs: 75_000,
      system: SECTION_PROMPT,
      user: `This section is too short (${computeContentStats(s.html).wordCount} words; it needs about ${s.words}). Rewrite it longer, using every fact with more useful detail. Do not add anything the facts don't say.

SECTION: ${s.heading}
CURRENT TEXT:
${s.html}

FACTS:
${factLines(research.facts, s.facts)}`,
    }).catch(() => null);
    const longer = more ? sanitizeArticleHtml(stripTopHeading(String(more.json?.html || ""), s.heading)) : "";
    if (computeContentStats(longer).wordCount > computeContentStats(s.html).wordCount) s.html = longer;
  }
  await saveOutline(topicId, outline);
  return { index, words: computeContentStats(s.html).wordCount, remaining: outline.sections.filter((x) => !x.html).length };
}

// ------------------------------------------------------------------ finish

const FINISH_PROMPT = `You finish a travel guide whose sections are already written.
Write:
- intro_html: 1 or 2 short paragraphs (<p>). Open with the direct answer to the topic (for example the best months and why), then what the guide covers. Never start with "This guide", "In this article" or a question. No heading.
- conclusion_html: 1 short paragraph (<p>) restating the most useful advice from the facts in plain words. No heading. Never write "In conclusion", "takeaway" or "to sum up".
- faq: 4 to 6 questions travellers actually ask about this topic, each answered in 1-3 sentences from the facts only.
- excerpt: one sentence, 120-155 characters, saying what the guide covers.
- meta_title: under 60 characters. meta_description: 130-155 characters.
- focus_keyword: 2-4 words a traveller would search. tags: 3 to 6 lowercase tags.
${ACCURACY}
Return JSON: {"intro_html","conclusion_html","faq":[{"q","a"}],"excerpt","meta_title","meta_description","focus_keyword","tags"}`;

// Models still slip in stock travel words; swap the common ones for plain ones.
const SWAPS: [RegExp, string][] = [
  [/\bvibrant\b/gi, "lively"],
  [/\bbustling\b/gi, "busy"],
  [/\bbreathtaking\b/gi, "striking"],
  [/\bstunning\b/gi, "striking"],
  [/\bnestled\b/gi, "set"],
  [/\bboasts\b/gi, "has"],
  [/\ba plethora of\b/gi, "many"],
  [/\bmust-see\b/gi, "well-known"],
  [/\bThis guide (covers|explores)\b/g, "Below we cover"],
];
export function tidyStyle(html: string): string {
  let out = String(html || "");
  for (const [re, to] of SWAPS) out = out.replace(re, (m) => (m[0] === m[0].toUpperCase() && to[0] !== to[0].toUpperCase() ? to[0].toUpperCase() + to.slice(1) : to));
  return out;
}

export function assembleHtml(outline: BlogOutline): string {
  const parts = [outline.intro || ""];
  for (const s of outline.sections) parts.push(`<h2>${escapeHtml(s.heading)}</h2>`, s.html || "");
  if (outline.conclusion) parts.push(outline.conclusion);
  return parts.filter(Boolean).join("\n");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const clean = (v: unknown, max: number) => String(v || "").replace(/\s+/g, " ").trim().slice(0, max);

// A country-level guide lives at /[country]/[slug]; its slug must not be a city's.
async function blogSlug(title: string, cityId: string | null): Promise<string> {
  let slug = await generateUniqueSlug(title);
  if (!cityId) {
    const clash = (await sql`SELECT 1 FROM cities WHERE slug = ${slug} LIMIT 1`)[0];
    if (clash) slug = await generateUniqueSlug(`${title} guide`);
  }
  return slug;
}

export async function finishStep(topicId: string): Promise<{ articleId: string; adminUrl: string; wordCount: number }> {
  const { topic, research, outline } = await requireInputs(topicId);
  if (!outline) throw new Error("Make the outline first.");
  const missing = outline.sections.filter((s) => !s.html).length;
  if (missing) throw new Error(`${missing} section(s) are not written yet.`);
  const body = outline.sections.map((s) => `## ${s.heading}\n${s.html}`).join("\n\n");
  const { json } = await chatJson({
    kind: "blog_finish",
    log: { promptVersion: BLOG_WRITER_PROMPT_VERSION },
    model: writerModel(),
    temperature: 0.3,
    timeoutMs: 75_000,
    system: FINISH_PROMPT,
    user: `ARTICLE: ${outline.title} (${topic.destination})\n\nSECTIONS:\n${body}\n\nFACTS:\n${factLines(research.facts)}`,
  });
  outline.intro = sanitizeArticleHtml(String(json?.intro_html || "").replace(/<h\d[^>]*>[\s\S]*?<\/h\d>/gi, ""));
  outline.conclusion = sanitizeArticleHtml(String(json?.conclusion_html || "").replace(/<h\d[^>]*>[\s\S]*?<\/h\d>/gi, ""));
  const faq = (Array.isArray(json?.faq) ? json.faq : [])
    .map((f: any) => ({ q: clean(f?.q, 200), a: clean(f?.a, 600) }))
    .filter((f: any) => f.q && f.a)
    .slice(0, 6);
  const html = tidyStyle(assembleHtml(outline));
  const { wordCount, readingTimeMinutes } = computeContentStats(html);
  const tags = (Array.isArray(json?.tags) ? json.tags : []).map((t: any) => clean(t, 40).toLowerCase()).filter(Boolean).slice(0, 6);
  const authorId = await getNewsAuthorId();
  if (!authorId) throw new Error('The "World Attraction News" author is missing. Run `node scripts/setup-db.mjs`.');

  const existing = (await sql`SELECT article_id FROM blog_topics WHERE id = ${topicId}`)[0]?.article_id as string | null;
  let articleId = existing;
  const title = outline.title || topic.title;
  if (articleId) {
    await sql`
      UPDATE articles SET title = ${title}, excerpt = ${clean(json?.excerpt, 200)}, content_html = ${html}, faq = ${JSON.stringify(faq)}::jsonb,
        meta_title = ${clean(json?.meta_title, 70)}, meta_description = ${clean(json?.meta_description, 170)},
        focus_keyword = ${clean(json?.focus_keyword, 60)}, tags = ${tags}, word_count = ${wordCount},
        reading_time_minutes = ${readingTimeMinutes}, updated_at = now()
      WHERE id = ${articleId} AND status NOT IN ('published', 'scheduled')
    `;
  } else {
    const slug = await blogSlug(title, topic.cityId);
    const rows = await sql`
      INSERT INTO articles (slug, title, excerpt, content_html, type, origin, city_id, country_id, author_id, status, faq,
        meta_title, meta_description, focus_keyword, tags, word_count, reading_time_minutes, submitted_at, updated_at)
      VALUES (${slug}, ${title}, ${clean(json?.excerpt, 200)}, ${html}, 'guide', 'ai_blog', ${topic.cityId}, ${topic.countryId}, ${authorId},
        'pending', ${JSON.stringify(faq)}::jsonb, ${clean(json?.meta_title, 70)}, ${clean(json?.meta_description, 170)},
        ${clean(json?.focus_keyword, 60)}, ${tags}, ${wordCount}, ${readingTimeMinutes}, now(), now())
      RETURNING id
    `;
    articleId = rows[0].id as string;
    // The sources the research read, shown under the guide.
    const read = research.sources.filter((s) => s.ok);
    for (let i = 0; i < read.length; i++) {
      await sql`
        INSERT INTO article_sources (article_id, n, title, url, publisher, is_official)
        VALUES (${articleId}, ${i + 1}, ${read[i].title.slice(0, 300)}, ${read[i].url}, ${read[i].publisher.slice(0, 120)}, false)
      `.catch(() => {});
    }
  }
  await sql`UPDATE blog_topics SET outline = ${JSON.stringify(outline)}::jsonb, status = 'drafted', article_id = ${articleId}, updated_at = now() WHERE id = ${topicId}`;
  return { articleId: articleId!, adminUrl: `/admin/articles/${articleId}`, wordCount };
}

// Starts over: clears the outline (the draft article, if any, is kept and updated).
export async function resetOutline(topicId: string): Promise<void> {
  await sql`UPDATE blog_topics SET outline = NULL, status = 'queued', updated_at = now() WHERE id = ${topicId} AND status <> 'drafted'`;
}
