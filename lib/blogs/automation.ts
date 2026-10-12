// Track B7 — blogs at scale, without losing quality.
//  - Background writing: topics marked "auto" are written one step per call by
//    the 10-minute cron (research -> outline -> sections -> finish -> photos ->
//    links -> fact check), under a daily cap. Drafts stop at Pending Review.
//  - Core guides: five standard topics for a destination in one click.
//  - Refresh: published AI blogs are re-researched every N months; facts that
//    can change (prices, hours, tickets, rules) are compared and changes flagged.
//  - News ideas: a published news story can propose an evergreen blog topic.

import { sql } from "../db";
import { chatJson } from "../news/aiClient";
import { researchModel } from "../news/research";
import { checkAndRevise } from "../news/factcheck";
import { refreshLinks } from "../news/internalLinks";
import { createTopic, resolveDestination, topicTokens, findSimilar, defaultWords, getTopic } from "./topics";
import { getLatestBlogResearch, runBlogResearch, type BlogFact } from "./research";
import { finishStep, outlineStep, sectionStep } from "./writer";
import { ensureBlogImages } from "./images";

// ------------------------------------------------------------------ settings

export interface BlogSettings {
  perDay: number; // new AI blogs written in the background per day
  refreshMonths: number; // re-check published blogs after this many months
  newsIdeas: boolean; // propose blog topics from published news
}
export const DEFAULT_BLOG_SETTINGS: BlogSettings = { perDay: 3, refreshMonths: 6, newsIdeas: true };

export async function loadBlogSettings(): Promise<BlogSettings> {
  const r = (await sql`SELECT value FROM news_settings WHERE key = 'blogs' LIMIT 1`.catch(() => []))[0] as any;
  return { ...DEFAULT_BLOG_SETTINGS, ...(r?.value || {}) };
}

export async function saveBlogSettings(patch: Partial<BlogSettings>): Promise<BlogSettings> {
  const cur = await loadBlogSettings();
  const int = (v: unknown, lo: number, hi: number, d: number) => (Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Math.round(Number(v)))) : d);
  const next: BlogSettings = {
    perDay: int(patch.perDay, 0, 20, cur.perDay),
    refreshMonths: int(patch.refreshMonths, 1, 24, cur.refreshMonths),
    newsIdeas: typeof patch.newsIdeas === "boolean" ? patch.newsIdeas : cur.newsIdeas,
  };
  await sql`
    INSERT INTO news_settings (key, value, updated_at) VALUES ('blogs', ${JSON.stringify(next)}::jsonb, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
  return next;
}

export async function blogsWrittenToday(): Promise<number> {
  const r = (await sql`SELECT COUNT(*)::int AS n FROM articles WHERE origin = 'ai_blog' AND submitted_at > now() - interval '24 hours'`.catch(() => [{ n: 0 }]))[0] as any;
  return Number(r?.n ?? 0);
}

// -------------------------------------------------------------- core guides

export function coreGuideTitles(dest: string): { title: string; type: string }[] {
  return [
    { title: `${dest} Travel Guide`, type: "travel_guide" },
    { title: `Things to Do in ${dest}`, type: "things_to_do" },
    { title: `Best Time to Visit ${dest}`, type: "best_time" },
    { title: `Food in ${dest}: What to Eat and Where`, type: "food" },
    { title: `${dest} Itinerary: How to Spend 3 Days`, type: "itinerary" },
  ];
}

// Adds the five core topics a destination needs, skipping any it already has.
export async function planCoreGuides(destination: string, auto: boolean, by = ""): Promise<{ added: number; skipped: string[] }> {
  const dest = await resolveDestination(destination);
  const name = dest.label.split(",")[0].trim();
  let added = 0;
  const skipped: string[] = [];
  for (const g of coreGuideTitles(name)) {
    const t = await createTopic({ title: g.title, destination, topicType: g.type, targetWords: defaultWords(g.type), createdBy: by });
    if (t.similarTitle) {
      // Already covered: keep the plan clean.
      await sql`UPDATE blog_topics SET status = 'dismissed' WHERE id = ${t.id}`;
      skipped.push(g.title);
      continue;
    }
    if (auto) await sql`UPDATE blog_topics SET auto = true, auto_step = 'research', auto_error = '' WHERE id = ${t.id}`;
    added++;
  }
  return { added, skipped };
}

export async function setAuto(ids: string[], on: boolean): Promise<number> {
  const rows = await sql`
    UPDATE blog_topics SET auto = ${on}, auto_error = '', auto_step = CASE WHEN ${on} THEN COALESCE(NULLIF(auto_step, ''), 'research') ELSE auto_step END
    WHERE id = ANY(${ids}::uuid[]) AND status IN ('queued', 'generating')
    RETURNING id`;
  return rows.length;
}

// ------------------------------------------------------ background writing

// Runs the next step for one topic. Returns the step it ran ("" when done).
export async function advanceBlog(topicId: string): Promise<string> {
  const t = (await sql`SELECT id, status, auto_step, article_id, outline FROM blog_topics WHERE id = ${topicId}`)[0] as any;
  if (!t) return "";
  const fail = async (msg: string) => {
    await sql`UPDATE blog_topics SET auto = false, auto_error = ${msg.slice(0, 300)}, status = 'queued' WHERE id = ${topicId}`;
    return "failed";
  };
  try {
    const research = await getLatestBlogResearch(topicId);
    if (!research || research.status !== "done") {
      const r = await runBlogResearch(topicId);
      if (r.status !== "done") return fail(r.error || "Research failed.");
      return "research";
    }
    if (!t.article_id) {
      if (!t.outline) {
        await outlineStep(topicId);
        return "outline";
      }
      const missing = (t.outline.sections || []).findIndex((s: any) => !s.html);
      if (missing >= 0) {
        await sectionStep(topicId, missing);
        return `section ${missing + 1}`;
      }
      await finishStep(topicId);
      await sql`UPDATE blog_topics SET auto_step = 'images' WHERE id = ${topicId}`;
      return "finish";
    }
    const articleId = String(t.article_id);
    if (t.auto_step === "images") {
      await ensureBlogImages(articleId).catch(() => null);
      await sql`UPDATE blog_topics SET auto_step = 'links' WHERE id = ${topicId}`;
      return "images";
    }
    if (t.auto_step === "links") {
      await refreshLinks(articleId, "automation").catch(() => null);
      await sql`UPDATE blog_topics SET auto_step = 'check' WHERE id = ${topicId}`;
      return "links";
    }
    await checkAndRevise(articleId).catch(() => null);
    await sql`UPDATE blog_topics SET auto = false, auto_step = 'done' WHERE id = ${topicId}`;
    return "check";
  } catch (err: any) {
    return fail(String(err?.message || err));
  }
}

export async function runBlogAutomation(opts: { budgetMs?: number } = {}): Promise<{ steps: string[]; refreshed: number; ideas: number }> {
  const started = Date.now();
  const budget = opts.budgetMs ?? 150_000;
  const settings = await loadBlogSettings();
  const steps: string[] = [];
  // About 60 s per step at most: stop starting new ones near the limit.
  while (Date.now() - started < budget - 70_000) {
    const next = (await sql`
      SELECT id, article_id, outline FROM blog_topics
      WHERE auto = true AND status IN ('queued', 'generating', 'drafted')
      ORDER BY (article_id IS NOT NULL) DESC, (outline IS NOT NULL) DESC, created_at
      LIMIT 1`.catch(() => []))[0] as any;
    if (!next) break;
    // The daily cap applies when a new blog would be started.
    if (!next.article_id && !next.outline && (await blogsWrittenToday()) >= settings.perDay) break;
    steps.push(await advanceBlog(String(next.id)));
  }
  let refreshed = 0;
  if (Date.now() - started < budget - 40_000) refreshed = await refreshDueBlogs(settings, 1);
  let ideas = 0;
  if (settings.newsIdeas && Date.now() - started < budget - 30_000) ideas = await newsToBlogIdeas(2);
  return { steps, refreshed, ideas };
}

// ------------------------------------------------------------------ refresh

const numbers = (s: string) => (s.match(/\d[\d.,:]*/g) || []).map((n) => n.replace(/[.,]$/, ""));

function overlap(a: string, b: string): number {
  const x = topicTokens(a);
  const y = topicTokens(b);
  if (!x.size || !y.size) return 0;
  let n = 0;
  for (const w of x) if (y.has(w)) n++;
  return n / Math.min(x.size, y.size);
}

// Compares the facts that can change. A fact whose closest new match has
// different numbers is "changed"; one with no close match is "not confirmed".
export function compareVolatile(oldFacts: BlogFact[], newFacts: BlogFact[]): { fact: string; status: "changed" | "not_confirmed"; now?: string }[] {
  const out: { fact: string; status: "changed" | "not_confirmed"; now?: string }[] = [];
  for (const f of oldFacts.filter((x) => x.volatile)) {
    let best: BlogFact | null = null;
    let score = 0;
    for (const n of newFacts) {
      const s = overlap(f.claim, n.claim);
      if (s > score) {
        score = s;
        best = n;
      }
    }
    if (!best || score < 0.5) {
      out.push({ fact: f.claim, status: "not_confirmed" });
      continue;
    }
    const a = numbers(f.claim);
    const b = numbers(best.claim);
    // The closest new fact has no figures at all: it is about something else.
    if (a.length && !b.length) out.push({ fact: f.claim, status: "not_confirmed" });
    else if (a.length && a.some((x) => !b.includes(x))) out.push({ fact: f.claim, status: "changed", now: best.claim });
  }
  return out;
}

export async function refreshBlog(topicId: string): Promise<{ flags: number }> {
  const before = await getLatestBlogResearch(topicId);
  const after = await runBlogResearch(topicId);
  if (after.status !== "done" || !before) {
    await sql`UPDATE blog_topics SET refresh_checked_at = now() WHERE id = ${topicId}`;
    return { flags: 0 };
  }
  const flags = compareVolatile(before.facts, after.facts);
  await sql`UPDATE blog_topics SET refresh_checked_at = now(), refresh_flags = ${JSON.stringify(flags)}::jsonb WHERE id = ${topicId}`;
  return { flags: flags.length };
}

async function refreshDueBlogs(settings: BlogSettings, limit: number): Promise<number> {
  const due = (await sql`
    SELECT t.id FROM blog_topics t JOIN articles a ON a.id = t.article_id
    WHERE a.status = 'published'
      AND COALESCE(t.refresh_checked_at, a.published_at) < now() - (${settings.refreshMonths}::int * interval '1 month')
    ORDER BY COALESCE(t.refresh_checked_at, a.published_at) LIMIT ${limit}`.catch(() => [])) as any[];
  for (const d of due) await refreshBlog(String(d.id)).catch(() => null);
  return due.length;
}

// --------------------------------------------------------------- news ideas

const NEWS_IDEA_PROMPT = `A travel news story was just published. Does it point to an EVERGREEN travel guide readers would search for (for example a news story about new Eiffel Tower ticket rules suggests "Eiffel Tower Tickets: Prices, Booking and Tips")?
If yes, return the guide's title (under 70 characters, no year), its type (travel_guide, things_to_do, attractions, itinerary, best_time, food, tickets, history) and the destination (one city or country). If the story is not about a place travellers visit, return an empty title.
Return JSON: {"title","type","destination"}`;

export async function newsToBlogIdeas(limit = 2): Promise<number> {
  const stories = (await sql`
    SELECT a.id, a.title, a.excerpt FROM articles a
    WHERE a.type = 'news' AND a.status = 'published' AND a.published_at > now() - interval '3 days'
      AND NOT EXISTS (SELECT 1 FROM blog_topics t WHERE t.news_article_id = a.id)
    ORDER BY a.published_at DESC LIMIT ${limit}`.catch(() => [])) as any[];
  if (!stories.length || !process.env.OPENAI_API_KEY?.trim()) return 0;
  const existing = ((await sql`SELECT title FROM blog_topics WHERE status <> 'dismissed' UNION SELECT title FROM articles WHERE type = 'guide'`.catch(() => [])) as any[]).map((r) => String(r.title));
  let added = 0;
  for (const s of stories) {
    // Mark the story as considered even when it suggests nothing.
    const { json } = await chatJson({
      kind: "blog_news_idea",
      log: { articleId: s.id },
      model: researchModel(),
      temperature: 0.2,
      timeoutMs: 30_000,
      system: NEWS_IDEA_PROMPT,
      user: `${s.title}\n${s.excerpt || ""}`,
    }).catch(() => ({ json: null as any }));
    const title = String(json?.title || "").trim().slice(0, 200);
    let dest: { cityId: string | null; countryId: string | null } | null = null;
    if (title && !findSimilar(title, existing)) dest = await resolveDestination(String(json?.destination || "")).catch(() => null);
    const type = String(json?.type || "travel_guide");
    await sql`
      INSERT INTO blog_topics (title, angle, topic_type, target_words, city_id, country_id, source, status, created_by, news_article_id)
      VALUES (${title || `(no blog idea) ${s.title}`.slice(0, 200)}, ${`Suggested by the news story: ${s.title}`.slice(0, 300)}, ${type}, ${defaultWords(type)},
              ${dest?.cityId ?? null}, ${dest?.countryId ?? null}, 'from_news', ${dest ? "suggested" : "dismissed"}, 'automation', ${s.id})`;
    if (dest) {
      added++;
      existing.push(title);
    }
  }
  return added;
}

export { getTopic };
