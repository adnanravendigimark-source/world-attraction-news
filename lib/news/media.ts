// Finds free-to-use photos for news articles and stores them in our own
// storage. Sources, in order: Unsplash (if UNSPLASH_ACCESS_KEY is set), then
// Wikimedia Commons (no key). Only photos with a clearly permissive licence
// are accepted, and every photo keeps its author, licence and source link so a
// caption can be shown.
import { sql } from "../db";
import { uploadImage } from "../blob";
import { isPublicUrl } from "./extract";

export interface FoundPhoto {
  provider: "unsplash" | "wikimedia";
  imageUrl: string; // downloadable file
  pageUrl: string; // human page for the photo
  author: string;
  license: string; // e.g. "CC BY-SA 4.0", "Unsplash License"
  licenseUrl: string;
  title: string;
  query: string;
}

const UA = "WorldAttractionNewsBot/1.0 (https://worldattractionnews.com; editorial image search)";

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/\s+/g, " ").trim();
}

const OK_LICENSE = /^(CC0|Public domain|PD\b|CC BY(?:-SA)?\b)/i;
const BAD_LICENSE = /\b(NC|ND)\b|non-?commercial|no ?derivs|fair use|GFDL only/i;

const STOP = new Set("the a an of in on at and or for to with from by news airport airline flights flight new".split(" "));

function keywords(q: string): string[] {
  return q.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w));
}

async function jget(url: string, headers: Record<string, string> = {}): Promise<any> {
  const res = await fetch(url, { headers: { "User-Agent": UA, ...headers }, signal: AbortSignal.timeout(12_000), cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function searchUnsplash(query: string): Promise<FoundPhoto[]> {
  const key = process.env.UNSPLASH_ACCESS_KEY?.trim();
  if (!key) return [];
  const j = await jget(`https://api.unsplash.com/search/photos?per_page=6&orientation=landscape&content_filter=high&query=${encodeURIComponent(query)}`, {
    Authorization: `Client-ID ${key}`,
  });
  return (j?.results || []).map((r: any) => ({
    provider: "unsplash" as const,
    imageUrl: r?.urls?.regular as string,
    pageUrl: `${r?.links?.html}?utm_source=world_attraction_news&utm_medium=referral`,
    author: r?.user?.name || "Unsplash contributor",
    license: "Unsplash License",
    licenseUrl: "https://unsplash.com/license",
    title: r?.alt_description || r?.description || query,
    query,
    _download: r?.links?.download_location as string,
  }));
}

async function searchWikimedia(query: string): Promise<FoundPhoto[]> {
  const url =
    "https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=15" +
    `&gsrsearch=${encodeURIComponent(`${query} filetype:bitmap`)}` +
    "&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=1600&origin=*";
  const j = await jget(url);
  const pages: any[] = Object.values(j?.query?.pages || {});
  const out: FoundPhoto[] = [];
  for (const p of pages) {
    const ii = p?.imageinfo?.[0];
    if (!ii) continue;
    if (!/^image\/(jpeg|png)$/.test(ii.mime || "")) continue;
    if ((ii.width || 0) < 1000 || (ii.width || 0) < (ii.height || 0)) continue; // landscape, decent size
    const m = ii.extmetadata || {};
    const license = stripTags(String(m.LicenseShortName?.value || ""));
    if (!license || !OK_LICENSE.test(license) || BAD_LICENSE.test(license)) continue;
    const author = stripTags(String(m.Artist?.value || "")).slice(0, 120) || "Wikimedia Commons contributor";
    const desc = stripTags(String(m.ImageDescription?.value || ""));
    out.push({
      provider: "wikimedia",
      imageUrl: ii.thumburl || ii.url,
      pageUrl: ii.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title)}`,
      author,
      license,
      licenseUrl: String(m.LicenseUrl?.value || ""),
      title: `${String(p.title || "").replace(/^File:/, "")} ${desc}`.slice(0, 300),
      query,
    });
  }
  return out;
}

// Best photo for a list of search terms. A result must mention at least one
// meaningful word from the query, to avoid unrelated pictures.
export async function findPhoto(queries: string[], exclude: Set<string> = new Set()): Promise<FoundPhoto | null> {
  for (const q of queries) {
    const kws = keywords(q);
    if (kws.length === 0) continue;
    for (const search of [searchUnsplash, searchWikimedia]) {
      let results: FoundPhoto[] = [];
      try {
        results = await search(q);
      } catch {
        continue;
      }
      const hit = results.find((r) => {
        if (!r.imageUrl || exclude.has(r.imageUrl) || !isPublicUrl(r.imageUrl)) return false;
        if (r.provider === "unsplash") return true; // the API already ranks by relevance
        const hay = r.title.toLowerCase();
        return kws.some((k) => hay.includes(k));
      });
      if (hit) return hit;
    }
  }
  return null;
}

// Downloads the photo, re-encodes it and stores it in our own storage.
export async function storePhoto(photo: FoundPhoto): Promise<{ url: string }> {
  const res = await fetch(photo.imageUrl, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Photo download failed (HTTP ${res.status}).`);
  const type = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!["image/jpeg", "image/png", "image/webp"].includes(type)) throw new Error("Unsupported photo type.");
  const buf = await res.arrayBuffer();
  if (buf.byteLength > 12 * 1024 * 1024) throw new Error("Photo is too large.");
  const uploaded = await uploadImage(new File([buf], "photo", { type }), "news");
  // Unsplash asks for a download ping when a photo is used.
  const dl = (photo as any)._download as string | undefined;
  const key = process.env.UNSPLASH_ACCESS_KEY?.trim();
  if (dl && key) fetch(dl, { headers: { Authorization: `Client-ID ${key}` } }).catch(() => {});
  return { url: uploaded.url };
}

export function creditLine(p: FoundPhoto): string {
  const site = p.provider === "unsplash" ? "Unsplash" : "Wikimedia Commons";
  return `${p.author} / ${site}`;
}

export function captionHtml(p: FoundPhoto): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const site = p.provider === "unsplash" ? "Unsplash" : "Wikimedia Commons";
  return `Photo: ${esc(p.author)} / <a href="${esc(p.pageUrl)}" target="_blank">${site}</a> · ${esc(p.license)}`;
}

// ---------------------------------------------------------------- in-article

const FIG_RE = /<figure class="news-figure">[\s\S]*?<\/figure>/g;

export function stripOurFigures(html: string): string {
  return html.replace(FIG_RE, "");
}

// Inserts figures after paragraphs, spread evenly through the article.
export function insertFigures(html: string, figures: string[]): string {
  if (figures.length === 0) return html;
  const parts = html.split(/(?<=<\/p>)/); // keep closing tag with each block
  const paraIdx: number[] = [];
  parts.forEach((p, i) => {
    if (/<\/p>\s*$/.test(p)) paraIdx.push(i);
  });
  if (paraIdx.length < 3) return html + figures.join("");
  const used = new Set<number>();
  figures.forEach((fig, k) => {
    // after the 2nd paragraph for the first figure, then evenly spaced
    let target = Math.min(paraIdx.length - 2, Math.max(1, Math.round(((k + 1) * paraIdx.length) / (figures.length + 1))));
    while (used.has(target) && target < paraIdx.length - 1) target++;
    used.add(target);
    parts[paraIdx[target]] += fig;
  });
  return parts.join("");
}

export function figureHtml(url: string, alt: string, caption: string): string {
  const safeAlt = alt.replace(/"/g, "&quot;").slice(0, 200);
  return `<figure class="news-figure"><img src="${url}" alt="${safeAlt}"><figcaption>${caption}</figcaption></figure>`;
}

// ------------------------------------------------------------------ queries

export async function getQueries(articleId: string): Promise<string[]> {
  try {
    const rows = await sql`SELECT queries FROM article_image_meta WHERE article_id = ${articleId} LIMIT 1`;
    return Array.isArray(rows[0]?.queries) ? rows[0].queries : [];
  } catch {
    return [];
  }
}

export async function saveQueries(articleId: string, queries: string[]): Promise<void> {
  const clean = queries.filter((q) => typeof q === "string" && q.trim().length > 2).map((q) => q.trim().slice(0, 80)).slice(0, 5);
  await sql`
    INSERT INTO article_image_meta (article_id, queries, updated_at) VALUES (${articleId}, ${JSON.stringify(clean)}::jsonb, now())
    ON CONFLICT (article_id) DO UPDATE SET queries = EXCLUDED.queries`;
}
