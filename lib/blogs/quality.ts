// Track B5 — quality checklist for AI blogs (long-form guides). Same shape as
// the news checklist so the editor's Ready bar shows it unchanged.

import { sql } from "../db";
import { getFactCheck } from "../news/factcheck";
import { getImageMeta, isNewsCoverSize } from "../news/images";
import { getLinks } from "../news/internalLinks";
import type { QualityCheck, QualityReport } from "../news/quality";
import { getLatestBlogResearch, MIN_FACTS } from "./research";
import { photoSections } from "./images";

const STOCK = /\b(vibrant|bustling|breathtaking|stunning|nestled|boasts|must-see|hidden gem|tapestry|plethora|unforgettable)\b/gi;

export async function computeBlogQuality(articleId: string): Promise<QualityReport> {
  const a = (await sql`
    SELECT a.content_html, a.image, a.image_alt, a.word_count, a.faq, a.meta_title, a.meta_description, a.focus_keyword, a.excerpt,
           t.id AS topic_id, t.target_words, t.outline
    FROM articles a LEFT JOIN blog_topics t ON t.article_id = a.id
    WHERE a.id = ${articleId} LIMIT 1`)[0] as any;
  if (!a) throw new Error("Article not found.");
  const html = String(a.content_html || "");
  const checks: QualityCheck[] = [];
  const add = (key: string, label: string, weight: number, fraction: number, note: string) =>
    checks.push({ key, label, ok: fraction >= 1, weight, earned: Math.round(weight * Math.min(1, Math.max(0, fraction))), note });

  const research = a.topic_id ? await getLatestBlogResearch(String(a.topic_id)) : null;
  const facts = research?.status === "done" ? research.facts.length : 0;
  add("research", "Research complete", 10, facts >= MIN_FACTS ? 1 : facts > 0 ? 0.5 : 0, facts ? `${facts} cited facts from ${research!.sources.filter((s) => s.ok).length} sources` : "No research");

  const fc = await getFactCheck(articleId);
  const fcOk = fc && !fc.stale && (fc.verdict === "passed" || fc.overridden);
  add(
    "factcheck",
    "Facts supported by research",
    25,
    fcOk ? 1 : fc && !fc.stale && fc.verdict === "needs_review" ? 0.5 : 0,
    !fc ? "Not checked yet" : fc.stale ? "Edited since the check: run it again" : fc.overridden ? "Approved by an editor" : fc.verdict === "passed" ? "Every claim matches the research" : `${fc.issues.length} sentence(s) to review`
  );

  const target = Number(a.target_words) || 1500;
  const words = Number(a.word_count) || 0;
  add("length", "Length", 10, words >= target * 0.8 ? 1 : words >= target * 0.6 ? 0.5 : 0, `${words} words (target ${target})`);

  const planned: string[] = (a.outline?.sections || []).map((s: any) => String(s.heading).toLowerCase());
  const present = new Set([...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) => m[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim().toLowerCase()));
  const covered = planned.filter((h) => present.has(h)).length;
  add("outline", "All planned sections present", 10, planned.length ? covered / planned.length : present.size >= 3 ? 1 : 0, planned.length ? `${covered} of ${planned.length} sections` : `${present.size} sections`);

  const faq = Array.isArray(a.faq) ? a.faq.length : 0;
  add("faq", "FAQ", 10, faq >= 4 ? 1 : faq > 0 ? 0.5 : 0, faq ? `${faq} questions` : "No FAQ");

  const meta = await getImageMeta(articleId);
  const sized = isNewsCoverSize(meta, a.image);
  add("image", "Cover image", 5, !a.image ? 0 : sized ? 1 : 0.5, !a.image ? "No cover" : sized ? "1200×675 cover" : "Not cropped to 1200×675");
  const provOk = !!a.image && meta.sourceType !== "unverified" && (meta.sourceType === "ai" || !!meta.credit);
  add("provenance", "Image rights recorded", 5, provOk ? 1 : 0, !a.image ? "No image" : provOk ? `${meta.sourceType}: ${meta.credit || "AI"}` : "Rights not recorded");
  const figures = (html.match(/<figure class="news-figure"/g) || []).length;
  const wanted = Math.max(1, photoSections(present.size).length);
  add("inline", "Photos in the text", 5, Math.min(1, figures / wanted), `${figures} of ${wanted} section photos, each credited`);

  const seo = [a.meta_title, a.meta_description, a.focus_keyword, a.excerpt].filter((v) => String(v || "").trim()).length;
  add("seo", "SEO complete", 10, seo / 4, seo === 4 ? "Title, description, keyword and summary set" : `${4 - seo} SEO field(s) missing`);

  const links = (await getLinks(articleId).catch(() => [])).filter((l) => l.status === "applied");
  add("links", "Links to this site", 5, 1, links.length ? `${links.length} link(s) to destination pages` : "No destination page on this site to link to");

  const stock = [...new Set((html.match(STOCK) || []).map((w) => w.toLowerCase()))];
  add("style", "Plain wording", 5, stock.length ? 0.5 : 1, stock.length ? `Stock phrases: ${stock.join(", ")}` : "No stock travel phrases");

  const total = checks.reduce((n, c) => n + c.earned, 0);
  return { score: Math.round(total), checks, overlap: [] };
}
