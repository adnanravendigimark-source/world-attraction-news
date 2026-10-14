import { sql } from "../db";
import { uploadNewsCover } from "../blob";
import { getLatestResearch } from "./research";
import { saveCoverSize, saveImageMeta, type ImageMeta } from "./images";
import { altForPhoto, captionHtml, creditLine, figureHtml, findPhoto, getQueries, insertFigures, stripOurFigures, storePhoto, type FoundPhoto } from "./media";
import { computeContentStats } from "../articles";
import { recordAiRun } from "./aiRuns";
import { recordAiRevision } from "./aiRevision";

const IMAGE_MODEL = () => process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
const DAILY_CAP = () => Number(process.env.NEWS_IMAGE_DAILY_CAP || 20);
// "high" gives sharper, more detailed covers at several times the cost of
// "medium" (the default, to keep spend low). Set OPENAI_IMAGE_QUALITY=high to opt in.
const imageQuality = () => (["low", "medium", "high"].includes(String(process.env.OPENAI_IMAGE_QUALITY)) ? String(process.env.OPENAI_IMAGE_QUALITY) : "medium");

// ------------------------------------------------------------- AI prompt
//
// An AI image is used only when no suitable licensed photo exists, and the
// public page always labels it as AI-generated. It must read as premium
// editorial travel photography of the story's real place, without pretending
// to show the news event itself.

// What to show for each kind of story. The scene sets the place and the
// subject; it never depicts the incident (no damage, strikes or crowds).
const STORY_SCENES: [RegExp, string, string?][] = [
  [/\b(strike|strikes|missile|attack|war|conflict|protest|unrest|security)\b/i, "a calm, wide establishing view of {place} on an ordinary day", "No sign of conflict, damage, smoke, weapons, military or emergency vehicles."],
  [/\b(hurricane|storm|typhoon|cyclone|flood|earthquake|wildfire|fire|volcano|eruption|heatwave|weather)\b/i, "a calm, wide establishing view of {place} in natural daylight", "No storm, damage, flooding, fire or rescue scenes."],
  [/\b(airport|terminal|flight|flights|airline|airlines|aviation|route|routes|runway|aircraft|plane)\b/i, "{subject}: an airport terminal exterior or a modern aircraft on the apron at {place}", "Aircraft in plain, unbranded white livery."],
  [/\b(visa|visas|passport|border|entry rules?|immigration|e-?visa|tourist tax|levy|fee|fees)\b/i, "an uncrowded, recognisable street-level view of {place} as travellers see it on arrival"],
  [/\b(boat|boats|river cruise|canal|canals|gondola)\b/i, "{subject}: a small sightseeing boat on the water in {place}, with the city's real waterfront behind it"],
  [/\b(cruise|cruises|ship|port|ferry)\b/i, "{subject}: a cruise ship or ferry at the waterfront of {place}", "Ship in plain, unbranded livery."],
  [/\b(train|rail|railway|station|metro|high-speed)\b/i, "{subject}: a modern train or the main railway station of {place}"],
  [/\b(hotel|resort|stay|accommodation)\b/i, "{subject}: an elegant hotel exterior or lobby typical of {place}"],
  [/\b(museums?|exhibitions?|galler(y|ies)|opens|opening|attractions?|parks?|theme parks?|landmarks?|sights|must-see)\b/i, "{subject}: the exterior of the attraction or venue in {place}, as a visitor approaches it"],
  [/\b(festivals?|concerts?|events?|celebrations?|parades?|markets?)\b/i, "{subject}: the setting of the event in {place}", "Decorated but without close-up faces."],
  [/\b(beach(es)?|islands?|coast|bay)\b/i, "{subject}: the coastline and beach of {place} in clear light"],
  [/\b(food|restaurants?|cuisine|dish(es)?|dining|eat)\b/i, "{subject}: a local dish or restaurant setting typical of {place}"],
];

const STYLE =
  "Premium editorial travel photograph for a news website. Photorealistic, natural light, true-to-life colour, " +
  "professional composition with a clear subject, sharp focus and gentle depth of field, as taken by an experienced travel photographer " +
  "with a full-frame camera. Wide landscape framing with the main subject centred and calm space at the top and bottom, so it can be cropped to 16:9.";

const RULES =
  "Show real architecture and landscapes as they actually look; if unsure of a landmark's exact appearance, show a wider, accurate " +
  "street-level or skyline view of the place instead of an invented close-up. No text, lettering, signage, captions, logos, brand names, " +
  "watermarks or flags with writing. No recognisable faces. Do not depict the news event itself, damage, injuries, weapons or emergencies. " +
  "Not an illustration, painting, 3D render or collage, and not a generic stock photo.";

export interface PromptInput {
  title: string;
  excerpt?: string;
  place?: string; // "Florence, Italy"
  where?: string; // research's "where", e.g. "King Khalid International Airport, Riyadh"
  subject?: string; // the writer's most specific photo subject
  type?: string; // "news" or "guide"
  extra?: string; // an editor's direction
}

// The prompt and a plain description of the scene (used for the alt text).
// Pure; exported for tests.
export function composeImagePrompt(i: PromptInput): { prompt: string; scene: string } {
  const place = (i.place || i.where || "").trim();
  const subject = (i.subject || "").trim() || place || i.title.trim();
  // The headline decides the kind of scene; the standfirst only when the
  // headline gives no clue ("dining etiquette" in a sights guide is not a food story).
  const hit = STORY_SCENES.find(([re]) => re.test(i.title)) || STORY_SCENES.find(([re]) => re.test(i.excerpt || ""));
  const placeName = place.split(",")[0].trim().toLowerCase();
  const subjectNamesPlace = !!placeName && subject.toLowerCase().includes(placeName);
  const template = hit?.[1] || (subjectNamesPlace ? "{subject}, as a visitor would see it" : "{subject} in {place}, as a visitor would see it");
  const avoid = hit?.[2] || "";
  const scene = template
    .replace(/\{subject\}/g, subject)
    .replace(/\{place\}/g, place || "the destination")
    .replace(/^([^:]+): \1/, "$1")
    .replace(/\s+/g, " ")
    .trim();
  const lines = [
    `Cover photograph for a travel ${i.type === "news" ? "news story" : "guide"} titled "${i.title.trim().slice(0, 140)}".`,
    place ? `Location: ${place}${i.where && i.where !== place ? ` (${i.where.slice(0, 120)})` : ""}.` : "",
    `Scene: ${scene}.${avoid ? ` ${avoid}` : ""}`,
    i.extra?.trim() ? `Editor's direction: ${i.extra.trim().slice(0, 300)}.` : "",
    STYLE,
    RULES,
  ];
  return { prompt: lines.filter(Boolean).join(" "), scene };
}

export async function buildImagePrompt(articleId: string, extra = ""): Promise<{ prompt: string; scene: string }> {
  const a = (await sql`
    SELECT a.title, a.excerpt, a.news_cluster_id, a.type, ci.name AS city, COALESCE(ci.country, co.name) AS country
    FROM articles a LEFT JOIN cities ci ON ci.id = a.city_id LEFT JOIN countries co ON co.id = a.country_id
    WHERE a.id = ${articleId} LIMIT 1`)[0];
  if (!a) throw new Error("Article not found.");
  const queries = await getQueries(articleId);
  let where = "";
  if (a.news_cluster_id) {
    const r = await getLatestResearch(String(a.news_cluster_id));
    const f: any = r?.status === "done" ? r.facts : null;
    where = f?.where && !/^(unknown|not stated)/i.test(String(f.where)) ? String(f.where) : "";
  }
  // Guides have no stored search phrase: their topic comes from the headline
  // ("Arno Boat Tour: Your Ultimate Guide in Florence" -> "Arno Boat Tour").
  const guideSubject =
    !queries[0] && a.type !== "news"
      ? (await import("../blogs/images")).sectionSubject(String(a.title || "").split(":")[0], String(a.city || a.country || ""))
      : "";
  return composeImagePrompt({
    title: String(a.title || ""),
    excerpt: String(a.excerpt || ""),
    place: [a.city, a.country].filter(Boolean).join(", "),
    where,
    subject: queries[0] || guideSubject,
    type: String(a.type || ""),
    extra,
  });
}

async function checkCap(): Promise<void> {
  const rows = await sql`SELECT COUNT(*)::int AS n FROM article_image_meta WHERE source_type = 'ai' AND updated_at > now() - interval '24 hours'`;
  if (Number(rows[0]?.n ?? 0) >= DAILY_CAP()) throw new Error(`Daily AI image limit reached (${DAILY_CAP()}). Try again tomorrow or upload an image.`);
}

// Every image call is logged in ai_runs (Phase 12), success or failure.
async function callOpenAI(model: string, prompt: string, articleId?: string): Promise<Buffer> {
  const started = Date.now();
  try {
    const png = await requestImage(model, prompt);
    await recordAiRun({ kind: "image", model, articleId, images: 1, durationMs: Date.now() - started, outcome: "ok" });
    return png;
  } catch (err: any) {
    await recordAiRun({ kind: "image", model, articleId, durationMs: Date.now() - started, outcome: "error", error: String(err?.message || err) });
    throw err;
  }
}

async function requestImage(model: string, prompt: string): Promise<Buffer> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set.");
  const body: Record<string, unknown> =
    model === "dall-e-3"
      ? { model, prompt, size: "1792x1024", response_format: "b64_json", n: 1 }
      : { model, prompt, size: "1536x1024", quality: imageQuality(), n: 1 };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 55_000);
  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = String(json?.error?.message || `HTTP ${res.status}`);
      const err: any = new Error(msg);
      err.status = res.status;
      throw err;
    }
    const b64 = json?.data?.[0]?.b64_json;
    if (!b64) throw new Error("OpenAI returned no image.");
    return Buffer.from(b64, "base64");
  } catch (err: any) {
    if (err?.name === "AbortError") throw new Error("Image generation timed out. Try again.");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function generateCoverImage(articleId: string, extra = ""): Promise<{ url: string; alt: string; prompt: string; meta: ImageMeta }> {
  await checkCap();
  const { prompt, scene } = await buildImagePrompt(articleId, extra);

  let png: Buffer;
  try {
    png = await callOpenAI(IMAGE_MODEL(), prompt, articleId);
  } catch (err: any) {
    // gpt-image-1 needs a verified org; fall back to dall-e-3 when it's unavailable.
    const msg = String(err?.message || "");
    if (IMAGE_MODEL() !== "dall-e-3" && (err?.status === 403 || err?.status === 404 || /verif|must be verified|does not exist|access/i.test(msg))) {
      png = await callOpenAI("dall-e-3", prompt, articleId);
    } else {
      throw err;
    }
  }

  const file = new File([new Uint8Array(png)], "cover.png", { type: "image/png" });
  const uploaded = await uploadNewsCover(file);
  await saveCoverSize(articleId, uploaded);
  // Alt text says what the picture shows (the scene asked for), and that it
  // is AI-generated, never the headline.
  const alt = `AI-generated image: ${scene.charAt(0).toUpperCase()}${scene.slice(1)}`.slice(0, 200);
  await sql`
    UPDATE articles SET image = ${uploaded.url}, image_alt = ${alt}, updated_at = now()
    WHERE id = ${articleId}`;
  const meta = await saveImageMeta(articleId, {
    sourceType: "ai",
    credit: "",
    license: "AI-generated image (OpenAI)",
    sourceUrl: "",
  });
  return { url: uploaded.url, alt, prompt, meta };
}

// Finds real, free-to-use photos for an article: one cover (AI fallback only
// if none is found) plus up to two inline photos placed between paragraphs.
// Inline photos per story length: one photo between paragraphs for a normal
// news story (150+ words), two from 500 words. Very short items get none.
// Search order: the writer's specific subjects first, then wide views of the
// place, then the headline. Exported for tests.
export function photoQueries(writerQueries: string[], place: string, title: string): string[] {
  const out = [...writerQueries];
  if (place) out.push(`${place} skyline`, `${place} city view`);
  out.push(title);
  return [...new Set(out.map((q) => q.trim()).filter(Boolean))];
}

export function inlinePhotoLimit(words: number): number {
  return words < 150 ? 0 : words < 500 ? 1 : 2;
}

export async function ensureImages(
  articleId: string,
  opts: { allowAi?: boolean; inline?: boolean } = {}
): Promise<{ cover: "licensed" | "ai" | "none"; inline: number }> {
  const allowAi = opts.allowAi !== false;
  // Photos inside the text are optional: per call, else the automation setting.
  // AI blogs place photos per section (Track B5).
  const kind = (await sql`SELECT type, origin FROM articles WHERE id = ${articleId} LIMIT 1`)[0];
  if (kind && kind.type !== "news" && kind.origin === "ai_blog") return (await import("../blogs/images")).ensureBlogImages(articleId, opts);
  const wantInline = opts.inline ?? (await import("./jobs").then((m) => m.loadAutomation()).then((c) => c.inlinePhotos).catch(() => true));
  const rows = await sql`
    SELECT a.title, a.content_html, ci.name AS city, COALESCE(ci.country, co.name) AS country
    FROM articles a LEFT JOIN cities ci ON ci.id = a.city_id LEFT JOIN countries co ON co.id = a.country_id
    WHERE a.id = ${articleId} AND a.type = 'news' LIMIT 1`;
  const a = rows[0];
  if (!a) throw new Error("News article not found.");
  const title = String(a.title || "");
  // Photos must show the story's place (see scorePhoto in media.ts).
  const place = String(a.city || a.country || "");
  const country = String(a.country || "");
  const queries = photoQueries(await getQueries(articleId), place, title);

  // A cover always; photos inside the text only when the story is long
  // enough that they don't break it up (see inlinePhotoLimit).
  const inlineLimit = wantInline ? inlinePhotoLimit(computeContentStats(stripOurFigures(String(a.content_html || ""))).wordCount) : 0;
  const used = new Set<string>();
  const photos: FoundPhoto[] = [];
  for (let i = 0; i < 1 + inlineLimit; i++) {
    const p = await findPhoto(queries.slice(i), used, { place, country }).catch(() => null);
    if (!p) break;
    used.add(p.imageUrl);
    photos.push(p);
  }

  let cover: "licensed" | "ai" | "none" = "none";
  // The first photo that stores becomes the cover (cropped to 1200×675).
  const stored: { url: string; photo: FoundPhoto; width: number; height: number; originalUrl: string }[] = [];
  for (const p of photos) {
    try {
      stored.push({ ...(await storePhoto(p, { cover: stored.length === 0 })), photo: p });
    } catch {
      /* skip photos that fail to download */
    }
  }

  const existing = await sql`SELECT image FROM articles WHERE id = ${articleId} LIMIT 1`;
  const hasCover = Boolean(existing[0]?.image);
  const first = stored[0];
  let inlinePhotos = stored;
  if (first) {
    await sql`UPDATE articles SET image = ${first.url}, image_alt = ${altForPhoto(first.photo)}, updated_at = now() WHERE id = ${articleId}`;
    await saveCoverSize(articleId, first);
    await saveImageMeta(articleId, {
      sourceType: "licensed",
      credit: creditLine(first.photo),
      license: first.photo.license,
      sourceUrl: first.photo.pageUrl,
    });
    cover = "licensed";
    inlinePhotos = stored.slice(1, 1 + inlineLimit);
  } else if (allowAi && !hasCover) {
    try {
      await generateCoverImage(articleId);
      cover = "ai";
    } catch {
      cover = "none";
    }
  }

  const figures = inlinePhotos.map((s) => figureHtml(s.url, altForPhoto(s.photo), captionHtml(s.photo)));
  const base = stripOurFigures(String(a.content_html || ""));
  const html = insertFigures(base, figures);
  if (html !== a.content_html) {
    const stats = computeContentStats(html);
    await sql`UPDATE articles SET content_html = ${html}, word_count = ${stats.wordCount}, reading_time_minutes = ${stats.readingTimeMinutes}, updated_at = now() WHERE id = ${articleId}`;
    await recordAiRevision(articleId, inlinePhotos.length ? `Photos placed in the article (${inlinePhotos.length})` : "Photos removed from the article");
  }
  await sql`UPDATE article_image_meta SET inline = ${JSON.stringify(inlinePhotos.map((s) => ({ url: s.url, credit: creditLine(s.photo), license: s.photo.license, source: s.photo.pageUrl })))}::jsonb WHERE article_id = ${articleId}`;
  return { cover, inline: inlinePhotos.length };
}

// What the automatic step would pick, without storing or changing anything:
// for checking image choices across stories. Makes photo searches only (no AI).
export async function previewImages(articleId: string): Promise<{
  place: string;
  queries: string[];
  cover: { title: string; provider: string; query: string; pageUrl: string; license: string; alt: string } | null;
  aiPrompt: string;
  aiAlt: string;
}> {
  const a = (await sql`
    SELECT a.title, a.type, a.origin, ci.name AS city, COALESCE(ci.country, co.name) AS country
    FROM articles a LEFT JOIN cities ci ON ci.id = a.city_id LEFT JOIN countries co ON co.id = a.country_id
    WHERE a.id = ${articleId} LIMIT 1`)[0];
  if (!a) throw new Error("Article not found.");
  const place = String(a.city || a.country || "");
  const country = String(a.country || "");
  const queries =
    a.type === "news"
      ? photoQueries(await getQueries(articleId), place, String(a.title || ""))
      : (await import("../blogs/images")).blogCoverQueries(String(a.title || ""), place);
  const p = await findPhoto(queries, new Set(), { place, country }).catch(() => null);
  const { prompt, scene } = await buildImagePrompt(articleId);
  return {
    place,
    queries,
    cover: p ? { title: p.title, provider: p.provider, query: p.query, pageUrl: p.pageUrl, license: p.license, alt: altForPhoto(p) } : null,
    aiPrompt: prompt,
    aiAlt: `AI-generated image: ${scene.charAt(0).toUpperCase()}${scene.slice(1)}`.slice(0, 200),
  };
}
