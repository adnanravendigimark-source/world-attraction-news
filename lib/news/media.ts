// Finds free-to-use photos for news articles and stores them in our own
// storage. Sources, in order: Unsplash (if UNSPLASH_ACCESS_KEY is set), then
// Wikimedia Commons (no key). Only photos with a clearly permissive licence
// are accepted, and every photo keeps its author, licence and source link so a
// caption can be shown.
import { sql } from "../db";
import { uploadImage, uploadNewsCover } from "../blob";
import { fetchPublicImage, isPublicUrl } from "./extract";
import { COUNTRIES } from "./placeData";

export interface FoundPhoto {
  provider: "unsplash" | "wikimedia";
  imageUrl: string; // downloadable file
  pageUrl: string; // human page for the photo
  author: string;
  license: string; // e.g. "CC BY-SA 4.0", "Unsplash License"
  licenseUrl: string;
  title: string;
  description?: string; // what the photo shows, when the provider says
  query: string;
  width?: number;
  height?: number;
  rawUrl?: string; // Unsplash: base image URL that takes size/crop parameters
}

const UA = "WorldAttractionNewsBot/1.0 (https://worldattractionnews.com; editorial image search)";

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/\s+/g, " ").trim();
}

const OK_LICENSE = /^(CC0|Public domain|PD\b|CC BY(?:-SA)?\b)/i;
const BAD_LICENSE = /\b(NC|ND)\b|non-?commercial|no ?derivs|fair use|GFDL only/i;

// Licences we can use commercially with a credit: CC0, public domain, CC BY
// and CC BY-SA. Anything non-commercial, no-derivatives or "fair use" is out.
export function isAllowedLicense(license: string): boolean {
  return !!license && OK_LICENSE.test(license) && !BAD_LICENSE.test(license);
}

// Alt text that says what the photo shows. Unsplash gives a description of
// the picture; Wikimedia gives a file name and a caption. File names are
// cleaned ("Heathrow_Terminal_5_(2019).jpg" -> "Heathrow Terminal 5") and
// used only when there is no usable caption.
export function altForPhoto(p: Pick<FoundPhoto, "provider" | "title" | "description" | "query">): string {
  // Upload-tool boilerplate, hashtags and doubled words don't belong in alt text.
  const tidy = (s: string) =>
    s
      .replace(/^\s*\d*px provided description:\s*/i, "")
      .replace(/\[[^\]]*#[^\]]*\]/g, " ")
      .replace(/#[\p{L}\p{N}_]+/gu, " ")
      .replace(/\b(\w+)\s+\1\b/gi, "$1")
      .replace(/\s+([,.;:])/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
  const sentence = (s: string) => {
    const t = tidy(s).replace(/^(this is |an? (photo|picture|image) of )/i, "");
    const first = t.split(/(?<=[.!?])\s/)[0].replace(/[.!?]+$/, "");
    return first.length >= 8 && first.length <= 125 ? first.charAt(0).toUpperCase() + first.slice(1) : "";
  };
  if (p.provider === "unsplash") {
    const alt = sentence(p.title || "");
    if (alt) return alt;
  } else {
    const fromCaption = sentence(p.description || "");
    if (fromCaption) return fromCaption;
    const file = tidy(
      String(p.title || "")
        .split(/\.(jpe?g|png|tiff?|webp)\b/i)[0]
        .replace(/^File:/i, "")
        .replace(/[_-]+/g, " ")
        .replace(/\(?\b(19|20)\d{2}\b\)?/g, " ")
        .replace(/\b(IMG|DSC|DSCF|DJI|P)\s?\d+\b/gi, " ")
        .replace(/[()]/g, " ")
    );
    if (file.length >= 6 && /[a-z]{3}/i.test(file)) return file.slice(0, 125);
  }
  const q = tidy(p.query);
  return (q.charAt(0).toUpperCase() + q.slice(1)).slice(0, 125);
}

const STOP = new Set("the a an of in on at and or for to with from by news airport airline flights flight new".split(" "));

function keywords(q: string): string[] {
  return q.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w));
}

async function jget(url: string, headers: Record<string, string> = {}): Promise<any> {
  const res = await fetch(url, { headers: { "User-Agent": UA, ...headers }, signal: AbortSignal.timeout(12_000), cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Unsplash search results don't say where a photo was taken ("aerial view of
// city buildings"), so the top few are looked up one by one: the photo's own
// page gives its location ("Barcelona, Spain") and tags, which the relevance
// check needs. Skipped when the hourly request allowance runs low.
const UNSPLASH_DETAILS = 3;
async function unsplashGet(url: string, key: string): Promise<{ json: any; remaining: number }> {
  const res = await fetch(url, { headers: { "User-Agent": UA, Authorization: `Client-ID ${key}`, "Accept-Version": "v1" }, signal: AbortSignal.timeout(12_000), cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { json: await res.json(), remaining: Number(res.headers.get("x-ratelimit-remaining") ?? 999) };
}

export function unsplashDescription(r: any): string {
  const loc = r?.location || {};
  return [
    r?.description || "",
    r?.alt_description || "",
    loc.name || "",
    loc.city || "",
    loc.country || "",
    ...(Array.isArray(r?.tags) ? r.tags.map((t: any) => t?.title).filter(Boolean) : []),
  ]
    .filter(Boolean)
    .join(" ");
}

async function searchUnsplash(query: string): Promise<FoundPhoto[]> {
  const key = process.env.UNSPLASH_ACCESS_KEY?.trim();
  if (!key) return [];
  const { json: j, remaining } = await unsplashGet(
    `https://api.unsplash.com/search/photos?per_page=6&orientation=landscape&content_filter=high&query=${encodeURIComponent(query)}`,
    key
  );
  const results: any[] = j?.results || [];
  // Location and tags for the top results, while the allowance lasts.
  let left = remaining;
  const detailed = await Promise.all(
    results.map(async (r, i) => {
      if (i >= UNSPLASH_DETAILS || left <= 10 || !r?.id) return r;
      left--;
      const d = await unsplashGet(`https://api.unsplash.com/photos/${encodeURIComponent(r.id)}`, key).catch(() => null);
      return d?.json ? { ...r, ...d.json } : r;
    })
  );
  return detailed.map((r: any) => ({
    provider: "unsplash" as const,
    imageUrl: r?.urls?.regular as string,
    pageUrl: `${r?.links?.html}?utm_source=world_attraction_news&utm_medium=referral`,
    author: r?.user?.name || "Unsplash contributor",
    license: "Unsplash License",
    licenseUrl: "https://unsplash.com/license",
    title: r?.alt_description || r?.description || query,
    description: unsplashDescription(r),
    query,
    width: Number(r?.width) || undefined,
    height: Number(r?.height) || undefined,
    rawUrl: typeof r?.urls?.raw === "string" ? r.urls.raw : undefined,
    _download: r?.links?.download_location as string,
    _profile: r?.user?.links?.html ? `${r.user.links.html}?utm_source=world_attraction_news&utm_medium=referral` : undefined,
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
    if (!isAllowedLicense(license)) continue;
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
      description: desc.slice(0, 300),
      query,
      width: Number(ii.width) || undefined,
    });
  }
  return out;
}

// ------------------------------------------------------------- relevance
//
// Why this exists: matching on any single word picked a Berlin cathedral for
// an Italy guide, a 19th-century painting for "best time to visit Barcelona"
// ("seasonal") and a butterfly for Bali. A photo now has to show the story's
// place (or name its specific subject in full), match the subject, and be a
// photograph of a scene, not artwork, a map or a close-up of an insect.

const fold = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// Not photographs of a place.
const NON_PHOTO = /\b(painting|oil on canvas|drawing|sketch|engraving|lithograph|etching|woodcut|watercolou?r|illustration|map|plan of|floor plan|diagram|chart|logo|coat of arms|emblem|seal of|poster|stamp|coin|banknote|screenshot|icon|render|rendering|3d model|manuscript|postcard|lineart|clipart)\b/;
// Close-ups that rarely illustrate a travel story, unless the story is about them.
const OFF_SUBJECT = /\b(butterfly|moth|insect|beetle|spider|bee|wasp|caterpillar|dragonfly|bird|gull|pigeon|lizard|snake|frog|flower|blossom|orchid|leaf|leaves|plant|fungus|mushroom|specimen|herbarium|macro|selfie|portrait|mugshot)\b/;
// Words that suggest a wide, scene-setting view.
const SCENE = /\b(skyline|panorama|panoramic|view|aerial|street|square|piazza|plaza|harbou?r|port|beach|old town|cityscape|landmark|terminal|station|exterior|waterfront|river|canal|bridge|temple|cathedral|palace|promenade|boulevard)\b/;

const HINT_WORDS = new Set(["skyline", "city", "view", "cityscape", "panorama"]);

export interface PhotoContext {
  place?: string; // the story's city or country, e.g. "Florence"
  country?: string; // the story's country, e.g. "Italy" (rejects Florence, Alabama)
}

// Every country name and alias, folded, mapped to its canonical name.
const COUNTRY_INDEX: [RegExp, string][] = Object.entries(COUNTRIES).flatMap(([name, aliases]) =>
  // Short aliases ("US", "UK") would match ordinary words like "us".
  [name, ...aliases].filter((n) => n.length >= 4 && /^[\p{L} ]+$/u.test(n)).map((n) => [new RegExp(`\\b${fold(n).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`), fold(name)] as [RegExp, string])
);
function countriesIn(text: string): Set<string> {
  const out = new Set<string>();
  for (const [re, name] of COUNTRY_INDEX) if (re.test(text)) out.add(name);
  return out;
}

// A score for how well a photo fits the search and the story, or null when it
// must not be used. Exported for tests.
export function scorePhoto(p: Pick<FoundPhoto, "title" | "description" | "query" | "width">, ctx: PhotoContext = {}): number | null {
  const text = fold(`${p.title || ""} ${p.description || ""}`);
  const query = fold(p.query || "");
  if (NON_PHOTO.test(text) && !NON_PHOTO.test(query)) return null;
  const off = text.match(OFF_SUBJECT);
  if (off && !query.includes(off[1])) return null;

  // Same-name places: a photo that names another country is a different
  // place (Florence, Alabama; Bali District, Taiwan).
  const country = fold(ctx.country || "");
  if (country) {
    const named = countriesIn(text);
    if (named.size > 0 && !named.has(country)) return null;
  }
  const placeWords = keywords(fold(ctx.place || ""));
  const placeHit = placeWords.length > 0 && placeWords.every((w) => text.includes(w));
  const countryWords = keywords(country);
  // "skyline" or "city view" in a fallback search only steer the search
  // engine; any good scenic photo of the right place will do.
  const subject = keywords(query).filter((w) => !placeWords.includes(w) && !HINT_WORDS.has(w));
  // A search that only names the country ("Netherlands tourism") doesn't
  // identify the story's city, so it can't stand in for the place.
  const specific = subject.filter((w) => !countryWords.includes(w));
  const matched = subject.filter((w) => text.includes(w)).length;
  const frac = subject.length ? matched / subject.length : 1;

  let ok: boolean;
  if (placeWords.length) {
    // The place itself, plus at least half the subject; or a named subject
    // matched in full ("King Khalid International" needs no "Riyadh").
    ok =
      (placeHit && (subject.length === 0 || (matched >= 1 && frac >= 0.5))) ||
      (specific.length >= 2 && specific.every((w) => text.includes(w)));
  } else {
    ok = matched >= 1 && frac >= 0.67;
  }
  if (!ok) return null;
  // Hint words still help rank: a skyline photo beats a stadium for "skyline".
  const hinted = keywords(query).some((w) => HINT_WORDS.has(w) && text.includes(w));
  return (placeHit ? 2 : 0) + frac * 2 + (SCENE.test(text) ? 0.5 : 0) + (hinted ? 0.5 : 0) + ((p.width || 0) >= 1600 ? 0.2 : 0);
}

// Best photo for a list of search terms, tried most specific first. Within one
// search the highest-scoring acceptable photo wins, not simply the first.
export async function findPhoto(queries: string[], exclude: Set<string> = new Set(), ctx: PhotoContext = {}): Promise<FoundPhoto | null> {
  for (const q of queries) {
    if (keywords(fold(q)).length === 0) continue;
    let best: { photo: FoundPhoto; score: number } | null = null;
    for (const search of [searchUnsplash, searchWikimedia]) {
      let results: FoundPhoto[] = [];
      try {
        results = await search(q);
      } catch {
        continue;
      }
      for (const r of results) {
        if (!r.imageUrl || exclude.has(r.imageUrl) || exclude.has(r.pageUrl) || !isPublicUrl(r.imageUrl)) continue;
        const score = scorePhoto(r, ctx);
        if (score !== null && (!best || score > best.score)) best = { photo: r, score };
      }
    }
    if (best) return best.photo;
  }
  return null;
}

// Unsplash's API terms require hotlinking: the photo is shown from Unsplash's
// own image URL, never downloaded and re-hosted. Their image server crops and
// sizes it, so a cover is still exactly 1200×675. Pure; exported for tests.
export function unsplashUrls(photo: Pick<FoundPhoto, "rawUrl" | "imageUrl" | "width" | "height">, cover: boolean): { url: string; width: number; height: number; originalUrl: string } {
  const base = photo.rawUrl || photo.imageUrl;
  const join = base.includes("?") ? "&" : "?";
  if (cover) return { url: `${base}${join}w=1200&h=675&fit=crop&crop=entropy&q=80&auto=format`, width: 1200, height: 675, originalUrl: photo.imageUrl };
  const w = 1600;
  const h = photo.width && photo.height ? Math.round((photo.height / photo.width) * w) : 1067;
  return { url: `${base}${join}w=${w}&fit=max&q=80&auto=format`, width: w, height: h, originalUrl: "" };
}

// Downloads the photo, re-encodes it and stores it in our own storage. A cover
// is cropped to 1200×675 and its original kept; an inline photo keeps its shape.
// Unsplash photos are hotlinked instead (see unsplashUrls).
export async function storePhoto(
  photo: FoundPhoto,
  opts: { cover?: boolean } = {}
): Promise<{ url: string; width: number; height: number; originalUrl: string }> {
  if (photo.provider === "unsplash") {
    // Unsplash asks for a download ping whenever a photo is used.
    const dl = (photo as any)._download as string | undefined;
    const key = process.env.UNSPLASH_ACCESS_KEY?.trim();
    if (dl && key) fetch(dl, { headers: { Authorization: `Client-ID ${key}` } }).catch(() => {});
    return unsplashUrls(photo, !!opts.cover);
  }
  const { type, buf } = await fetchPublicImage(photo.imageUrl, { headers: { "User-Agent": UA }, timeoutMs: 20_000, maxBytes: 12 * 1024 * 1024 }).catch((err) => {
    throw new Error(String(err?.message || "Photo download failed.").replace(/^Image/, "Photo"));
  });
  const file = new File([buf], "photo", { type });
  return opts.cover ? await uploadNewsCover(file) : { ...(await uploadImage(file, "news")), originalUrl: "" };
}

export function creditLine(p: FoundPhoto): string {
  const site = p.provider === "unsplash" ? "Unsplash" : "Wikimedia Commons";
  return `${p.author} / ${site}`;
}

export function captionHtml(p: FoundPhoto): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  // Unsplash's attribution format: "Photo by <name> on Unsplash", both linked.
  if (p.provider === "unsplash") {
    const profile = (p as any)._profile as string | undefined;
    const by = profile ? `<a href="${esc(profile)}" target="_blank">${esc(p.author)}</a>` : esc(p.author);
    return `Photo by ${by} on <a href="https://unsplash.com/?utm_source=world_attraction_news&amp;utm_medium=referral" target="_blank">Unsplash</a>`;
  }
  const site = "Wikimedia Commons";
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
