// Quality summary for a news draft. Pure checks over what is stored; nothing
// here calls a model. The score is the weighted share of checks passed
// (weights add up to 100). An article is "Ready" when the publish gate
// (newsPublishProblems in lib/articles.ts) has no problems; the gate itself
// requires this score to reach the minimum set on the Automation page.
import { sql } from "../db";
import { checkOriginality } from "../originality";
import { getLatestResearch } from "./research";
import { getFactCheck } from "./factcheck";
import { getImageMeta, isNewsCoverSize } from "./images";
import { getExtra } from "./seo";
import { getLinks } from "./internalLinks";
import { prepareTitle, sameStoryPrepared } from "./similarity";
import { OVERLAP_WORDS, sourceOverlap, type OverlapMatch } from "./overlap";

export interface QualityCheck {
  key: string;
  label: string;
  ok: boolean;
  weight: number;
  earned: number;
  note: string;
}
export interface QualityReport {
  score: number;
  checks: QualityCheck[];
  overlap: OverlapMatch[]; // passages copied word for word from a source
}

const TRAVELER = /\b(travell?ers?|passengers?|visitors?|tourists?|holidaymakers?|guests?)\b/i;
const PRACTICAL = /\b(may want to|should|check|book|booking|rebook|refund|apply|allow|bring|expect|plan|from|until|starting|before|after|need to|required)\b/i;

// True when one paragraph speaks to travelers in practical terms: who is
// affected together with a date, an action or a requirement.
export function hasTravelerGuidance(html: string): boolean {
  return String(html || "")
    .split(/<\/p>/i)
    .map((p) => p.replace(/<[^>]+>/g, " "))
    .some((p) => TRAVELER.test(p) && PRACTICAL.test(p));
}

// News value fades with age: full credit for 2 days, half up to a week.
export function freshnessFraction(ageHours: number): number {
  if (ageHours <= 48) return 1;
  if (ageHours <= 168) return 0.5;
  return 0;
}

export async function computeQuality(articleId: string): Promise<QualityReport> {
  const a = (await sql`
    SELECT id, title, slug, excerpt, content_html, meta_title, meta_description, focus_keyword, canonical_url, tags, image, image_alt,
           category_id, word_count, news_cluster_id
    FROM articles WHERE id = ${articleId} AND type = 'news' LIMIT 1`)[0];
  if (!a) throw new Error("News article not found.");
  const html = String(a.content_html || "");

  const checks: QualityCheck[] = [];
  const add = (key: string, label: string, weight: number, fraction: number, note: string) =>
    checks.push({ key, label, ok: fraction >= 1, weight, earned: Math.round(weight * Math.min(1, Math.max(0, fraction))), note });

  // Research (5)
  const research = a.news_cluster_id ? await getLatestResearch(String(a.news_cluster_id)) : null;
  const facts = research?.status === "done" ? research.facts : null;
  const factCount = facts ? facts.important_facts.length : 0;
  add(
    "research",
    "Research complete",
    5,
    !facts ? 0 : factCount >= 4 ? 1 : factCount > 0 ? 0.5 : 0,
    facts ? `${factCount} facts from ${research!.sources.length} source(s)${factCount < 4 ? " (thin: add a readable source)" : ""}` : "No completed research"
  );

  // Fact check (20)
  const fc = await getFactCheck(articleId);
  const high = fc ? fc.issues.filter((i) => i.severity === "high").length : 0;
  let fcScore = 0;
  let fcNote = "Fact check not run";
  if (fc?.stale) fcNote = "Text changed since the last check; re-run it";
  else if (fc?.verdict === "passed") [fcScore, fcNote] = [1, "No unsupported claims found"];
  else if (fc?.verdict === "needs_review") [fcScore, fcNote] = [0.5, `${fc.issues.length} hint(s) for an editor to review`];
  else if (fc?.overridden) [fcScore, fcNote] = [1, "Failed check overridden by an editor"];
  else if (fc) fcNote = `${high} issue(s) to fix`;
  add("facts", "Facts supported by research", 20, fcScore, fcNote);

  // Article (10): house length is 200-300 words (180-360 full credit), no headings, no TODO.
  const words = Number(a.word_count || 0);
  const todo = /TODO/.test(html);
  const headings = /<h[1-6][\s>]/i.test(html);
  const inRange = words >= 180 && words <= 360;
  add(
    "article",
    "Article written",
    10,
    todo ? 0 : inRange && !headings ? 1 : words >= 150 ? 0.5 : 0,
    todo ? "Still contains TODO placeholders" : headings ? `${words} words; remove the headings (news stories carry none)` : inRange ? `${words} words` : `${words} words (aim for 200-300)`
  );

  // Traveler usefulness (5)
  const guidance = hasTravelerGuidance(html);
  add("travelers", "Useful for travelers", 5, guidance ? 1 : 0, guidance ? "Says what this means for travelers" : "No paragraph on what travelers should know or do");

  // SEO completeness (10)
  const extra = await getExtra(articleId);
  const seoParts: [string, boolean][] = [
    ["title", !!a.title],
    ["excerpt", !!a.excerpt],
    ["SEO title", !!a.meta_title],
    ["meta description", !!a.meta_description],
    ["focus keyword", !!a.focus_keyword],
    ["slug", !!a.slug],
    ["canonical", !!a.canonical_url],
    ["tags", Array.isArray(a.tags) && a.tags.length > 0],
    ["secondary keywords", extra.secondaryKeywords.length > 0],
    ["Open Graph", !!extra.ogTitle && !!extra.ogDescription],
  ];
  const missing = seoParts.filter(([, v]) => !v).map(([k]) => k);
  add("seo", "SEO complete", 10, (seoParts.length - missing.length) / seoParts.length, missing.length ? `Missing: ${missing.join(", ")}` : "All SEO fields set");

  // Image (10): a 1200×675 cover with alt text. Provenance (5).
  const meta = await getImageMeta(articleId);
  const sized = isNewsCoverSize(meta, a.image);
  add(
    "image",
    "Image added",
    10,
    !a.image ? 0 : (a.image_alt ? 0.5 : 0) + (sized ? 0.5 : 0),
    !a.image
      ? "No hero image"
      : [sized ? "1200×675 cover" : "Not cropped to 1200×675 (Re-crop in the image panel)", a.image_alt ? "alt text set" : "no alt text"].join(", ")
  );
  const provOk = !!a.image && meta.sourceType !== "unverified" && (meta.sourceType === "ai" || !!meta.credit);
  add("provenance", "Image rights recorded", 5, provOk ? 1 : 0, !a.image ? "No image" : meta.sourceType === "unverified" ? "Rights not recorded" : meta.sourceType === "ai" ? "AI-generated, labelled" : `${meta.sourceType}: ${meta.credit || "no credit"}`);

  // Internal links (5)
  // Stored links (Phase 10); older drafts only have the summary in extra.
  const stored = (await getLinks(articleId)).filter((l) => l.status === "applied");
  const linked = stored.length ? stored.map((l) => l.entityName) : extra.internalLinks.applied.map((l) => l.name);
  add(
    "links",
    "Internal links added",
    5,
    linked.length > 0 || extra.internalLinks.candidates === 0 ? 1 : 0,
    linked.length > 0 ? `${linked.length} link(s): ${linked.slice(0, 4).join(", ")}${linked.length > 4 ? "…" : ""}` : "No destination on this site is mentioned"
  );

  // Travel relevance (5) + freshness (5), from the story's items
  const story = a.news_cluster_id
    ? (await sql`
        SELECT COALESCE(MAX(relevance_score), 0)::int AS rel, MIN(COALESCE(published_at, created_at)) AS first_at
        FROM news_items WHERE cluster_id = ${a.news_cluster_id}`)[0]
    : null;
  const rel = Number(story?.rel ?? 0);
  add("relevance", "Travel relevance", 5, rel >= 60 ? 1 : rel >= 40 ? 0.5 : 0, `Travel relevance ${rel}/100`);
  const ageHours = story?.first_at ? (Date.now() - new Date(story.first_at).getTime()) / 3_600_000 : Infinity;
  add(
    "freshness",
    "Fresh news",
    5,
    freshnessFraction(ageHours),
    Number.isFinite(ageHours) ? `First reported ${ageHours < 48 ? `${Math.round(ageHours)} h` : `${Math.round(ageHours / 24)} days`} ago` : "Unknown age"
  );

  // Duplicate story (5)
  const others = (await sql`SELECT title FROM articles WHERE type = 'news' AND id <> ${articleId} AND status <> 'rejected'`) as any[];
  const mine = prepareTitle(String(a.title));
  const dup = others.find((o) => sameStoryPrepared(mine, prepareTitle(String(o.title))));
  add("duplicate", "No duplicate article", 5, dup ? 0 : 1, dup ? `Similar to: ${String(dup.title).slice(0, 70)}` : "No similar article found");

  // Originality against this site's other articles (5)
  const orig = await checkOriginality(html, articleId).catch(() => ({ score: 0, flag: false, matches: [] as { title: string }[] }));
  add("originality", "Original text", 5, orig.flag ? 0 : 1, orig.flag ? `Overlaps an existing article: ${orig.matches[0]?.title.slice(0, 60)}` : "No overlap with other articles on this site");

  // Not copied from the sources (5). Any hit also blocks publishing.
  const items = a.news_cluster_id
    ? ((await sql`
        SELECT i.title, i.description, s.name AS source FROM news_items i JOIN news_sources s ON s.id = i.source_id
        WHERE i.cluster_id = ${a.news_cluster_id}`) as any[])
    : [];
  const overlap = sourceOverlap(
    html,
    items.map((i) => ({ label: String(i.source), text: `${i.title}. ${i.description || ""}` }))
  );
  add(
    "overlap",
    "Not copied from sources",
    5,
    overlap.length ? 0 : 1,
    overlap.length ? `${overlap.length} passage(s) of ${OVERLAP_WORDS}+ words match a source word for word` : `No ${OVERLAP_WORDS}-word run matches a source headline or teaser`
  );

  // Category and sources (5)
  const srcCount = Number((await sql`SELECT COUNT(*)::int AS n FROM article_sources WHERE article_id = ${articleId}`)[0]?.n ?? 0);
  add("metadata", "Category and sources set", 5, (a.category_id ? 0.5 : 0) + (srcCount > 0 ? 0.5 : 0), `${a.category_id ? "category set" : "no category"}, ${srcCount} source(s) linked`);

  const total = checks.reduce((n, c) => n + c.earned, 0);
  return { score: Math.round(total), checks, overlap };
}
