// Track B5 — quality checklist for AI blogs (long-form guides). Same shape as
// the news checklist so the editor's Ready bar shows it unchanged.

import { sql } from "../db";
import { getFactCheck } from "../news/factcheck";
import { getImageMeta, isNewsCoverSize } from "../news/images";
import { getLinks } from "../news/internalLinks";
import type { QualityCheck, QualityReport } from "../news/quality";
import { getLatestBlogResearch, MIN_FACTS } from "./research";
import { photoSections } from "./images";

const plainText = (html: string) =>
  String(html || "").replace(/<figure[\s\S]*?<\/figure>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();

// Where the primary keyword appears (title, opening, a heading, meta
// description, URL) and how dense it is (over 2.5% reads as stuffing).
export function keywordPlacement(input: { keyword: string; title: string; html: string; metaDescription: string; slug: string }) {
  const k = norm(input.keyword);
  if (!k) return { found: [] as string[], missing: ["keyword"], density: 0 };
  const text = norm(plainText(input.html));
  const firstPara = norm(plainText((input.html.match(/<p[^>]*>[\s\S]*?<\/p>/i) || [""])[0] + (input.html.match(/<p[^>]*>[\s\S]*?<\/p>/gi) || ["", ""])[1]));
  const h2s = [...input.html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) => norm(m[1]));
  // A heading counts when it has most of the keyword's words.
  const words = k.split(" ").filter((w) => w.length > 2);
  const near = (s: string) => s.includes(k) || words.filter((w) => s.includes(w)).length >= Math.ceil(words.length * 0.6);
  const where: [string, boolean][] = [
    ["title", near(norm(input.title))],
    ["opening", firstPara.includes(k) || near(firstPara)],
    ["a heading", h2s.some(near)],
    ["meta description", near(norm(input.metaDescription))],
    ["URL", near(input.slug.replace(/-/g, " "))],
  ];
  const total = text.split(" ").length || 1;
  const hits = text.split(k).length - 1;
  return {
    found: where.filter(([, ok]) => ok).map(([n]) => n),
    missing: where.filter(([, ok]) => !ok).map(([n]) => n),
    density: Math.round(((hits * k.split(" ").length) / total) * 1000) / 10,
  };
}

// Average sentence length and over-long paragraphs.
export function readability(html: string): { avgSentence: number; longParagraphs: number } {
  const paras = [...String(html || "").matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => plainText(m[1])).filter(Boolean);
  const sentences = paras.flatMap((p) => p.split(/(?<=[.!?])\s+/)).filter((s) => s.split(" ").length > 2);
  const words = sentences.reduce((n, s) => n + s.split(" ").length, 0);
  return {
    avgSentence: sentences.length ? Math.round((words / sentences.length) * 10) / 10 : 0,
    longParagraphs: paras.filter((p) => p.split(/(?<=[.!?])\s+/).length > 5).length,
  };
}

const STOCK = /\b(vibrant|bustling|breathtaking|stunning|nestled|boasts|must-see|hidden gem|tapestry|plethora|unforgettable)\b/gi;

export async function computeBlogQuality(articleId: string): Promise<QualityReport> {
  const a = (await sql`
    SELECT a.content_html, a.title, a.slug, a.image, a.image_alt, a.word_count, a.faq, a.meta_title, a.meta_description, a.focus_keyword, a.excerpt,
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
    20,
    fcOk ? 1 : fc && !fc.stale && fc.verdict === "needs_review" ? 0.5 : 0,
    !fc ? "Not checked yet" : fc.stale ? "Edited since the check: run it again" : fc.overridden ? "Approved by an editor" : fc.verdict === "passed" ? "Every claim matches the research" : `${fc.issues.length} sentence(s) to review`
  );

  // Length is judged against what the outline recommended for this topic.
  const target = Number(a.outline?.recommendedWords) || Number(a.target_words) || 1500;
  const words = Number(a.word_count) || 0;
  add("length", "Length fits the topic", 5, words >= target * 0.8 ? 1 : words >= target * 0.6 ? 0.5 : 0, `${words} words (recommended ${target})`);

  const planned: string[] = (a.outline?.sections || []).map((s: any) => String(s.heading).toLowerCase());
  const present = new Set([...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) => m[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim().toLowerCase()));
  const covered = planned.filter((h) => present.has(h)).length;
  add("outline", "All planned sections present", 10, planned.length ? covered / planned.length : present.size >= 3 ? 1 : 0, planned.length ? `${covered} of ${planned.length} sections` : `${present.size} sections`);

  const faq = Array.isArray(a.faq) ? a.faq.length : 0;
  add("faq", "FAQ", 5, faq >= 4 ? 1 : faq > 0 ? 0.5 : 0, faq ? `${faq} questions` : "No FAQ");

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
  const cta = /class="guide-cta"/.test(html);
  add("links", "Links and call to action", 5, cta ? 1 : 0.5, `${links.length} link(s) in the text${cta ? ", call to action to more guides" : ", no call to action"}`);

  const kw = keywordPlacement({ keyword: String(a.focus_keyword || ""), title: String(a.title || ""), html, metaDescription: String(a.meta_description || ""), slug: String(a.slug || "") });
  const stuffed = kw.density > 2.5;
  add(
    "keywords",
    "Keyword placement",
    10,
    !a.focus_keyword ? 0 : (kw.found.length / 5) * (stuffed ? 0.5 : 1),
    !a.focus_keyword
      ? "No focus keyword"
      : `"${a.focus_keyword}" in ${kw.found.join(", ") || "nowhere"}${kw.missing.length ? `; missing from ${kw.missing.join(", ")}` : ""}${stuffed ? `; used too often (${kw.density}%)` : ""}`
  );

  const rd = readability(html);
  add(
    "readability",
    "Easy to read",
    5,
    rd.avgSentence <= 22 && rd.longParagraphs === 0 ? 1 : rd.avgSentence <= 26 ? 0.5 : 0,
    `${rd.avgSentence} words per sentence on average${rd.longParagraphs ? `, ${rd.longParagraphs} long paragraph(s)` : ""}`
  );

  const stock = [...new Set((html.match(STOCK) || []).map((w) => w.toLowerCase()))];
  add("style", "Plain wording", 5, stock.length ? 0.5 : 1, stock.length ? `Stock phrases: ${stock.join(", ")}` : "No stock travel phrases");

  const total = checks.reduce((n, c) => n + c.earned, 0);
  return { score: Math.round(total), checks, overlap: [] };
}
