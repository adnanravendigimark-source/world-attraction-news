// AI images inside an article (not the cover). An editor picks a spot and
// clicks Generate: for a guide, each section is a spot; for a news story,
// each gap between paragraphs. The image is labelled AI-generated in its
// caption and in the image record, like an AI cover.
//
// Figures use the same <figure class="news-figure"> markup as licensed
// photos, so the fact-check fingerprint ignores them (lib/news/contentHash.ts)
// and adding, replacing or removing one never makes a passed check stale.

import { sql } from "../db";
import { computeContentStats } from "../articles";
import { uploadImage } from "../blob";
import { buildImagePrompt, generateAiImage } from "./imagegen";
import { altForPhoto, captionHtml, creditLine, figureHtml, findPhoto, getQueries, storePhoto } from "./media";
import { recordAiRevision } from "./aiRevision";

const FIGURE = /^\s*<figure class="news-figure">[\s\S]*?<\/figure>/;
const H2 = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
const text = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

export interface ImageSlot {
  index: number;
  label: string; // section heading, or the start of the paragraph before the spot
  image: { url: string; alt: string; caption: string; ai: boolean } | null;
}

interface SlotPos {
  at: number; // where a figure goes
  label: string;
  heading?: string;
  passage: string; // the text around the spot, for the image brief
}

// Where images can go. Guides: after the first paragraph of each section.
// News: after each paragraph except the last.
function positions(html: string, guide: boolean): SlotPos[] {
  const out: SlotPos[] = [];
  if (guide) {
    const heads = [...html.matchAll(H2)];
    heads.forEach((m, i) => {
      const start = m.index! + m[0].length;
      const end = i + 1 < heads.length ? heads[i + 1].index! : html.length;
      const close = html.indexOf("</p>", start);
      const body = text(html.slice(start, end).replace(/<figure class="news-figure">[\s\S]*?<\/figure>/g, " "));
      out.push({ at: close >= 0 && close < end ? close + 4 : start, label: text(m[1]), heading: text(m[1]), passage: `${text(m[1])}. ${body}` });
    });
  } else {
    const paras = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)];
    paras.slice(0, -1).forEach((m, i) => {
      const t = text(m[1]);
      out.push({ at: m.index! + m[0].length, label: t.length > 70 ? `${t.slice(0, 70)}…` : t, passage: `${t} ${text(paras[i + 1][1])}` });
    });
  }
  return out;
}

function figureAt(html: string, at: number): { html: string; length: number } | null {
  const m = html.slice(at).match(FIGURE);
  return m ? { html: m[0], length: m[0].length } : null;
}

// The spots and the image currently in each. Pure; exported for tests.
export function listSlots(html: string, guide: boolean): ImageSlot[] {
  return positions(html, guide).map((p, index) => {
    const f = figureAt(html, p.at);
    if (!f) return { index, label: p.label, image: null };
    const url = f.html.match(/<img[^>]*src="([^"]+)"/)?.[1] || "";
    const alt = f.html.match(/<img[^>]*alt="([^"]*)"/)?.[1] || "";
    const caption = text(f.html.match(/<figcaption>([\s\S]*?)<\/figcaption>/)?.[1] || "");
    return { index, label: p.label, image: { url, alt, caption, ai: /AI-generated/i.test(caption) } };
  });
}

// Puts a figure in a spot, replacing the one already there; null removes it.
// Pure; exported for tests.
export function setSlotFigure(html: string, guide: boolean, index: number, figure: string | null): string {
  const p = positions(html, guide)[index];
  if (!p) throw new Error("That spot isn't in the article any more. Reload and try again.");
  const f = figureAt(html, p.at);
  return html.slice(0, p.at) + (figure ?? "") + html.slice(p.at + (f ? f.length : 0));
}

async function load(articleId: string) {
  const a = (await sql`
    SELECT a.title, a.type, a.content_html, ci.name AS city, co.name AS country
    FROM articles a LEFT JOIN cities ci ON ci.id = a.city_id LEFT JOIN countries co ON co.id = a.country_id
    WHERE a.id = ${articleId} LIMIT 1`)[0] as any;
  if (!a) throw new Error("Article not found.");
  return { ...a, guide: a.type !== "news", html: String(a.content_html || "") };
}

// Saves the new text and keeps the in-article image record in step with it.
type InlineEntry = { url: string; credit: string; license: string; source: string };
const AI_ENTRY = (url: string): InlineEntry => ({ url, credit: "AI-generated", license: "AI-generated image (OpenAI)", source: "" });

async function save(articleId: string, html: string, added: InlineEntry | null, note: string) {
  const stats = computeContentStats(html);
  await sql`UPDATE articles SET content_html = ${html}, word_count = ${stats.wordCount}, reading_time_minutes = ${stats.readingTimeMinutes}, updated_at = now() WHERE id = ${articleId}`;
  const cur = (await sql`SELECT inline FROM article_image_meta WHERE article_id = ${articleId} LIMIT 1`.catch(() => []))[0] as any;
  const kept = (Array.isArray(cur?.inline) ? cur.inline : []).filter((e: any) => e?.url && html.includes(e.url));
  const next = added ? [...kept, added] : kept;
  await sql`
    INSERT INTO article_image_meta (article_id, inline, updated_at) VALUES (${articleId}, ${JSON.stringify(next)}::jsonb, now())
    ON CONFLICT (article_id) DO UPDATE SET inline = EXCLUDED.inline`;
  await recordAiRevision(articleId, note);
}

export async function inlineSlots(articleId: string): Promise<ImageSlot[]> {
  const a = await load(articleId);
  return listSlots(a.html, a.guide);
}

// Generates an AI image for one spot (replacing any image there).
export async function generateInlineImage(articleId: string, index: number, direction = ""): Promise<{ url: string; alt: string; slots: ImageSlot[] }> {
  const a = await load(articleId);
  const slot = listSlots(a.html, a.guide)[index];
  const passage = positions(a.html, a.guide)[index]?.passage || "";
  if (!slot) throw new Error("That spot isn't in the article any more. Reload and try again.");
  const place = String(a.city || a.country || "");
  let opts: { subject?: string; sceneFrom?: string; inline: boolean; passage: string };
  if (a.guide) {
    // A guide section: the heading is the subject and decides the scene.
    const { sectionSubject } = await import("../blogs/images");
    opts = { subject: sectionSubject(slot.label, place) || slot.label, sceneFrom: slot.label, inline: true, passage };
  } else {
    // A news story: a second subject from the writer if there is one, so it
    // differs from the cover; the story type still decides the scene.
    const q = await getQueries(articleId);
    opts = { subject: q[1] || q[0] || "", inline: true, passage };
  }
  const extra = [direction.trim(), a.guide ? "" : "A different view from the cover image."].filter(Boolean).join(" ");
  const { prompt, scene } = await buildImagePrompt(articleId, extra, opts);
  const png = await generateAiImage(articleId, prompt);
  const stored = await uploadImage(new File([new Uint8Array(png)], "inline.png", { type: "image/png" }), "news");
  const alt = `AI-generated image: ${scene.charAt(0).toUpperCase()}${scene.slice(1)}`.slice(0, 200);
  const caption = a.guide ? "AI-generated image" : "AI-generated image. It does not show the actual event.";
  // Re-read so an edit made while the image was generating isn't lost.
  const fresh = await load(articleId);
  const html = setSlotFigure(fresh.html, fresh.guide, index, figureHtml(stored.url, alt, caption));
  await save(articleId, html, AI_ENTRY(stored.url), `AI image ${slot.image ? "replaced" : "added"} in the article (${slot.label.slice(0, 60)})`);
  return { url: stored.url, alt, slots: listSlots(html, fresh.guide) };
}

// Search words for a free photo at one spot: the editor's direction, then the
// section's subject (guides) or the writer's photo subjects (news), each with
// the place so photos of somewhere else don't match. Pure; exported for tests.
export function freePhotoQueries(input: { place: string; direction?: string; sectionSubject?: string; writerQueries?: string[] }): string[] {
  const place = input.place.trim();
  const withPlace = (q: string) => (q && place && !q.toLowerCase().includes(place.toLowerCase()) ? `${place} ${q}` : q);
  const out = [
    withPlace((input.direction || "").trim()),
    withPlace((input.sectionSubject || "").trim()),
    ...(input.writerQueries || []).map((q) => withPlace(q.trim())),
  ];
  return [...new Set(out.filter(Boolean))];
}

// Finds a free, credited photo (Unsplash or Wikimedia Commons) for one spot,
// so an editor tries the free option before paying for an AI image. Never
// reuses a photo already in the article or on the cover. Throws a plain
// message when nothing suitable is found.
export async function findInlinePhoto(articleId: string, index: number, direction = ""): Promise<{ url: string; alt: string; slots: ImageSlot[] }> {
  const a = await load(articleId);
  const slot = listSlots(a.html, a.guide)[index];
  if (!slot) throw new Error("That spot isn't in the article any more. Reload and try again.");
  const place = String(a.city || a.country || "");
  const subject = a.guide ? (await import("../blogs/images")).sectionSubject(slot.label, place) : "";
  const queries = freePhotoQueries({ place, direction, sectionSubject: subject, writerQueries: await getQueries(articleId) });
  if (queries.length === 0) throw new Error("Type what the photo should show in the box above, then try again.");
  const meta = (await sql`SELECT source_url, inline FROM article_image_meta WHERE article_id = ${articleId} LIMIT 1`.catch(() => []))[0] as any;
  const exclude = new Set<string>([String(meta?.source_url || ""), ...(Array.isArray(meta?.inline) ? meta.inline.map((e: any) => String(e?.source || "")) : [])].filter(Boolean));
  const photo = await findPhoto(queries, exclude, { place, country: String(a.country || "") }).catch(() => null);
  if (!photo) throw new Error("No free photo of this found on Unsplash or Wikimedia Commons. Type a different description above, or use Generate with AI.");
  const stored = await storePhoto(photo, { cover: false });
  const alt = altForPhoto(photo);
  const fresh = await load(articleId);
  const html = setSlotFigure(fresh.html, fresh.guide, index, figureHtml(stored.url, alt, captionHtml(photo)));
  await save(
    articleId,
    html,
    { url: stored.url, credit: creditLine(photo), license: photo.license, source: photo.pageUrl },
    `Free photo ${slot.image ? "replaced" : "added"} in the article (${slot.label.slice(0, 60)})`
  );
  return { url: stored.url, alt, slots: listSlots(html, fresh.guide) };
}

export async function removeInlineImage(articleId: string, index: number): Promise<ImageSlot[]> {
  const a = await load(articleId);
  const slot = listSlots(a.html, a.guide)[index];
  if (!slot?.image) throw new Error("There's no image in that spot.");
  const html = setSlotFigure(a.html, a.guide, index, null);
  await save(articleId, html, null, `Image removed from the article (${slot.label.slice(0, 60)})`);
  return listSlots(html, a.guide);
}
