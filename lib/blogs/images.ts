// Track B5 — photos for AI blogs: a cover plus one photo for every second
// section, each looked up from that section's subject (a landmark, a dish, a
// street) and the destination. Free-licence photos first (Wikimedia,
// Unsplash); an AI image only as the cover fallback.

import { sql } from "../db";
import { computeContentStats } from "../articles";
import { altForPhoto, captionHtml, creditLine, figureHtml, findPhoto, storePhoto, stripOurFigures, type FoundPhoto } from "../news/media";
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

export async function ensureBlogImages(articleId: string, opts: { allowAi?: boolean; inline?: boolean } = {}): Promise<{ cover: "licensed" | "ai" | "none"; inline: number }> {
  const a = (await sql`
    SELECT a.title, a.content_html, a.image, ci.name AS city, co.name AS country, ci.country AS city_country
    FROM articles a LEFT JOIN cities ci ON ci.id = a.city_id LEFT JOIN countries co ON co.id = a.country_id
    WHERE a.id = ${articleId} LIMIT 1`)[0] as any;
  if (!a) throw new Error("Article not found.");
  const dest = String(a.city || a.country || "");
  const country = String(a.city_country || a.country || "");
  const html0 = stripOurFigures(String(a.content_html || ""));
  const headings = [...html0.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) => m[1].replace(/<[^>]+>/g, "").trim());
  const used = new Set<string>();

  // Cover: the destination itself reads best as a lead photo.
  let cover: "licensed" | "ai" | "none" = "none";
  const coverPhoto = await findPhoto(blogCoverQueries(a.title, dest), used, { place: dest, country }).catch(() => null);
  if (coverPhoto) {
    try {
      const s = await storePhoto(coverPhoto, { cover: true });
      used.add(coverPhoto.imageUrl);
      await sql`UPDATE articles SET image = ${s.url}, image_alt = ${altForPhoto(coverPhoto)}, updated_at = now() WHERE id = ${articleId}`;
      await saveCoverSize(articleId, s);
      await saveImageMeta(articleId, { sourceType: "licensed", credit: creditLine(coverPhoto), license: coverPhoto.license, sourceUrl: coverPhoto.pageUrl });
      cover = "licensed";
    } catch {
      /* fall through to the AI fallback */
    }
  }
  if (cover === "none" && opts.allowAi !== false && !a.image) {
    cover = await generateCoverImage(articleId, "", { auto: true }).then(() => "ai" as const).catch(() => "none" as const);
  }

  // Inline photos, one per chosen section.
  let html = html0;
  const placed: { url: string; photo: FoundPhoto }[] = [];
  if (opts.inline !== false) {
    // Work from the last section back so earlier positions don't shift.
    for (const idx of photoSections(headings.length).reverse()) {
      const subject = sectionSubject(headings[idx], dest);
      const p = await findPhoto([subject ? `${subject} ${dest}` : dest, dest], used, { place: dest, country }).catch(() => null);
      if (!p) continue;
      try {
        const s = await storePhoto(p);
        used.add(p.imageUrl);
        html = insertAfterSection(html, idx, figureHtml(s.url, altForPhoto(p), captionHtml(p)));
        placed.push({ url: s.url, photo: p });
      } catch {
        /* skip photos that fail to download */
      }
    }
  }
  if (html !== a.content_html) {
    const stats = computeContentStats(html);
    await sql`UPDATE articles SET content_html = ${html}, word_count = ${stats.wordCount}, reading_time_minutes = ${stats.readingTimeMinutes}, updated_at = now() WHERE id = ${articleId}`;
    await recordAiRevision(articleId, `Photos placed in the guide (${placed.length})`);
  }
  await sql`UPDATE article_image_meta SET inline = ${JSON.stringify(placed.reverse().map((s) => ({ url: s.url, credit: creditLine(s.photo), license: s.photo.license, source: s.photo.pageUrl })))}::jsonb WHERE article_id = ${articleId}`.catch(() => {});
  return { cover, inline: placed.length };
}

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
