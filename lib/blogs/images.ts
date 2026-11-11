// Track B5 — photos for AI blogs: a cover plus one photo for every second
// section. Every photo must be PROVEN to show the right place: the subject's
// own Wikidata image or Commons category, or a photo whose camera position
// (Commons) or location (Unsplash) is at the destination. Text matches alone
// are never enough (they picked the Space Needle and a New Mexico church for
// a Barcelona guide). No proven photo -> no photo; an AI image only as the
// cover fallback.

import { sql } from "../db";
import { computeContentStats } from "../articles";
import {
  altForPhoto,
  captionHtml,
  commonsCategoryPhotos,
  commonsFiles,
  commonsNear,
  creditLine,
  figureHtml,
  findPhoto,
  isScenePhoto,
  storePhoto,
  stripOurFigures,
  type FoundPhoto,
} from "../news/media";
import { isPublicUrl } from "../news/extract";
import { anchorForTitle, canonicalCountry, type Anchor } from "./anchor";
import { buildGazetteer, findPlaces } from "../news/places";
import { saveCoverSize, saveImageMeta } from "../news/images";
import { generateCoverImage } from "../news/imagegen";
import { recordAiRevision } from "../news/aiRevision";

const GENERIC = /\b(best|time|times|visit|visiting|guide|guides|tips|travel|things|to|do|in|the|a|an|and|of|for|by|season|seasonal|seasons|practical|getting|around|overview|how|when|where|what|why|your|you|ultimate|complete|comprehensive|essential|must|see|explore|exploring|discover|everything|know|need|first|timers?|is|it|worth|expect|expecting|should|can|much|long|into|fit|fitting|plan|planning|itinerary|trip|day|days|vs|versus|or|on|at|with|before|after|during|from|are|there|our)\b/gi;

// "Weather in Barcelona by Season" -> "Weather"; "Sagrada Família Tickets" -> "Sagrada Família"
export function sectionSubject(heading: string, destination: string): string {
  const d = destination.split(",")[0].trim();
  return heading.replace(new RegExp(d, "gi"), " ").replace(GENERIC, " ").replace(/[^\p{L}\p{N}\s'-]/gu, " ").replace(/\s+/g, " ").trim();
}

// Cover searches for a guide: its specific subject first ("Florence Arno Boat
// Tour"), then wide views of the place. A headline with no subject beyond the
// place ("Best Time to Visit Barcelona") starts with the skyline, not with the
// bare city name, which matches any photo taken there.
export function blogCoverQueries(title: string, dest: string): string[] {
  const subject = sectionSubject(String(title || "").split(":")[0], dest);
  return [subject ? `${dest} ${subject}` : "", `${dest} skyline`, `${dest} city view`, dest].map((q) => q.trim()).filter(Boolean);
}

// Which sections get a photo: every second one, starting with the second.
export function photoSections(count: number): number[] {
  const out: number[] = [];
  for (let i = 1; i < count; i += 2) out.push(i);
  return out.slice(0, 4);
}

// Alt text that says what and where: a stock description that doesn't name
// the place ("Brown concrete building under gray sky") is prefixed with the
// section's subject and the place. Pure; exported for tests.
export function labelledAlt(alt: string, subject: string, place: string): string {
  const fold = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const names = [subject, place].map((x) => fold(String(x || "")).split(/[^a-z0-9]+/).filter((w) => w.length >= 4)).flat();
  if (!alt || names.some((w) => fold(alt).includes(w))) return alt;
  const label = subject && !fold(subject).includes(fold(place)) ? `${subject}, ${place}` : place;
  return label ? `${label}: ${alt.charAt(0).toLowerCase()}${alt.slice(1)}`.slice(0, 160) : alt;
}

// The one city of `country` named in a guide's title, if exactly one is.
// Pure; exported for tests.
const GAZ = buildGazetteer();
export function titleCity(title: string, country: string): string {
  if (!country) return "";
  const c = country.toLowerCase();
  const keys = findPlaces(title, GAZ);
  const cities = GAZ.filter((e) => e.country && e.country === c && keys.includes(e.key));
  return cities.length === 1 ? cities[0].name : "";
}

// Puts a figure after the first paragraph that follows the n-th <h2>.
export function insertAfterSection(html: string, sectionIndex: number, figure: string): string {
  const re = /<h2[^>]*>[\s\S]*?<\/h2>/gi;
  let m: RegExpExecArray | null;
  let i = -1;
  while ((m = re.exec(html))) {
    if (++i !== sectionIndex) continue;
    const after = m.index + m[0].length;
    const close = html.indexOf("</p>", after);
    const nextH2 = html.slice(after).search(/<h2/i);
    if (close < 0 || (nextH2 >= 0 && close > after + nextH2)) return html.slice(0, after) + figure + html.slice(after);
    return html.slice(0, close + 4) + figure + html.slice(close + 4);
  }
  return html;
}

// How far from the anchor a photo may have been taken: a landmark's own
// photos are within a short walk; a city's anywhere in the city; a country's
// anywhere in it (its centre point, so wide). Pure; exported for tests.
export function proofRadiusKm(kind: "subject" | "city" | "country"): number {
  return kind === "subject" ? 1.5 : kind === "city" ? 30 : 1200;
}

// The anchors photos must match: the topic's own subject (when research
// found its Wikipedia page) and the destination. Null when Wikidata has
// nothing or can't be reached.
async function photoAnchors(articleId: string, dest: string, title: string): Promise<{ subject: Anchor | null; place: Anchor | null }> {
  const t = (await sql`SELECT id, title FROM blog_topics WHERE article_id = ${articleId} ORDER BY created_at DESC LIMIT 1`.catch(() => []))[0] as any;
  let subject: Anchor | null = null;
  if (t) {
    const { getLatestBlogResearch, topicSubject, isNamedSubject } = await import("./research");
    const r = await getLatestBlogResearch(String(t.id)).catch(() => null);
    const guess = topicSubject(String(t.title || title), dest);
    const page = guess ? (r?.sources || []).find((s) => s.ok && s.publisher === "Wikipedia" && !/,\s/.test(s.title) && isNamedSubject(guess, s.title)) : undefined;
    if (page) subject = await anchorForTitle(page.title, 0).catch(() => null);
  }
  const place = dest ? await anchorForTitle(dest, 0).catch(() => null) : null;
  return { subject, place };
}

// Photos proven to show the subject: its own Wikidata image, its Commons
// category, then photos taken within a few hundred metres of it.
async function subjectPool(a: Anchor): Promise<FoundPhoto[]> {
  const own = a.image ? await commonsFiles([a.image], "Wikidata image").catch(() => []) : [];
  const cat = await commonsCategoryPhotos(a.commonsCategory, a.label).catch(() => []);
  const near = a.lat !== null && a.lon !== null ? await commonsNear(a.lat, a.lon, 400, a.label).catch(() => []) : [];
  const seen = new Set<string>();
  return [...own, ...cat.sort((x, y) => (y.width || 0) - (x.width || 0)), ...near]
    .filter((p) => isScenePhoto(p) && isPublicUrl(p.imageUrl) && !seen.has(p.imageUrl) && !!seen.add(p.imageUrl));
}

export async function ensureBlogImages(articleId: string, opts: { allowAi?: boolean; inline?: boolean } = {}): Promise<{ cover: "licensed" | "ai" | "none"; inline: number; notes: string[] }> {
  const a = (await sql`
    SELECT a.title, a.content_html, a.image, ci.name AS city, co.name AS country, ci.country AS city_country
    FROM articles a LEFT JOIN cities ci ON ci.id = a.city_id LEFT JOIN countries co ON co.id = a.country_id
    WHERE a.id = ${articleId} LIMIT 1`)[0] as any;
  if (!a) throw new Error("Article not found.");
  const country = String(a.city_country || a.country || "");
  // A country-level guide whose title names one of its cities ("Plan a Trip
  // to Paris" filed under France) is photographed as that city: "France"
  // alone accepted a fort in Alsace.
  const dest = String(a.city || titleCity(String(a.title || ""), country) || a.country || "");
  const countryOnly = !a.city && dest === String(a.country || "");
  const html0 = stripOurFigures(String(a.content_html || ""));
  const headings = [...html0.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) => m[1].replace(/<[^>]+>/g, "").trim());
  const used = new Set<string>();
  const notes: string[] = [];

  // Every photo must be proven to show the right place (see PhotoContext.near).
  const anchors = await photoAnchors(articleId, dest, String(a.title || ""));
  const subject = anchors.subject;
  // A namesake page ("Florence" the US city for Florence, Italy) is not the place.
  const place = anchors.place && (!anchors.place.country || !country || canonicalCountry(anchors.place.country) === canonicalCountry(country)) ? anchors.place : null;
  const destNear =
    place && place.lat !== null && place.lon !== null ? { lat: place.lat, lon: place.lon, km: proofRadiusKm(countryOnly ? "country" : "city") } : undefined;
  if (!destNear) notes.push(`No map position found for ${dest}: only photos that name it in their location are used.`);
  const pool = subject ? await subjectPool(subject) : [];
  if (subject && pool.length === 0) notes.push(`No free photo of ${subject.label} found on Wikimedia Commons.`);
  const nextFromPool = (): FoundPhoto | null => pool.find((p) => !used.has(p.imageUrl)) || null;

  const place1 = async (photo: FoundPhoto, cover: boolean) => {
    const s = await storePhoto(photo, { cover });
    used.add(photo.imageUrl);
    return s;
  };

  // Cover: the subject itself when there is one, else the destination.
  let cover: "licensed" | "ai" | "none" = "none";
  const alts: string[] = [];
  const ctx = { place: dest, country, near: destNear };
  const candidates: (() => Promise<FoundPhoto | null>)[] = subject
    ? [async () => nextFromPool()]
    : [
        async () => (place?.image ? (await commonsFiles([place.image], "Wikidata image").catch(() => []))[0] || null : null),
        async () => (destNear ? findPhoto(blogCoverQueries(a.title, dest), used, ctx).catch(() => null) : null),
        async () => (place?.commonsCategory ? (await commonsCategoryPhotos(place.commonsCategory, dest).catch(() => [])).find(isScenePhoto) || null : null),
      ];
  for (const next of candidates) {
    if (cover !== "none") break;
    const photo = await next();
    if (!photo) continue;
    try {
      const s = await place1(photo, true);
      alts.push(altForPhoto(photo));
      await sql`UPDATE articles SET image = ${s.url}, image_alt = ${labelledAlt(altForPhoto(photo), subject?.label || "", dest)}, updated_at = now() WHERE id = ${articleId}`;
      await saveCoverSize(articleId, s);
      await saveImageMeta(articleId, { sourceType: "licensed", credit: creditLine(photo), license: photo.license, sourceUrl: photo.pageUrl });
      cover = "licensed";
    } catch {
      used.add(photo.imageUrl); // a photo that won't download: try the next one
    }
  }
  if (cover === "none" && opts.allowAi !== false && !a.image) {
    cover = await generateCoverImage(articleId, "", { auto: true }).then(() => "ai" as const).catch(() => "none" as const);
    notes.push(cover === "ai" ? "No proven free cover photo: an AI cover was made. Replace it if you have a real photo." : "No cover photo found.");
  }

  // Inline photos, one per chosen section: the section's own subject at the
  // destination (proven by position), else another photo of the subject.
  let html = html0;
  const placed: { url: string; photo: FoundPhoto }[] = [];
  if (opts.inline !== false) {
    // Work from the last section back so earlier positions don't shift.
    for (const idx of photoSections(headings.length).reverse()) {
      const sub = sectionSubject(headings[idx], dest);
      const named = sub && !(subject && fold(subject.label).includes(fold(sub)));
      let p: FoundPhoto | null = null;
      if (named && destNear) p = await findPhoto([`${sub} ${dest}`], used, { ...ctx, avoid: alts }).catch(() => null);
      if (!p) p = nextFromPool();
      if (!p) continue;
      try {
        const s = await place1(p, false);
        alts.push(altForPhoto(p));
        html = insertAfterSection(html, idx, figureHtml(s.url, labelledAlt(altForPhoto(p), p.proof && subject ? subject.label : sub, dest), captionHtml(p)));
        placed.push({ url: s.url, photo: p });
      } catch {
        used.add(p.imageUrl); /* skip photos that fail to download */
      }
    }
  }
  if (html !== a.content_html) {
    const stats = computeContentStats(html);
    await sql`UPDATE articles SET content_html = ${html}, word_count = ${stats.wordCount}, reading_time_minutes = ${stats.readingTimeMinutes}, updated_at = now() WHERE id = ${articleId}`;
    await recordAiRevision(articleId, `Photos placed in the guide (${placed.length})`);
  }
  await sql`UPDATE article_image_meta SET inline = ${JSON.stringify(placed.reverse().map((s) => ({ url: s.url, credit: creditLine(s.photo), license: s.photo.license, source: s.photo.pageUrl, proof: s.photo.proof || "taken nearby" })))}::jsonb WHERE article_id = ${articleId}`.catch(() => {});
  return { cover, inline: placed.length, notes };
}

const fold = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// Photos by section (index of the <h2> they follow), so text can be rewritten
// and the photos put back where they were.
export function sectionFigures(html: string): { index: number; figure: string }[] {
  const out: { index: number; figure: string }[] = [];
  let section = -1;
  const re = /<h2[^>]*>[\s\S]*?<\/h2>|<figure class="news-figure"[\s\S]*?<\/figure>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (/^<h2/i.test(m[0])) section++;
    else out.push({ index: section, figure: m[0] });
  }
  return out;
}

export function restoreFigures(html: string, figures: { index: number; figure: string }[]): string {
  let out = html;
  for (const f of [...figures].sort((a, b) => b.index - a.index)) {
    if (out.includes(f.figure)) continue;
    out = f.index >= 0 ? insertAfterSection(out, f.index, f.figure) : out.replace(/<\/p>/i, `</p>${f.figure}`);
  }
  return out;
}
