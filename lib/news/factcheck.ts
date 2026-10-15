// Phase 8 fact check (redesigned). Checks a news article against the
// story's researched facts and returns one of three verdicts:
//   passed        no problems found
//   needs_review  only hints (wording, names the rules couldn't place,
//                 minor over-statement) — an editor should look, publishing
//                 is allowed
//   failed        an unsupported number, or a claim the model checker marks
//                 as wrong/invented — publishing is blocked until fixed or
//                 an editor overrides with a reason
// The check stores a hash of the text it checked; when the text changes the
// check is stale and the publish gate asks for a new one.
import { sql } from "../db";
import { computeContentStats } from "../articles";
import { sanitizeArticleHtml } from "../sanitizeHtml";
import { getLatestResearch, isKnown, STATUS_LABEL, type ResearchFacts, type ResearchRecord } from "./research";
import { stripOurFigures } from "./media";
import { chatJson } from "./aiClient";
import { recordAiRevision } from "./aiRevision";

// Recorded with every check and revision call (ai_runs). Change them whenever
// CHECK_PROMPT or REVISE_PROMPT changes.
export const CHECK_PROMPT_VERSION = "news-check-2026-10-12";
export const REVISE_PROMPT_VERSION = "news-revise-2026-10-12";
import { contentHash } from "./contentHash";
import { dropFlagged, highlightLines, highlightsCheckHtml, highlightsFromRow, type NewsHighlights } from "./highlights";

export type Verdict = "passed" | "needs_review" | "failed";

export interface FactIssue {
  text: string;
  problem: string;
  severity: "high" | "low";
  origin: "rule" | "model";
}

export interface CheckedClaim {
  text: string;
  supported: boolean;
  facts: string[];
}

export interface FactCheck {
  verdict: Verdict;
  issues: FactIssue[];
  claims: CheckedClaim[];
  overridden: boolean;
  overrideReason: string;
  model: string;
  checkedAt: string;
  stale: boolean; // the article text changed after this check
}

export const checkModel = () => process.env.OPENAI_CHECK_MODEL?.trim() || "gpt-4o";
export const writerModel = () => process.env.OPENAI_WRITER_MODEL?.trim() || "gpt-4o";

// ---------------------------------------------------------------- facts text

// Facts are numbered (F1, F2…) so the checker can say which fact supports
// each sentence.
export function factsBlock(f: ResearchFacts, r: Pick<ResearchRecord, "sources">): string {
  const src = r.sources
    .map((s) => `[${s.n}] ${s.publisher}${s.official ? " (official)" : ""}${s.usedText ? "" : " (headline only)"}${s.publishedAt ? `, published ${s.publishedAt.slice(0, 10)}` : ""}`)
    .join("\n");
  let k = 0;
  const id = () => `F${++k}`;
  const lines = [
    `${id()} What happened: ${f.what_happened}`,
    `${id()} When: ${f.when}`,
    `${id()} Where: ${f.where}`,
    `${id()} Who is affected: ${f.who_is_affected}`,
    `${id()} What changed: ${f.what_changed}`,
    f.status && f.status !== "unclear" ? `${id()} Status: ${STATUS_LABEL[f.status]}` : "",
    isKnown(f.effective_from) ? `${id()} Takes effect: ${f.effective_from}` : "",
    isKnown(f.previous_situation) ? `${id()} Before this change: ${f.previous_situation}` : "",
    ...f.important_facts.map((x) => `${id()} Fact (${x.confidence}, sources ${x.sources.join(",")}): ${x.claim}`),
    ...f.confirmed_numbers.map((x) => `${id()} Number: ${x.value} — ${x.context} (sources ${x.sources.join(",")})`),
    ...f.uncertain_claims.map((x) => `${id()} Uncertain: ${x}`),
    ...f.conflicts.map((x) => `${id()} Conflict: ${x}`),
    isKnown(f.traveler_impact) ? `${id()} Traveler impact (editor inference, hedge it): ${f.traveler_impact}` : "",
  ].filter(Boolean);
  const links = officialLinks(r);
  const linkBlock = links.length ? `\n\nOFFICIAL LINKS (the only links you may add)\n${links.map((l) => `${l.name}: ${l.url}`).join("\n")}` : "";
  return `SOURCES\n${src}\n\nFACTS\n${lines.join("\n")}${linkBlock}`;
}

// Official pages among the story's sources (a government notice, airline,
// airport or tourism board). These are the only links the writer may add.
export function officialLinks(r: Pick<ResearchRecord, "sources">): { name: string; url: string }[] {
  const out: { name: string; url: string }[] = [];
  for (const s of r.sources) {
    if (!s.official || !/^https:\/\//i.test(s.url) || /news\.google\.com/i.test(s.url)) continue;
    if (!out.some((o) => o.url === s.url)) out.push({ name: s.publisher, url: s.url });
  }
  return out.slice(0, 3);
}

// Removes any link the model added that is not one of the allowed official
// pages (keeps the link text). Internal links are added later, by code.
export function keepAllowedLinks(html: string, allowed: string[]): string {
  const ok = new Set(allowed.map((u) => u.replace(/\/+$/, "")));
  return html.replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (m, href, text) =>
    ok.has(String(href).replace(/&amp;/g, "&").replace(/\/+$/, "")) ? `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>` : text
  );
}

// ------------------------------------------------------------- rule checks

function blocks(html: string): string[] {
  return html
    .split(/<\/(?:p|h[1-6]|li|blockquote|figcaption)>/i)
    .map((b) => b.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export function plain(html: string): string {
  return blocks(html).join("\n");
}

const normNum = (s: string) => s.replace(/[,\s]/g, "").replace(/\.$/, "").toLowerCase();

// Numbers, times and percentages in the article that appear nowhere in the
// facts. These are the one rule-based finding that fails a check: a wrong
// number is the most damaging error a news story can carry.
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

const SPECULATIVE =
  /\b(potentially|likely|could|may be|might|fills? the gap|filling (?:the|a) gap|enhanc\w+|boost\w*|expected to|set to improve|game[- ]chang\w+|significant\w*|major (?:boost|step)|exciting|surge|as a result|because of|due to|in response to|in the wake of|to fill)\b/gi;

// Speculative or causal wording. A phrase that also appears in the facts
// ("cancelled due to a strike") is fine and is not reported.
export function speculativeWording(articleHtml: string, factsText = ""): string[] {
  const hay = factsText.toLowerCase();
  const hits = plain(articleHtml).match(SPECULATIVE) || [];
  return [...new Set(hits.map((h) => h.toLowerCase()))].filter((h) => !hay.includes(h));
}

// Capitalised words that are generic parts of names ("Frankfurt Airport"),
// calendar words, or sentence furniture. They are never reported alone.
const GENERIC = new Set(
  (
    "what why the a an in on at for to of and or but it its this that these those he she they we you i with from by as is are was were be been will would " +
    "travelers travellers travel airport airports airline airlines air international terminal station museum park national city island beach hotel resort " +
    "tower palace cathedral square street river lake mountain north south east west central new old great royal grand upper lower " +
    "january february march april may june july august september october november december monday tuesday wednesday thursday friday saturday sunday"
  ).split(" ")
);

function nameKnown(word: string, hay: string): boolean {
  const lw = word.toLowerCase().replace(/['’]s$/, "");
  if (GENERIC.has(lw) || hay.includes(lw)) return true;
  // Adjective and plural forms of a stated name: European → Europe, Italian → Italy.
  for (const suffix of ["ean", "ian", "an", "ese", "ish", "i", "s"]) {
    if (lw.endsWith(suffix)) {
      const stem = lw.slice(0, -suffix.length);
      if (stem.length >= 4 && hay.includes(stem)) return true;
    }
  }
  return false;
}

// Capitalised names in the article that the facts never mention. The first
// word of every paragraph, heading and sentence is skipped.
export function unsupportedNames(articleHtml: string, factsText: string): string[] {
  const hay = factsText.toLowerCase();
  const bad = new Set<string>();
  for (const block of blocks(articleHtml)) {
    const re = /(?<![.!?:]\s)(?<!^)\b([A-Z][a-zA-Z'’-]{2,})\b/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(block))) if (!nameKnown(m[1], hay)) bad.add(m[1]);
  }
  return [...bad];
}

// Promotional wording a news story shouldn't carry.
const PROMOTIONAL =
  /\b(unique opportunity|once[- ]in[- ]a[- ]lifetime|unforgettable|breathtaking|stunning|must[- ]see|world[- ]class|iconic|amazing|incredible|perfect (?:time|way|place|opportunity)|ideal (?:time|way|place|opportunity)|bucket[- ]list|hidden gem|paradise|don'?t miss|relaxation)\b/gi;

export function promotionalWording(articleHtml: string, factsText = ""): string[] {
  const hay = factsText.toLowerCase();
  const hits = plain(articleHtml).match(PROMOTIONAL) || [];
  return [...new Set(hits.map((h) => h.toLowerCase()))].filter((h) => !hay.includes(h));
}

export function ruleIssues(html: string, facts: string): FactIssue[] {
  const issues: FactIssue[] = unsupportedNumbers(html, facts).map((n) => ({
    text: n,
    problem: "This number or time does not appear in the researched facts.",
    severity: "high" as const,
    origin: "rule" as const,
  }));
  for (const s of speculativeWording(html, facts)) {
    issues.push({ text: s, problem: "Speculative or causal wording that the facts don't state. Check it is supported.", severity: "low", origin: "rule" });
  }
  for (const s of promotionalWording(html, facts)) {
    issues.push({ text: s, problem: "Promotional wording. News copy should describe, not sell.", severity: "low", origin: "rule" });
  }
  for (const w of unsupportedNames(html, facts)) {
    issues.push({ text: w, problem: "This name isn't in the researched facts. Check it is correct and supported.", severity: "low", origin: "rule" });
  }
  return issues;
}

// The headline, standfirst and meta description must agree with the facts
// too. Rule checks only (no model call): numbers and names they mention.
export const HEADLINE_ISSUE = /^(headline|standfirst|SEO title|meta description): /;
export function headlineIssues(a: { title?: string; excerpt?: string; meta_title?: string; meta_description?: string }, facts: string): FactIssue[] {
  const parts: [string, string][] = [
    ["headline", a.title || ""],
    ["standfirst", a.excerpt || ""],
    ["SEO title", a.meta_title || ""],
    ["meta description", a.meta_description || ""],
  ];
  const out: FactIssue[] = [];
  for (const [where, text] of parts) {
    if (!text.trim()) continue;
    const html = `<p>${text}</p>`;
    for (const n of unsupportedNumbers(html, facts))
      out.push({ text: `${where}: ${text}`, problem: `The ${where} has "${n}", which is not in the researched facts. Edit the ${where}.`, severity: "high", origin: "rule" });
    for (const w of unsupportedNames(html, facts))
      out.push({ text: `${where}: ${text}`, problem: `The ${where} names "${w}", which is not in the researched facts. Check it.`, severity: "low", origin: "rule" });
  }
  return out;
}

export function verdictFor(issues: FactIssue[]): Verdict {
  if (issues.some((i) => i.severity === "high")) return "failed";
  if (issues.length > 0) return "needs_review";
  return "passed";
}

// ------------------------------------------------------------- model check

const CHECK_PROMPT = `You are a strict fact-checker for a travel news desk. Compare a news ARTICLE with the numbered FACTS it was written from.
Go through the article sentence by sentence. For every sentence that states a fact, return one claim:
- "supported": true when the facts state it (give the fact ids, e.g. ["F3","F7"]); false otherwise.
- For unsupported claims add "problem" (why) and "severity":
  - "high": a wrong or invented fact, number, date, name, place, rule or cause; a direct quote; a single-source or uncertain fact stated as certain without attribution.
  - "low": slightly stronger wording than the facts, or a harmless generalisation.
Rules: a cause or purpose ("because", "due to", "to boost") is supported only if a fact states it. Attribution to a publisher listed in SOURCES is fine. Hedged traveler guidance ("travelers may want to check…") based on the Traveler impact fact is supported.
Skip sentences that state no fact.
Return JSON: {"claims":[{"text":"exact sentence","supported":true,"facts":["F1"]},{"text":"...","supported":false,"facts":[],"problem":"...","severity":"high"}]}`;

export async function modelCheck(
  html: string,
  facts: string,
  log?: { articleId?: string; clusterId?: string | null }
): Promise<{ claims: CheckedClaim[]; issues: FactIssue[]; model: string }> {
  const { json, model } = await chatJson({
    kind: "check",
    log: { ...log, promptVersion: CHECK_PROMPT_VERSION },
    model: checkModel(),
    temperature: 0,
    timeoutMs: 75_000,
    system: CHECK_PROMPT,
    user: `FACTS\n${facts}\n\nARTICLE\n${plain(html)}`,
  });
  const claims: CheckedClaim[] = [];
  const issues: FactIssue[] = [];
  for (const c of Array.isArray(json?.claims) ? json.claims : []) {
    if (typeof c?.text !== "string" || !c.text.trim()) continue;
    const supported = c.supported === true;
    claims.push({
      text: c.text.slice(0, 400),
      supported,
      facts: Array.isArray(c.facts) ? c.facts.filter((x: unknown) => typeof x === "string").slice(0, 8) : [],
    });
    if (!supported) {
      issues.push({
        text: c.text.slice(0, 300),
        problem: typeof c.problem === "string" && c.problem ? c.problem.slice(0, 400) : "Not supported by the researched facts.",
        severity: c.severity === "low" ? "low" : "high",
        origin: "model",
      });
    }
  }
  return { claims: claims.slice(0, 80), issues, model };
}

// ---------------------------------------------------------------- storage

const VERDICT_ALIASES: Record<string, Verdict> = { pass: "passed", fail: "failed", passed: "passed", failed: "failed", needs_review: "needs_review" };

export async function getFactCheck(articleId: string): Promise<FactCheck | null> {
  try {
    const rows = await sql`
      SELECT c.verdict, c.issues, c.claims, c.overridden, c.override_reason, c.model, c.checked_at, c.content_hash, a.content_html,
             to_jsonb(a) -> 'key_updates' AS key_updates, to_jsonb(a) -> 'traveler_steps' AS traveler_steps
      FROM news_article_checks c JOIN articles a ON a.id = c.article_id
      WHERE c.article_id = ${articleId} LIMIT 1`;
    const r = rows[0];
    if (!r) return null;
    const issues: FactIssue[] = (r.issues || []).map((i: any) => ({ ...i, origin: i.origin === "rule" ? "rule" : "model" }));
    return {
      verdict: VERDICT_ALIASES[r.verdict] || "failed",
      issues,
      claims: r.claims || [],
      overridden: !!r.overridden,
      overrideReason: r.override_reason || "",
      model: r.model || "",
      checkedAt: new Date(r.checked_at).toISOString(),
      // Checks saved before hashes existed have no hash: treat as current.
      stale: !!r.content_hash && r.content_hash !== contentHash(String(r.content_html || ""), highlightLines(highlightsFromRow(r))),
    };
  } catch {
    return null;
  }
}

async function saveCheck(articleId: string, verdict: Verdict, issues: FactIssue[], claims: CheckedClaim[], model: string, hash: string) {
  await sql`
    INSERT INTO news_article_checks (article_id, verdict, issues, claims, overridden, override_reason, model, content_hash, checked_at)
    VALUES (${articleId}, ${verdict}, ${JSON.stringify(issues)}::jsonb, ${JSON.stringify(claims)}::jsonb, false, '', ${model}, ${hash}, now())
    ON CONFLICT (article_id) DO UPDATE SET verdict = EXCLUDED.verdict, issues = EXCLUDED.issues, claims = EXCLUDED.claims,
      overridden = false, override_reason = '', model = EXCLUDED.model, content_hash = EXCLUDED.content_hash, checked_at = now()`;
}

export async function overrideFactCheck(articleId: string, reason: string, by: string): Promise<void> {
  const why = reason.trim().slice(0, 500);
  if (why.length < 10) throw new Error("Give a short reason for the override (at least 10 characters).");
  await sql`UPDATE news_article_checks SET overridden = true, override_reason = ${`${why} (by ${by})`} WHERE article_id = ${articleId}`;
}

// AI blogs (Track B5) are checked against their topic's blog research.
async function loadBlogForCheck(articleId: string, a: any) {
  const { blogFactsText } = await import("../blogs/research");
  const facts = await blogFactsText(articleId);
  if (!facts) throw new Error("Run research for this blog's topic first.");
  // FAQ answers are claims too.
  const faq = (Array.isArray(a.faq) ? a.faq : []).map((f: any) => `<p>${f.q} ${f.a}</p>`).join("");
  // Headings name sections, they don't state facts.
  const body = String(a.content_html || "").replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, " ");
  return { article: { ...a, check_html: body + faq }, research: null, facts, blog: true };
}

async function loadForCheck(articleId: string): Promise<{ article: any; research: any; facts: string; blog?: boolean }> {
  const rows = await sql`SELECT content_html, news_cluster_id, status, type, origin, faq, title, excerpt, meta_title, meta_description,
    to_jsonb(articles) -> 'key_updates' AS key_updates, to_jsonb(articles) -> 'traveler_steps' AS traveler_steps
    FROM articles WHERE id = ${articleId} LIMIT 1`;
  if (rows[0] && rows[0].type !== "news" && rows[0].origin === "ai_blog") return loadBlogForCheck(articleId, rows[0]);
  const a = rows[0]?.type === "news" ? rows[0] : null;
  if (!a?.news_cluster_id) throw new Error("This article isn't linked to a researched story.");
  const research = await getLatestResearch(String(a.news_cluster_id));
  if (!research || research.status !== "done" || !research.facts) throw new Error("Run research for this story first.");
  // The Key Updates / What Travelers Should Do bullets are claims too.
  const boxes = highlightsCheckHtml(highlightsFromRow(a));
  return { article: boxes ? { ...a, check_html: String(a.content_html || "") + boxes } : a, research, facts: factsBlock(research.facts, research) };
}

// Checks the article's current text. Never changes the article.
export async function factCheckArticle(articleId: string): Promise<FactCheck> {
  const { article, facts } = await loadForCheck(articleId);
  const raw = String(article.content_html || "");
  const html = stripOurFigures(String(article.check_html ?? raw)); // photo captions aren't claims
  const rules = [...ruleIssues(html, facts), ...(article.type === "news" ? headlineIssues(article, facts) : [])];
  const m = await modelCheck(html, facts, { articleId, clusterId: article.news_cluster_id ? String(article.news_cluster_id) : null });
  const issues = [...rules, ...m.issues];
  await saveCheck(articleId, verdictFor(issues), issues, m.claims, m.model, contentHash(raw, highlightLines(highlightsFromRow(article))));
  return (await getFactCheck(articleId)) as FactCheck;
}

const REVISE_PROMPT = `You are revising a news article after a fact check. Fix ONLY the listed problems, using only the FACTS provided.
Remove or rewrite each flagged sentence so every claim, name, place and number is stated in the facts. Remove speculation and cause or purpose statements the facts don't give. Keep the rest of the article word for word, the same paragraphs (<p>, <ul>, <li>, <strong>, <a>; no headings), and a plain neutral tone. Do not add new content.
Return JSON: {"body_html": "..."}`;

const BLOG_REVISE_PROMPT = `You are revising a travel guide after a fact check. Fix ONLY the listed problems, using only the FACTS provided.
Remove or rewrite each flagged sentence so every claim, name, place and number is stated in the facts. Remove advice or tips the facts don't give. Keep everything else word for word, including every <h2> and <h3> heading, the paragraphs and lists (<p>, <h2>, <h3>, <ul>, <li>, <strong>, <a>). Do not add new content.
Return JSON: {"body_html": "..."}`;

// Checks, and if the check fails, makes one automatic revision of the
// failing sentences and checks again. Used right after the AI writes an
// article (pipeline step and job). Never touches a published article.
export async function checkAndRevise(articleId: string): Promise<{ check: FactCheck; revised: boolean; wordCount: number | null }> {
  let check = await factCheckArticle(articleId);
  if (check.verdict !== "failed") return { check, revised: false, wordCount: null };
  // News boxes: a bullet the check flags is removed (never rewritten).
  const boxes = await dropFlaggedHighlights(articleId, check);
  if (boxes.removed > 0 && boxes.onlyBoxIssues) {
    check = await factCheckArticle(articleId);
    return { check, revised: true, wordCount: null };
  }
  // Long guides get a second fixing round; news gets one.
  const first = await reviseOnce(articleId, check);
  if (!first.revised || first.check.verdict !== "failed" || !first.blog) return first.result;
  return (await reviseOnce(articleId, first.check)).result;
}

async function reviseOnce(articleId: string, check: FactCheck): Promise<{ revised: boolean; check: FactCheck; blog: boolean; result: { check: FactCheck; revised: boolean; wordCount: number | null } }> {

  const { article, facts, blog } = await loadForCheck(articleId);
  const none = { revised: false, check, blog: !!blog, result: { check, revised: false, wordCount: null } };
  if (["published", "scheduled"].includes(article.status)) return none;
  const current = stripOurFigures(String(article.content_html || ""));
  // Body sentences only: headline and meta problems are for the editor, and
  // problems with the news boxes are handled by dropFlaggedHighlights().
  const boxText = highlightLines(highlightsFromRow(article));
  const { boxIssues } = dropFlagged({ keyUpdates: boxText, travelerSteps: [] }, check.issues);
  const high = check.issues.filter((i) => i.severity === "high" && !HEADLINE_ISSUE.test(i.text) && !boxIssues.has(i.text));
  if (high.length === 0) return none;
  const { json } = await chatJson({
    kind: "revise",
    log: { articleId, promptVersion: REVISE_PROMPT_VERSION },
    model: writerModel(),
    temperature: 0.1,
    timeoutMs: 75_000,
    system: blog ? BLOG_REVISE_PROMPT : REVISE_PROMPT,
    user: `${facts}\n\nARTICLE HTML\n${current}\n\nPROBLEMS TO FIX\n${high.map((i) => `- "${i.text}": ${i.problem}`).join("\n")}`,
  });
  let revised = sanitizeArticleHtml(String(json?.body_html || "")).trim();
  // Guides keep their section photos through a fix.
  if (blog && revised) {
    const { sectionFigures, restoreFigures } = await import("../blogs/images");
    revised = restoreFigures(revised, sectionFigures(String(article.content_html || "")));
  }
  const stats = computeContentStats(revised);
  if (!revised || stats.wordCount < 90) return none;
  await sql`UPDATE articles SET content_html = ${revised}, word_count = ${stats.wordCount}, reading_time_minutes = ${stats.readingTimeMinutes}, updated_at = now() WHERE id = ${articleId}`;
  await recordAiRevision(articleId, `AI revised ${high.length} sentence(s) the fact check flagged (${writerModel()}, ${REVISE_PROMPT_VERSION})`);
  check = await factCheckArticle(articleId);
  return { revised: true, check, blog: !!blog, result: { check, revised: true, wordCount: stats.wordCount } };
}

// Removes Key Updates / What Travelers Should Do bullets that a failed check
// flagged. Unpublished drafts only, like the body reviser.
async function dropFlaggedHighlights(articleId: string, check: FactCheck): Promise<{ removed: number; onlyBoxIssues: boolean }> {
  const rows = await sql`SELECT status, to_jsonb(articles) -> 'key_updates' AS key_updates, to_jsonb(articles) -> 'traveler_steps' AS traveler_steps
    FROM articles WHERE id = ${articleId} AND type = 'news' LIMIT 1`;
  const a = rows[0];
  if (!a || ["published", "scheduled"].includes(a.status)) return { removed: 0, onlyBoxIssues: false };
  const { kept, removed, boxIssues } = dropFlagged(highlightsFromRow(a), check.issues);
  if (removed.length === 0) return { removed: 0, onlyBoxIssues: false };
  await saveHighlights(articleId, kept);
  await recordAiRevision(articleId, `Removed ${removed.length} Key Updates / What Travelers Should Do bullet(s) the fact check flagged`);
  const bodyIssues = check.issues.filter((i) => i.severity === "high" && !HEADLINE_ISSUE.test(i.text) && !boxIssues.has(i.text));
  return { removed: removed.length, onlyBoxIssues: bodyIssues.length === 0 };
}

export async function saveHighlights(articleId: string, h: NewsHighlights): Promise<void> {
  try {
    await sql`UPDATE articles SET key_updates = ${JSON.stringify(h.keyUpdates)}::jsonb, traveler_steps = ${JSON.stringify(h.travelerSteps)}::jsonb, updated_at = now()
      WHERE id = ${articleId}`;
  } catch (err: any) {
    if (/key_updates|traveler_steps/.test(String(err?.message))) throw new Error("A database update is needed: run `node scripts/setup-db.mjs`, then try again.");
    throw err;
  }
}
