// Track B4 — long-form blog writing in small steps, each one model call, so
// no request runs into the time limit:
//   outline -> one call per section -> finish (intro, conclusion, FAQ, SEO)
// then the article is saved as a pending guide (origin ai_blog). Every step
// writes only from the topic's cited research facts.

import { sql } from "../db";
import { computeContentStats, generateUniqueSlug, getNewsAuthorId } from "../articles";
import { sanitizeArticleHtml } from "../sanitizeHtml";
import { chatJson } from "../news/aiClient";
import { blogModel, writerModel } from "../news/factcheck";
import { joinShortParagraphs } from "./paragraphs";
export { joinShortParagraphs };
import { getTopic, type BlogTopic } from "./topics";
import { getLatestBlogResearch, type BlogFact, type BlogResearch } from "./research";
import { cityPath, countryPath } from "../destinations";
import { saveExtra } from "../news/seo";
import { keywordPlacement } from "./quality";

export const BLOG_WRITER_PROMPT_VERSION = "blog-writer-v7-2026-11-06";

export interface OutlineSection {
  heading: string;
  intent: string;
  words: number;
  facts: number[]; // indexes into research.facts
  html?: string;
}
export interface BlogOutline {
  title: string;
  // SEO plan, decided before writing (search intent, keywords, questions).
  searchIntent?: string;
  primaryKeyword?: string;
  secondaryKeywords?: string[];
  questions?: string[];
  recommendedWords?: number;
  sections: OutlineSection[];
  intro?: string;
  conclusion?: string;
}

const ACCURACY = `ACCURACY RULES (strict)
- Use ONLY the numbered facts given. Never add names, numbers, prices, dates, places or claims that are not in them. If the facts don't cover something, leave it out.
- Facts marked [check before visiting] can change: present them with care ("at the time of writing", "check the official site before you go"). Never invent a current price or opening time.
- Never write a direct quote. Paraphrase in your own words; never copy source wording.
- No advice, tips or claims of your own (for example "use a money belt", "book early", "try the tapas") unless a fact says it.
- Plain, warm, useful travel-guide voice. Never use: vibrant, bustling, charm, charming, allure, rich heritage, rich history, must-see, iconic, hidden gem, breathtaking, stunning, unforgettable, nestled, boasts, tapestry, delve, plethora, captivating, fascinating, "whether you're", "something for everyone", "make the most of", "perfect way", "ideal way", "enhance your", "essential for", "key stop", "top destination". No emojis.
- Make each fact useful to a traveller: say what it means for their trip (what they will see, when to go, how to get there, what to plan for) when that follows directly from the fact. Don't invent opinions, rankings or reasons the facts don't give (no "the best", "essential", "a must").
- No filler: never end a section or paragraph with a summary or a generic encouragement.
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
  // A drafted topic stays drafted while one section is rewritten (B6).
  await sql`
    UPDATE blog_topics SET outline = ${JSON.stringify(outline)}::jsonb,
      status = CASE WHEN status = 'drafted' AND article_id IS NOT NULL THEN status ELSE ${status} END, updated_at = now()
    WHERE id = ${topicId}`;
}

// ------------------------------------------------------------------ outline

const OUTLINE_PROMPT = `You plan a long-form travel article (a guide, not news) from numbered research facts, written for people first and optimised for search.
First work out the SEO plan:
- search_intent: one sentence on what someone searching this topic wants to know or do.
- primary_keyword: the 2-5 word phrase people would type (for example "best time to visit Barcelona").
- secondary_keywords: 3 to 5 related phrases and variants.
- reader_questions: 4 to 6 questions searchers commonly ask about this topic that the facts can answer.
- recommended_words: the length that fully answers the intent without padding, given how much the facts cover (about 30 words per fact; never more than the MAX LENGTH).
Then make the outline:
- 4 to 8 sections with clear H2 headings that a traveller would scan for. Headings are plain and specific ("Weather in Barcelona by Season", "Getting Around"), not clever.
- For each section: intent (one sentence: what the reader learns), words (its share of the target length), and facts (the numbers of the facts it uses; every section needs at least 3; a fact may be used in only one section). Merge thin subjects into a neighbouring section rather than giving them their own.
- Use every fact somewhere: each fact number should appear in exactly one section (skip only facts that don't fit this topic at all). Leave out sections the facts can't support. Do not plan an introduction, conclusion or FAQ section; those are written separately.
- Cover the searcher's main questions; put the most searched-for answer first. The FIRST H2 must contain the primary keyword (or a close variant with the same main words), naturally.
- title: the H1 headline: contains the primary keyword near the start, specific, under 65 characters, no year, no clickbait.
If a SERIES PLAN is given, this article is one of a set about the same topic:
- Use PLANNED KEYWORD exactly as primary_keyword, and write for the stated INTENT and AUDIENCE.
- Keep to this article's own purpose (its NEED). Subjects that OTHER ARTICLES IN THE SERIES cover get at most a sentence here, never their own section.
Return JSON: {"title","search_intent","primary_keyword","secondary_keywords","reader_questions","recommended_words","sections":[{"heading","intent","words","facts"}]}`;

export const WORDS_PER_FACT = 30; // a fact explained for a traveller; the check no longer deletes wording hints
const MIN_GUIDE_WORDS = 500;

export function normalizeOutline(raw: any, factCount: number, targetWords: number, subtopics: string[] = []): BlogOutline {
  const used = new Set<number>();
  const planned: OutlineSection[] = [];
  for (const s of Array.isArray(raw?.sections) ? raw.sections : []) {
    const heading = tidyStyle(String(s?.heading || "").replace(/^#+\s*/, "").trim().slice(0, 100));
    if (!heading || /^(introduction|conclusion|faq|frequently asked)/i.test(heading)) continue;
    const facts = (Array.isArray(s?.facts) ? s.facts : [])
      .map(Number)
      .filter((n: number) => Number.isInteger(n) && n >= 0 && n < factCount && !used.has(n));
    facts.forEach((n: number) => used.add(n));
    planned.push({ heading, intent: String(s?.intent || "").slice(0, 300), words: Math.max(120, Math.round(Number(s?.words) || 0)), facts });
  }
  // The model sometimes cites too few facts for a section it planned well.
  // Rather than drop it, give it facts nobody used yet; only a section that
  // still has fewer than 2 is left out.
  const unused = Array.from({ length: factCount }, (_, i) => i).filter((i) => !used.has(i));
  for (const sec of planned) {
    while (sec.facts.length < 2 && unused.length) sec.facts.push(unused.shift()!);
  }
  const sections = planned.filter((sec) => sec.facts.length >= 2);
  // The model leaves facts out even when told to use them all (27 of 43 on
  // one guide), and the sections it did plan then get padded. Each fact it
  // skipped goes to the section that already holds most facts of the same
  // subtopic (weather facts to the weather section); a fact whose subtopic no
  // section has stays out.
  if (subtopics.length) {
    for (const f of unused.splice(0)) {
      const topic = subtopics[f];
      let best: OutlineSection | null = null;
      let bestCount = 0;
      for (const sec of sections) {
        const n = sec.facts.filter((x) => subtopics[x] === topic).length;
        if (n > bestCount) [best, bestCount] = [sec, n];
      }
      if (best) best.facts.push(f);
    }
  }
  if (sections.length < 3) {
    throw new Error(
      factCount < 12
        ? "Research has too few facts for a full article. Add a page about this topic as a source and run research again."
        : "The outline came back with too few sections. Click Generate again; if it repeats, add a page about the topic as a source."
    );
  }
  // Length follows the facts each section has: about WORDS_PER_FACT words per
  // fact is what survives the fact check (the Japan guide was planned at 45
  // per fact, 1530 words; after the check removed the padding, 579 were
  // left). Sections get their share by their facts, not by the model's
  // guess, so a 2-fact section is never asked for 170 words. The guide is at
  // least MIN_GUIDE_WORDS (the publish gate) and at most the topic's maximum.
  const recommended = Math.round(Number(raw?.recommended_words) || targetWords);
  const factWords = sections.reduce((n, s) => n + s.facts.length, 0) * WORDS_PER_FACT;
  const length = Math.max(MIN_GUIDE_WORDS, Math.min(recommended, Math.round(targetWords * 1.2), Math.round(factWords / 0.8)));
  const body = Math.round(length * 0.8); // intro and conclusion take the rest
  const factSum = sections.reduce((n, s) => n + s.facts.length, 0) || 1;
  for (const s of sections) s.words = Math.max(80, Math.round((s.facts.length / factSum) * body));
  const list = (v: any, n: number, max: number) =>
    (Array.isArray(v) ? v : []).map((x: any) => String(x || "").trim().slice(0, max)).filter(Boolean).slice(0, n);
  return {
    title: tidyStyle(String(raw?.title || "").trim().slice(0, 120)),
    searchIntent: String(raw?.search_intent || "").trim().slice(0, 300),
    primaryKeyword: String(raw?.primary_keyword || "").trim().toLowerCase().slice(0, 80),
    secondaryKeywords: list(raw?.secondary_keywords, 5, 80).map((k) => k.toLowerCase()),
    questions: list(raw?.reader_questions, 6, 200),
    recommendedWords: length,
    sections: sections.slice(0, 8),
  };
}

// Extra input for an article that belongs to a topic cluster.
export function seriesBrief(topic: Pick<BlogTopic, "plan">, siblings: { title: string; need: string; role: string }[]): string {
  const p = topic.plan;
  if (!p) return "";
  const lines = [
    "SERIES PLAN",
    `ROLE: ${p.role === "pillar" ? "main guide (covers the topic comprehensively)" : "supporting article"}`,
    `NEED: ${p.need}`,
    `PLANNED KEYWORD: ${p.primaryKeyword}`,
    p.secondaryKeywords.length ? `RELATED KEYWORDS: ${p.secondaryKeywords.join("; ")}` : "",
    `INTENT: ${p.intent}`,
    p.audience ? `AUDIENCE: ${p.audience}` : "",
    siblings.length ? `OTHER ARTICLES IN THE SERIES:\n${siblings.map((x) => `- ${x.title} (${x.role === "pillar" ? "main guide" : x.need})`).join("\n")}` : "",
  ];
  return `\n\n${lines.filter(Boolean).join("\n")}`;
}

export async function outlineStep(topicId: string): Promise<BlogOutline> {
  const { topic, research } = await requireInputs(topicId);
  const siblings = topic.plan ? await import("./clusters").then((m) => m.clusterSiblings(topicId)).catch(() => []) : [];
  const { json } = await chatJson({
    kind: "blog_outline",
    log: { promptVersion: BLOG_WRITER_PROMPT_VERSION },
    model: blogModel(),
    fallbackModel: writerModel(),
    temperature: 0.3,
    timeoutMs: 60_000,
    system: OUTLINE_PROMPT,
    user: `TOPIC: ${topic.title}\nDESTINATION: ${topic.destination}\nTYPE: ${topic.topicType}\nMAX LENGTH: ${topic.targetWords} words${topic.angle ? `\nANGLE: ${topic.angle}` : ""}${seriesBrief(topic, siblings)}\n\nFACTS:\n${factLines(research.facts)}`,
  });
  const outline = normalizeOutline(json, research.facts.length, topic.targetWords, research.facts.map((f) => f.subtopic));
  // The cluster plan decides the keyword, so two articles never compete for one query.
  if (topic.plan?.primaryKeyword) outline.primaryKeyword = topic.plan.primaryKeyword;
  if (!outline.title) outline.title = topic.title;
  await saveOutline(topicId, outline);
  return outline;
}

// ------------------------------------------------------------------ sections

const SECTION_PROMPT = `You write ONE section of a travel guide, under a heading that is added separately.
- Use every fact given, each explained with useful detail for a traveller, in about the target number of words. Don't pad with general statements.
- Write connected paragraphs of 2-4 sentences that flow from one to the next; never a one-sentence paragraph. Use <h3> sub-headings only if the section covers several distinct places or items. Use a <ul> only for a real list of 3 or more places, dishes or tips.
- Start straight in; do not repeat the heading or introduce the article.
- KEYWORD (if given) at most once, only where it reads naturally. Never start a sentence with "When planning a trip", "When you plan" or "If you are planning".
- Readability: simple words, sentences under 22 words on average, one idea per paragraph. Use a <ul> when listing 3 or more places, dishes or tips.
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
    model: blogModel(),
    fallbackModel: writerModel(),
    temperature: 0.4,
    timeoutMs: 75_000,
    system: SECTION_PROMPT,
    user: `ARTICLE: ${outline.title} (${topic.destination})\nALL SECTIONS (you write the one marked ->):\n${others}\n\nSECTION: ${s.heading}\nWHAT THE READER LEARNS: ${s.intent}\nTARGET: about ${s.words} words${sectionKeyword(outline, index) ? `\nKEYWORD: ${sectionKeyword(outline, index)}` : ""}\n\nFACTS:\n${factLines(research.facts, s.facts)}`,
  });
  s.html = joinShortParagraphs(dropPlanningOpeners(sanitizeArticleHtml(stripTopHeading(String(json?.html || ""), s.heading))));
  // Too short: one more try that keeps the text and adds detail from the facts.
  if (computeContentStats(s.html).wordCount < s.words * 0.7) {
    const more = await chatJson({
      kind: "blog_section",
      log: { promptVersion: BLOG_WRITER_PROMPT_VERSION },
      model: blogModel(),
      fallbackModel: writerModel(),
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
    const longer = more ? joinShortParagraphs(dropPlanningOpeners(sanitizeArticleHtml(stripTopHeading(String(more.json?.html || ""), s.heading)))) : "";
    if (computeContentStats(longer).wordCount > computeContentStats(s.html).wordCount) s.html = longer;
  }
  await saveOutline(topicId, outline);
  return { index, words: computeContentStats(s.html).wordCount, remaining: outline.sections.filter((x) => !x.html).length };
}

// ------------------------------------------------------------------ finish

const FINISH_PROMPT = `You finish a travel guide whose sections are already written.
Write:
- intro_html: 1 or 2 short paragraphs (<p>). Open with the direct answer to the search intent (for example the best months and why), using the PRIMARY KEYWORD naturally in the first two sentences, then say what the guide covers. Never start with "This guide", "In this article" or a question. No heading.
- conclusion_html: one sentence, then a <ul> of the 2-3 key takeaways from the facts, then one short call-to-action sentence that helps the reader act (plan the trip, choose dates, check the official site for current prices or hours). No new facts, no heading. Never write "In conclusion" or "to sum up".
- faq: 4 to 6 questions, starting with the READER QUESTIONS the facts can answer, each answered in 1-3 sentences from the facts only.
- excerpt: one sentence, 120-155 characters, saying what the guide covers.
- meta_title: under 60 characters, starting with or containing the PRIMARY KEYWORD, compelling but accurate.
- meta_description: 130-155 characters, containing the PRIMARY KEYWORD and the main benefit for the reader.
- focus_keyword: the PRIMARY KEYWORD exactly. tags: 3 to 6 lowercase tags.
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
  // "a must-see for visitors" (a noun) reads "a highlight for visitors";
  // "a must-see museum" (before a noun) reads "a top museum".
  [/\bmust-see(?=\s*(?:[.,;:!?)]|$|\s+(?:for|in|on|at|when|if|and|or|during|while)\b))/gi, "highlight"],
  [/\bmust-see\b/gi, "top"],
  [/\ba rich tapestry of\b/gi, "a mix of"],
  [/\btapestry\b/gi, "mix"],
  [/\bunforgettable\b/gi, "memorable"],
  [/\bThis guide (covers|explores)\b/g, "Below we cover"],
];
// One keyword per section: the primary keyword in the first section, then
// one secondary keyword each, so no section repeats the same phrase (every
// section of the Paris guide opened with "When planning a trip to Paris").
export function sectionKeyword(outline: Pick<BlogOutline, "primaryKeyword" | "secondaryKeywords">, index: number): string {
  if (index === 0) return outline.primaryKeyword || "";
  const sec = outline.secondaryKeywords || [];
  return sec.length ? sec[(index - 1) % sec.length] : "";
}

// Removes the stock opener "When planning a trip to Paris, " (keeps the rest
// of the sentence, capitalised). Pure; exported for tests.
export function dropPlanningOpeners(html: string): string {
  return String(html || "").replace(
    /\b(When|If|As) (you(?:'re| are)? )?(planning|plan|plan to take|organi[sz]ing) (a|your) (trip|visit|holiday|vacation)( to [^,.]{2,40})?, (\w)/g,
    (_m, _a, _b, _c, _d, _e, _f, first: string) => first.toUpperCase()
  );
}

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

// Call to action at the end: more guides for the destination on this site.
async function destinationCta(topic: BlogTopic): Promise<string> {
  const row = (topic.cityId
    ? await sql`SELECT name, slug, country_slug FROM cities WHERE id = ${topic.cityId}`
    : topic.countryId
      ? await sql`SELECT name, slug, '' AS country_slug FROM countries WHERE id = ${topic.countryId}`
      : [])[0] as any;
  if (!row?.slug) return "";
  const path = topic.cityId ? cityPath(row.country_slug, row.slug) : countryPath(row.slug);
  return `\n<p class="guide-cta">Planning a trip? See all our <a href="${path}">${escapeHtml(String(row.name))} travel guides</a>.</p>`;
}

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
    model: blogModel(),
    fallbackModel: writerModel(),
    temperature: 0.3,
    timeoutMs: 75_000,
    system: FINISH_PROMPT,
    user: `ARTICLE: ${outline.title} (${topic.destination})\nSEARCH INTENT: ${outline.searchIntent || topic.title}\nPRIMARY KEYWORD: ${outline.primaryKeyword || topic.title}\nSECONDARY KEYWORDS: ${(outline.secondaryKeywords || []).join(", ")}\nREADER QUESTIONS:\n${(outline.questions || []).map((q) => `- ${q}`).join("\n")}\n\nSECTIONS:\n${body}\n\nFACTS:\n${factLines(research.facts)}`,
  });
  outline.intro = sanitizeArticleHtml(String(json?.intro_html || "").replace(/<h\d[^>]*>[\s\S]*?<\/h\d>/gi, ""));
  outline.conclusion = sanitizeArticleHtml(String(json?.conclusion_html || "").replace(/<h\d[^>]*>[\s\S]*?<\/h\d>/gi, ""));
  // On-page SEO: the primary keyword belongs in the opening. One small fix if it's missing.
  if (outline.primaryKeyword && keywordPlacement({ keyword: outline.primaryKeyword, title: "", html: outline.intro, metaDescription: "", slug: "" }).missing.includes("opening")) {
    const fix = await chatJson({
      kind: "blog_intro",
      log: { promptVersion: BLOG_WRITER_PROMPT_VERSION },
      model: blogModel(),
      fallbackModel: writerModel(),
      temperature: 0.2,
      timeoutMs: 45_000,
      system: `Rewrite this introduction so the exact phrase "${outline.primaryKeyword}" appears naturally in its first two sentences (capitalise it as normal prose). Change as little as possible; add no new facts. Return JSON: {"html"}`,
      user: outline.intro,
    }).catch(() => null);
    const fixed = fix ? sanitizeArticleHtml(String(fix.json?.html || "")) : "";
    if (fixed && fixed.length > outline.intro.length * 0.6) outline.intro = fixed;
  }
  const faq = (Array.isArray(json?.faq) ? json.faq : [])
    .map((f: any) => ({ q: clean(f?.q, 200), a: clean(f?.a, 600) }))
    .filter((f: any) => f.q && f.a)
    .slice(0, 6);
  const html = tidyStyle(assembleHtml(outline)) + (await destinationCta(topic));
  const { wordCount, readingTimeMinutes } = computeContentStats(html);
  const focus = clean(outline.primaryKeyword || json?.focus_keyword, 60);
  const tags = (Array.isArray(json?.tags) ? json.tags : []).map((t: any) => clean(t, 40).toLowerCase()).filter(Boolean).slice(0, 6);
  const authorId = await getNewsAuthorId();
  if (!authorId) throw new Error('The "World Attraction News" author is missing. Run `node scripts/setup-db.mjs`.');

  const existing = (await sql`SELECT article_id FROM blog_topics WHERE id = ${topicId}`)[0]?.article_id as string | null;
  let articleId = existing;
  const title = tidyStyle(outline.title || topic.title);
  if (articleId) {
    await sql`
      UPDATE articles SET title = ${title}, excerpt = ${clean(json?.excerpt, 200)}, content_html = ${html}, faq = ${JSON.stringify(faq)}::jsonb,
        meta_title = ${clean(json?.meta_title, 70)}, meta_description = ${clean(json?.meta_description, 170)},
        focus_keyword = ${focus}, tags = ${tags}, word_count = ${wordCount},
        reading_time_minutes = ${readingTimeMinutes}, updated_at = now()
      WHERE id = ${articleId} AND status NOT IN ('published', 'scheduled')
    `;
  } else {
    // Short, keyword-based URL ("best-time-to-visit-barcelona"), not the full headline.
    const slug = await blogSlug(outline.primaryKeyword || title, topic.cityId);
    const rows = await sql`
      INSERT INTO articles (slug, title, excerpt, content_html, type, origin, city_id, country_id, author_id, status, faq,
        meta_title, meta_description, focus_keyword, tags, word_count, reading_time_minutes, submitted_at, updated_at)
      VALUES (${slug}, ${title}, ${clean(json?.excerpt, 200)}, ${html}, 'guide', 'ai_blog', ${topic.cityId}, ${topic.countryId}, ${authorId},
        'pending', ${JSON.stringify(faq)}::jsonb, ${clean(json?.meta_title, 70)}, ${clean(json?.meta_description, 170)},
        ${focus}, ${tags}, ${wordCount}, ${readingTimeMinutes}, now(), now())
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
  // Secondary keywords and social titles, as for news SEO.
  await saveExtra(articleId!, { secondaryKeywords: outline.secondaryKeywords || [], ogTitle: clean(json?.meta_title, 90), ogDescription: clean(json?.meta_description, 200) }).catch(() => {});
  return { articleId: articleId!, adminUrl: `/admin/articles/${articleId}`, wordCount };
}

// Starts over: clears the outline (the draft article, if any, is kept and updated).
export async function resetOutline(topicId: string): Promise<void> {
  await sql`UPDATE blog_topics SET outline = NULL, status = 'queued', updated_at = now() WHERE id = ${topicId} AND status <> 'drafted'`;
}

// ------------------------------------------------------- regenerate (B6)

// Replaces the text of one section in the saved article (between its <h2> and
// the next one), keeping that section's photo, then re-checks the facts.
export function replaceSection(html: string, index: number, newHtml: string, conclusion = ""): string {
  const heads = [...html.matchAll(/<h2[^>]*>[\s\S]*?<\/h2>/gi)];
  const h = heads[index];
  if (!h) throw new Error("That section isn't in the article any more.");
  const start = h.index! + h[0].length;
  let end = heads[index + 1]?.index ?? html.length;
  if (index === heads.length - 1 && conclusion) {
    const at = html.lastIndexOf(conclusion.slice(0, 60));
    if (at > start) end = at;
  }
  const old = html.slice(start, end);
  const figure = (old.match(/<figure class="news-figure"[\s\S]*?<\/figure>/i) || [""])[0];
  let body = newHtml;
  if (figure) {
    const close = body.indexOf("</p>");
    body = close >= 0 ? body.slice(0, close + 4) + figure + body.slice(close + 4) : body + figure;
  }
  return html.slice(0, start) + "\n" + body + "\n" + html.slice(end);
}

export async function regenerateSection(articleId: string, index: number): Promise<{ words: number }> {
  const t = (await sql`SELECT id FROM blog_topics WHERE article_id = ${articleId} LIMIT 1`)[0] as any;
  if (!t) throw new Error("This article wasn't made from a blog topic.");
  const a = (await sql`SELECT content_html, status FROM articles WHERE id = ${articleId} LIMIT 1`)[0] as any;
  if (["published", "scheduled"].includes(a?.status)) throw new Error("Unpublish the guide before rewriting a section.");
  await sectionStep(String(t.id), index);
  const outline = ((await sql`SELECT outline FROM blog_topics WHERE id = ${t.id}`)[0] as any).outline as BlogOutline;
  const html = tidyStyle(replaceSection(String(a.content_html || ""), index, outline.sections[index].html || "", outline.conclusion));
  const stats = computeContentStats(html);
  await sql`UPDATE articles SET content_html = ${html}, word_count = ${stats.wordCount}, reading_time_minutes = ${stats.readingTimeMinutes}, updated_at = now() WHERE id = ${articleId}`;
  const { recordAiRevision } = await import("../news/aiRevision");
  await recordAiRevision(articleId, `Section ${index + 1} rewritten: ${outline.sections[index].heading}`);
  return { words: computeContentStats(outline.sections[index].html || "").wordCount };
}

export async function blogPanelData(articleId: string) {
  const t = (await sql`SELECT id, title, outline FROM blog_topics WHERE article_id = ${articleId} LIMIT 1`.catch(() => []))[0] as any;
  if (!t) return null;
  const research = await getLatestBlogResearch(String(t.id));
  return {
    topicId: t.id as string,
    topic: t.title as string,
    sections: ((t.outline?.sections || []) as OutlineSection[]).map((s) => ({ heading: s.heading, words: s.words })),
    facts: research?.facts.length ?? 0,
    sources: research?.sources.filter((s) => s.ok).length ?? 0,
    toCheck: research?.facts.filter((f) => f.volatile).length ?? 0,
  };
}
