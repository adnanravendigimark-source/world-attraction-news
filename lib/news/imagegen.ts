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

// House style: a realistic scene-setting photograph of the place or subject.
// It never depicts a specific incident, recognisable people, logos or text,
// and the public page always labels it as AI-generated.
const STYLE =
  "Photorealistic documentary travel photograph, natural light, shot on a full-frame camera with a 35mm lens, realistic colors, " +
  "textures and depth of field, wide 3:2 composition, like a professional stock photo from a news travel desk. " +
  "A scene-setting image of the place or subject only. No recognisable people or faces, no text, signage, logos or watermarks, " +
  "and do not depict a specific news incident.";

export async function buildImagePrompt(articleId: string, extra = ""): Promise<string> {
  const rows = await sql`SELECT title, excerpt, news_cluster_id FROM articles WHERE id = ${articleId} AND type = 'news' LIMIT 1`;
  const a = rows[0];
  if (!a) throw new Error("News article not found.");
  const queries = await getQueries(articleId);
  // Prefer a concrete named subject (a place, landmark or aircraft) over the headline.
  let subject = queries[0] ? queries[0] : String(a.title || "").trim();
  if (!queries[0]) {
    const excerpt = String(a.excerpt || "").trim();
    if (excerpt) subject += `. ${excerpt}`;
  }
  if (a.news_cluster_id) {
    const r = await getLatestResearch(String(a.news_cluster_id));
    const f: any = r?.status === "done" ? r.facts : null;
    const where = f?.where && !/^(unknown|not stated)/i.test(String(f.where)) ? String(f.where) : "";
    if (where) subject += `. Setting: ${where}`;
  }
  const direction = extra.trim() ? ` Additional direction: ${extra.trim().slice(0, 300)}.` : "";
  return `Cover photograph for a travel news article. Subject: ${subject.slice(0, 400)}.${direction} ${STYLE}`;
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
      : { model, prompt, size: "1536x1024", quality: "medium", n: 1 };
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
  const prompt = await buildImagePrompt(articleId, extra);

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
  const title = String((await sql`SELECT title FROM articles WHERE id = ${articleId} LIMIT 1`)[0]?.title || "");
  // Say what the picture shows (the search subject, else the headline) and
  // that it is an illustration.
  const subject = (await getQueries(articleId))[0] || title;
  const alt = `AI-generated illustration: ${subject}`.slice(0, 200);
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
export function inlinePhotoLimit(words: number): number {
  return words < 150 ? 0 : words < 500 ? 1 : 2;
}

export async function ensureImages(
  articleId: string,
  opts: { allowAi?: boolean; inline?: boolean } = {}
): Promise<{ cover: "licensed" | "ai" | "none"; inline: number }> {
  const allowAi = opts.allowAi !== false;
  // Photos inside the text are optional: per call, else the automation setting.
  const wantInline = opts.inline ?? (await import("./jobs").then((m) => m.loadAutomation()).then((c) => c.inlinePhotos).catch(() => true));
  const rows = await sql`SELECT title, content_html FROM articles WHERE id = ${articleId} AND type = 'news' LIMIT 1`;
  const a = rows[0];
  if (!a) throw new Error("News article not found.");
  const title = String(a.title || "");
  let queries = await getQueries(articleId);
  if (queries.length === 0) queries = [title];
  else queries = [...queries, title];

  // A cover always; photos inside the text only when the story is long
  // enough that they don't break it up (see inlinePhotoLimit).
  const inlineLimit = wantInline ? inlinePhotoLimit(computeContentStats(stripOurFigures(String(a.content_html || ""))).wordCount) : 0;
  const used = new Set<string>();
  const photos: FoundPhoto[] = [];
  for (let i = 0; i < 1 + inlineLimit; i++) {
    const p = await findPhoto(queries.slice(i), used).catch(() => null);
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
