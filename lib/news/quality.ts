// Quality summary for a generated news draft. Pure checks over what is stored;
// nothing here calls a model. The score is the weighted share of checks passed.
import { sql } from "../db";
import { getLatestResearch } from "./research";
import { getFactCheck } from "./factcheck";
import { getImageMeta } from "./images";
import { getExtra } from "./seo";
import { prepareTitle, sameStoryPrepared } from "./similarity";

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
}

export async function computeQuality(articleId: string): Promise<QualityReport> {
  const a = (await sql`
    SELECT id, title, slug, excerpt, content_html, meta_title, meta_description, focus_keyword, canonical_url, tags, image, image_alt,
           category_id, word_count, news_cluster_id
    FROM articles WHERE id = ${articleId} AND type = 'news' LIMIT 1`)[0];
  if (!a) throw new Error("News article not found.");

  const checks: QualityCheck[] = [];
  const add = (key: string, label: string, weight: number, fraction: number, note: string) =>
    checks.push({ key, label, ok: fraction >= 1, weight, earned: Math.round(weight * Math.min(1, Math.max(0, fraction))), note });

  // Research
  const research = a.news_cluster_id ? await getLatestResearch(String(a.news_cluster_id)) : null;
  const facts = research?.status === "done" ? research.facts : null;
  add("research", "Research complete", 10, facts ? 1 : 0, facts ? `${facts.important_facts.length} facts from ${research!.sources.length} source(s)` : "No completed research");

  // Fact check
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

  // Article
  const words = Number(a.word_count || 0);
  const todo = /TODO/.test(String(a.content_html || ""));
  add("article", "Article generated", 10, todo ? 0 : words >= 150 ? 1 : words >= 100 ? 0.5 : 0, todo ? "Still contains TODO placeholders" : `${words} words`);

  // SEO completeness
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
  add("seo", "SEO complete", 15, (seoParts.length - missing.length) / seoParts.length, missing.length ? `Missing: ${missing.join(", ")}` : "All SEO fields set");

  // Image + provenance
  add("image", "Image added", 10, a.image && a.image_alt ? 1 : a.image ? 0.5 : 0, a.image ? (a.image_alt ? "Hero image with alt text" : "Image has no alt text") : "No hero image");
  const meta = await getImageMeta(articleId);
  const provOk = !!a.image && meta.sourceType !== "unverified" && (meta.sourceType === "ai" || !!meta.credit);
  add("provenance", "Image provenance recorded", 10, provOk ? 1 : 0, !a.image ? "No image" : meta.sourceType === "unverified" ? "Rights not recorded" : meta.sourceType === "ai" ? "AI-generated, labelled" : `${meta.sourceType}: ${meta.credit || "no credit"}`);

  // Internal links
  const applied = extra.internalLinks.applied.length;
  add("links", "Internal links added", 5, applied > 0 || extra.internalLinks.candidates === 0 ? 1 : 0, applied > 0 ? `${applied} link(s): ${extra.internalLinks.applied.map((l) => l.name).join(", ")}` : "No destination on this site is mentioned");

  // Travel relevance
  const rel = a.news_cluster_id ? Number((await sql`SELECT COALESCE(MAX(relevance_score),0)::int AS m FROM news_items WHERE cluster_id = ${a.news_cluster_id}`)[0]?.m ?? 0) : 0;
  add("relevance", "Travel relevance", 10, rel >= 60 ? 1 : rel >= 40 ? 0.5 : 0, `Travel relevance ${rel}/100`);

  // Duplicate
  const others = (await sql`SELECT title FROM articles WHERE type = 'news' AND id <> ${articleId} AND status <> 'rejected'`) as any[];
  const mine = prepareTitle(String(a.title));
  const dup = others.find((o) => sameStoryPrepared(mine, prepareTitle(String(o.title))));
  add("duplicate", "No duplicate article", 5, dup ? 0 : 1, dup ? `Similar to: ${String(dup.title).slice(0, 70)}` : "No similar article found");

  // Required metadata
  const srcCount = Number((await sql`SELECT COUNT(*)::int AS n FROM article_sources WHERE article_id = ${articleId}`)[0]?.n ?? 0);
  add("metadata", "Category and sources set", 5, (a.category_id ? 0.5 : 0) + (srcCount > 0 ? 0.5 : 0), `${a.category_id ? "category set" : "no category"}, ${srcCount} source(s) linked`);

  const total = checks.reduce((n, c) => n + c.earned, 0);
  return { score: Math.round(total), checks };
}
