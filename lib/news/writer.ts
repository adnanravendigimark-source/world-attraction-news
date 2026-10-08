// Phases 7–8 — write and fact-check a news article from researched facts.
// The writer may only use the facts it is given. A separate pass then checks
// every claim in the finished article against those facts, and numbers/dates
// are verified mechanically (free) before the model check runs.
import { sql } from "../db";
import { computeContentStats } from "../articles";
import { sanitizeArticleHtml } from "../sanitizeHtml";
import { getLatestResearch, type ResearchFacts, type ResearchRecord } from "./research";
import { saveQueries, stripOurFigures } from "./media";
import { saveExtra } from "./seo";

export interface FactIssue {
  text: string;
  problem: string;
  severity: "high" | "low";
}
export interface FactCheck {
  verdict: "pass" | "fail";
  issues: FactIssue[];
  overridden: boolean;
  model: string;
  checkedAt: string;
}

// Prose quality matters most here, so the writer defaults to a stronger model than research.
const writerModel = () => process.env.OPENAI_WRITER_MODEL?.trim() || "gpt-4o";

// Short stories read as plain news copy: no headings at all. Longer ones keep
// their subheadings, but never open with one.
function tidyHeadings(html: string): string {
  let out = html.replace(/^\s*<h2>[\s\S]*?<\/h2>\s*/i, "");
  const words = out.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  if (words < 450) out = out.replace(/<h2>[\s\S]*?<\/h2>\s*/gi, "");
  return out.trim();
}

// The fact check is the safety net, so it defaults to a stronger model than the writer.
const checkModel = () => process.env.OPENAI_CHECK_MODEL?.trim() || "gpt-4o";

async function chatJson(system: string, user: string, temperature: number, modelName?: string): Promise<{ json: any; model: string }> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY is not set.");
  const model = modelName || writerModel();
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      temperature,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(45_000),
  });
  const body: any = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`OpenAI error: ${body?.error?.message || `HTTP ${res.status}`}`);
  try {
    return { json: JSON.parse(body?.choices?.[0]?.message?.content), model };
  } catch {
    throw new Error("The model returned an unreadable response.");
  }
}

// ---------------------------------------------------------------- facts text

function factsBlock(f: ResearchFacts, r: ResearchRecord): string {
  const src = r.sources.map((s) => `[${s.n}] ${s.publisher}${s.official ? " (official)" : ""}${s.usedText ? "" : " (headline only)"}`).join("\n");
  const lines = [
    `What happened: ${f.what_happened}`,
    `When: ${f.when}`,
    `Where: ${f.where}`,
    `Who is affected: ${f.who_is_affected}`,
    `What changed: ${f.what_changed}`,
    ...f.important_facts.map((x) => `Fact (${x.confidence}, sources ${x.sources.join(",")}): ${x.claim}`),
    ...f.confirmed_numbers.map((x) => `Number: ${x.value} — ${x.context} (sources ${x.sources.join(",")})`),
    ...f.uncertain_claims.map((x) => `Uncertain: ${x}`),
    ...f.conflicts.map((x) => `Conflict: ${x}`),
    f.traveler_impact && !/^not stated/i.test(f.traveler_impact) ? `Traveler impact (editor inference, hedge it): ${f.traveler_impact}` : "",
  ].filter(Boolean);
  return `SOURCES\n${src}\n\nFACTS\n${lines.join("\n")}`;
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

const CHECK_PROMPT = `You are a strict fact-checker. Compare a news ARTICLE against the FACTS it was written from.
List every claim in the article that is NOT supported by the facts, that goes beyond them, or that states an uncertain/single-source fact as certain without attribution.
- severity "high": a wrong or invented fact, number, date, name, place or cause; a direct quote; an unattributed uncertain claim.
- severity "low": slightly stronger wording than the facts, or harmless generalisation.
Be strict about: any place, organisation, person or aircraft not named in the facts; causal or purpose statements ("because", "to fill a gap", "enhancing", "boosting"); speculation ("potentially", "could", "likely"); and claims that go beyond what a fact literally says. Mark all of those "high".
Do not flag well-supported claims.
Return JSON: {"issues":[{"text":"exact snippet from the article","problem":"why it is unsupported","severity":"high"|"low"}]}. Empty array if all is supported.`;

const REVISE_PROMPT = `You are revising a news article after a fact check. Fix ONLY the listed problems, using only the FACTS provided.
Remove or rewrite each flagged sentence so every claim, name, place and number is stated in the facts. Remove speculation and purpose/cause statements. Keep the same structure (<h2>, <p>, <ul>, <li>), plain neutral tone, and do not add new unsupported content.
Return JSON: {"body_html": "..."}`;

// ------------------------------------------------------------- mechanical checks

function plain(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

const normNum = (s: string) => s.replace(/[,\s]/g, "").replace(/\.$/, "").toLowerCase();

// Numbers, times and percentages in the article that appear nowhere in the facts.
export function unsupportedNumbers(articleHtml: string, factsText: string): string[] {
  const hay = normNum(factsText);
  const found = plain(articleHtml).match(/\d[\d,.:]*\d%?|\d%?/g) || [];
  const bad = new Set<string>();
  for (const raw of found) {
    const n = normNum(raw);
    if (n.length < 2 && !raw.includes("%")) continue; // single digits ("2 daily") are too noisy
    if (!hay.includes(n)) bad.add(raw);
  }
  return [...bad];
}

const COMMON = new Set("what why the a an in on at for to of and or but it its this that these those he she they we you i with from by as is are was were be been will would travelers travellers travel emirates".split(" "));

const SPECULATIVE = /\b(potentially|likely|could|may be|might|fills? the gap|filling (the|a) gap|enhanc\w+|boost\w*|expected to|set to improve|game[- ]chang\w+|significant\w*|major (boost|step)|exciting|surge|as a result|because of|due to|in response to|in the wake of|to fill|following (?:the |an? |[A-Z]\w+['’]s ))\b/gi;

// Wording that signals speculation or editorialising, flagged without a model call.
export function speculativeWording(articleHtml: string): string[] {
  const hits = plain(articleHtml).match(SPECULATIVE) || [];
  return [...new Set(hits.map((h) => h.toLowerCase()))];
}

// Capitalised names (places, brands, people) in the article that never appear in the facts.
export function unsupportedNames(articleHtml: string, factsText: string): string[] {
  const hay = factsText.toLowerCase();
  const text = plain(articleHtml);
  const bad = new Set<string>();
  // Capitalised words that do not start a sentence/heading.
  const re = /(?<![.!?:]\s)(?<!^)\b([A-Z][a-zA-Z'’-]{2,})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const w = m[1];
    const lw = w.toLowerCase().replace(/['’]s$/, "");
    if (COMMON.has(lw)) continue;
    if (!hay.includes(lw)) bad.add(w);
  }
  return [...bad];
}

// ---------------------------------------------------------------- public API

export async function getFactCheck(articleId: string): Promise<FactCheck | null> {
  try {
    const rows = await sql`SELECT verdict, issues, overridden, model, checked_at FROM news_article_checks WHERE article_id = ${articleId} LIMIT 1`;
    const r = rows[0];
    if (!r) return null;
    return { verdict: r.verdict, issues: r.issues || [], overridden: !!r.overridden, model: r.model || "", checkedAt: new Date(r.checked_at).toISOString() };
  } catch {
    return null;
  }
}

async function saveCheck(articleId: string, verdict: string, issues: FactIssue[], model: string) {
  await sql`
    INSERT INTO news_article_checks (article_id, verdict, issues, overridden, model, checked_at)
    VALUES (${articleId}, ${verdict}, ${JSON.stringify(issues)}::jsonb, false, ${model}, now())
    ON CONFLICT (article_id) DO UPDATE SET verdict = EXCLUDED.verdict, issues = EXCLUDED.issues, overridden = false,
      model = EXCLUDED.model, checked_at = now()`;
}

export async function overrideFactCheck(articleId: string): Promise<void> {
  await sql`UPDATE news_article_checks SET overridden = true WHERE article_id = ${articleId}`;
}

// Fact-check the article's current text against the story's research.
export async function factCheckArticle(articleId: string): Promise<FactCheck> {
  const rows = await sql`SELECT content_html, news_cluster_id FROM articles WHERE id = ${articleId} AND type = 'news' LIMIT 1`;
  const a = rows[0];
  if (!a?.news_cluster_id) throw new Error("This article isn't linked to a researched story.");
  const research = await getLatestResearch(String(a.news_cluster_id));
  if (!research || research.status !== "done" || !research.facts) throw new Error("Run research for this story first.");
  const facts = factsBlock(research.facts, research);
  const html = stripOurFigures(String(a.content_html || "")); // photo captions aren't claims

  const issues: FactIssue[] = unsupportedNumbers(html, facts).map((n) => ({
    text: n,
    problem: "This number or time does not appear in the researched facts.",
    severity: "high" as const,
  }));
  for (const s of speculativeWording(html)) {
    issues.push({ text: s, problem: "Speculative or editorial wording. State only what the facts say.", severity: "high" });
  }
  for (const w of unsupportedNames(html, facts)) {
    issues.push({ text: w, problem: "This name does not appear in the researched facts.", severity: "high" });
  }
  const { json, model } = await chatJson(CHECK_PROMPT, `FACTS\n${facts}\n\nARTICLE\n${plain(html)}`, 0, checkModel());
  for (const i of Array.isArray(json?.issues) ? json.issues : []) {
    if (typeof i?.text !== "string" || typeof i?.problem !== "string") continue;
    issues.push({ text: i.text.slice(0, 300), problem: i.problem.slice(0, 400), severity: i.severity === "low" ? "low" : "high" });
  }
  const verdict = issues.some((i) => i.severity === "high") ? "fail" : "pass";
  await saveCheck(articleId, verdict, issues, model);
  return (await getFactCheck(articleId)) as FactCheck;
}

// Writes the article body + SEO fields onto the draft, then fact-checks it.
export async function writeArticle(articleId: string): Promise<{ wordCount: number; check: FactCheck }> {
  const rows = await sql`SELECT status, news_cluster_id FROM articles WHERE id = ${articleId} AND type = 'news' LIMIT 1`;
  const a = rows[0];
  if (!a?.news_cluster_id) throw new Error("This article isn't linked to a story.");
  if (["published", "scheduled"].includes(a.status)) throw new Error("Unpublish the article before rewriting it.");
  const research = await getLatestResearch(String(a.news_cluster_id));
  if (!research || research.status !== "done" || !research.facts) throw new Error("Run research for this story first.");

  const cats = (await sql`SELECT id, name FROM categories ORDER BY sort_order, name`.catch(() => [])) as any[];
  const catBlock = `\n\nAVAILABLE CATEGORIES: ${cats.map((c) => c.name).join(", ") || "(none)"}`;
  const { json } = await chatJson(WRITER_PROMPT, factsBlock(research.facts, research) + catBlock, 0.3);
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

  let check = await factCheckArticle(articleId);

  // One automatic revision: give the writer the checker's findings and re-check.
  if (check.verdict === "fail") {
    const high = check.issues.filter((i) => i.severity === "high");
    const { json: fixed } = await chatJson(
      REVISE_PROMPT,
      `${factsBlock(research.facts, research)}\n\nARTICLE HTML\n${html}\n\nPROBLEMS TO FIX\n${high.map((i) => `- "${i.text}": ${i.problem}`).join("\n")}`,
      0.1
    );
    const revised = tidyHeadings(sanitizeArticleHtml(String(fixed?.body_html || "")));
    const stats = computeContentStats(revised);
    if (revised && stats.wordCount >= 90) {
      await sql`UPDATE articles SET content_html = ${revised}, word_count = ${stats.wordCount}, reading_time_minutes = ${stats.readingTimeMinutes}, updated_at = now() WHERE id = ${articleId}`;
      check = await factCheckArticle(articleId);
      return { wordCount: stats.wordCount, check };
    }
  }
  return { wordCount, check };
}
