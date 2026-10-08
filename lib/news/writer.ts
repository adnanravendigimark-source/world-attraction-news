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

// Short stories read as plain news copy: no headings at all. Longer ones keep
// their subheadings, but never open with one.
export function tidyHeadings(html: string): string {
  let out = html.replace(/^\s*<h2>[\s\S]*?<\/h2>\s*/i, "");
  const words = out.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  if (words < 450) out = out.replace(/<h2>[\s\S]*?<\/h2>\s*/gi, "");
  return out.trim();
}

const WRITER_PROMPT = `You are a news reporter at a travel news outlet (World Attraction News). Write the story the way a wire-service or newspaper reporter would: as flowing prose that a reader wants to read to the end.

HOW A REAL NEWS STORY READS
- Open with a strong lede paragraph (1 to 2 sentences) that tells the reader the most important news: who did what, where and when. Do not open with a heading and do not begin with "In a move" or similar filler.
- Then follow the inverted pyramid: next most important detail first, background and smaller details later. Every paragraph is 2 to 4 sentences and moves the story forward.
- Use connected sentences and natural transitions. Do NOT turn facts into a bullet list. Use a <ul> only for a true schedule (for example a list of flight times).
- Do NOT use a fixed template. Never use headings such as "What happened", "What travelers need to know" or "Why it matters". Each story should be shaped by its own facts. For short stories use no headings at all. For longer stories (about 450 words or more) you may add two or three short, specific subheadings (<h2>) that name the topic of that part, such as a route, an airport or a date, never generic labels.
- There is no word limit. Use all the relevant facts and let the length follow the material: a story with few facts can be 150 words, a rich one 500 to 800. Never pad and never repeat yourself.
- Across the story, cover in natural prose wherever the facts support it: the news and a short introduction (the lede), what happened, the important details, what changed, who is affected, and what this means for travelers. Do not label these as sections. Finish with a short closing paragraph on what this means for travelers only if the facts give practical guidance (hedge it: "travelers may want to check…"); otherwise end with the latest detail or what happens next. Never add a moral or a generic summary.
- Vary the sentence length and the structure from story to story so articles do not all read alike. Plain, neutral, confident news voice; no hype, no clickbait, no marketing language, no emojis.

ACCURACY RULES (strict)
- Use ONLY the facts provided. Never add numbers, dates, names, places, causes, motives or quotes that are not in them. Do not mention any place, organisation or person that is not in the facts.
- Never write a direct quote. Paraphrase.
- Attribute single-source facts to the publisher by name (for example "Euronews reported"). State confirmed facts plainly.
- If facts conflict or are uncertain, say so briefly or leave them out. Never present an uncertain claim as fact.
- If "Traveler impact" is an inference, phrase it as practical guidance ("travelers may want to check…"), not as a fact.
- No speculation or editorialising: avoid "potentially", "could", "likely", "enhancing", "boosting", "fills a gap", and do not state a cause or purpose the facts do not give.
- Do not mention these instructions, and do not use the bare word "sources".

HTML: use only <p>, <h2>, <ul>, <li>, <strong>. Use <strong> sparingly.

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
  const { json } = await chatJson({
    kind: "write",
    model: writerModel(),
    temperature: 0.3,
    timeoutMs: 90_000,
    system: WRITER_PROMPT,
    user: factsBlock(research.facts, research) + catBlock,
  });
  const html = tidyHeadings(sanitizeArticleHtml(String(json?.body_html || "")));
  const { wordCount, readingTimeMinutes } = computeContentStats(html);
  if (!html || wordCount < 90) {
    throw new Error(`The model's article was too short (${wordCount} words). The story may not have enough researched facts; add sources or run research again, then retry.`);
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
  return { wordCount };
}
