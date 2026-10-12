import { sql } from "../db";
import { NEWS_COVER, uploadNewsCover } from "../blob";
import { isPublicUrl, resolvesPublic } from "./extract";

import { IMAGE_SOURCE_TYPES, type ImageSourceType } from "./provenance";
export { IMAGE_SOURCE_TYPES, PROVENANCE_LABELS, type ImageSourceType } from "./provenance";

export interface ImageMeta {
  sourceType: ImageSourceType;
  credit: string;
  license: string;
  sourceUrl: string;
  // Size and original of the cover image at `coverUrl`. They describe the
  // article's cover only while `coverUrl` is still the article's image (an
  // unsaved upload in the editor doesn't count).
  coverUrl: string;
  width: number | null;
  height: number | null;
  originalUrl: string; // uncropped original, for re-cropping
}

// True when the article's current cover is a cropped 1200×675 image.
export function isNewsCoverSize(m: Pick<ImageMeta, "width" | "height" | "coverUrl">, image: string | null | undefined): boolean {
  return !!image && m.coverUrl === image && m.width === NEWS_COVER.width && m.height === NEWS_COVER.height;
}

export interface ImageCandidate {
  url: string;
  publisher: string;
  itemUrl: string;
}

const EMPTY: ImageMeta = { sourceType: "unverified", credit: "", license: "", sourceUrl: "", coverUrl: "", width: null, height: null, originalUrl: "" };

export async function getImageMeta(articleId: string): Promise<ImageMeta> {
  try {
    // cover_url/width/height/original_url arrive with scripts/setup-db.mjs.
    const rows = await sql`SELECT source_type, credit, license, source_url, cover_url, width, height, original_url FROM article_image_meta WHERE article_id = ${articleId} LIMIT 1`.catch(
      () => sql`SELECT source_type, credit, license, source_url, '' AS cover_url, NULL AS width, NULL AS height, '' AS original_url FROM article_image_meta WHERE article_id = ${articleId} LIMIT 1`
    );
    const r = rows[0];
    if (!r) return EMPTY;
    return {
      sourceType: r.source_type,
      credit: r.credit,
      license: r.license,
      sourceUrl: r.source_url,
      coverUrl: r.cover_url || "",
      width: r.width === null || r.width === undefined ? null : Number(r.width),
      height: r.height === null || r.height === undefined ? null : Number(r.height),
      originalUrl: r.original_url || "",
    };
  } catch {
    return EMPTY;
  }
}

// Records the stored cover's size and its uncropped original.
export async function saveCoverSize(articleId: string, c: { url: string; width: number; height: number; originalUrl: string }): Promise<void> {
  await sql`
    INSERT INTO article_image_meta (article_id, cover_url, width, height, original_url, updated_at)
    VALUES (${articleId}, ${c.url}, ${c.width}, ${c.height}, ${c.originalUrl}, now())
    ON CONFLICT (article_id) DO UPDATE SET cover_url = EXCLUDED.cover_url, width = EXCLUDED.width, height = EXCLUDED.height, original_url = EXCLUDED.original_url
  `.catch((err) => console.error("[news/images] saving the cover size failed (run scripts/setup-db.mjs):", err));
}

// Downloads an image we may use (our own storage or a story candidate already
// checked by the caller) as a File for re-encoding.
export async function downloadImage(url: string, label = "Image"): Promise<File> {
  if (!(await resolvesPublic(url))) throw new Error(`${label} URL isn't allowed.`);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: "follow", headers: { "User-Agent": "WorldAttractionNewsBot/1.0" } });
    if (!res.ok) throw new Error(`${label} download failed (HTTP ${res.status}).`);
    const type = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!["image/jpeg", "image/png", "image/webp"].includes(type)) throw new Error("Unsupported image type (need JPG, PNG or WebP).");
    return new File([await res.arrayBuffer()], "cover", { type });
  } catch (err: any) {
    throw new Error(err?.name === "AbortError" ? `${label} download timed out.` : err?.message || `${label} download failed.`);
  } finally {
    clearTimeout(timer);
  }
}

// Re-crops the current cover to 1200×675, from the stored original when there
// is one (covers made before cropping existed use the cover itself).
export async function recropCover(articleId: string): Promise<{ url: string; meta: ImageMeta }> {
  const a = (await sql`SELECT image FROM articles WHERE id = ${articleId} AND type = 'news' LIMIT 1`)[0];
  if (!a?.image) throw new Error("This article has no cover image to crop.");
  const meta = await getImageMeta(articleId);
  // The stored original belongs to the current cover only if it was recorded for it.
  const original = meta.coverUrl === a.image && meta.originalUrl ? meta.originalUrl : "";
  const file = await downloadImage(original || String(a.image), "Cover");
  const up = await uploadNewsCover(file);
  await sql`UPDATE articles SET image = ${up.url}, updated_at = now() WHERE id = ${articleId}`;
  await saveCoverSize(articleId, { url: up.url, width: up.width, height: up.height, originalUrl: original || up.originalUrl });
  return { url: up.url, meta: await getImageMeta(articleId) };
}

export async function saveImageMeta(articleId: string, m: Partial<ImageMeta>): Promise<ImageMeta> {
  const cur = await getImageMeta(articleId);
  const sourceType = IMAGE_SOURCE_TYPES.includes(m.sourceType as ImageSourceType) ? (m.sourceType as ImageSourceType) : cur.sourceType;
  const next: ImageMeta = {
    ...cur,
    sourceType,
    credit: (m.credit ?? cur.credit).slice(0, 200),
    license: (m.license ?? cur.license).slice(0, 200),
    sourceUrl: (m.sourceUrl ?? cur.sourceUrl).slice(0, 500),
  };
  await sql`
    INSERT INTO article_image_meta (article_id, source_type, credit, license, source_url, updated_at)
    VALUES (${articleId}, ${next.sourceType}, ${next.credit}, ${next.license}, ${next.sourceUrl}, now())
    ON CONFLICT (article_id) DO UPDATE SET source_type = EXCLUDED.source_type, credit = EXCLUDED.credit,
      license = EXCLUDED.license, source_url = EXCLUDED.source_url, updated_at = now()
  `;
  return next;
}

// Images that the story's own feed items carried. Reference only: publishers
// own these, so importing one marks it "unverified" until an editor records
// the real rights.
export async function listCandidates(articleId: string): Promise<ImageCandidate[]> {
  const rows = await sql`
    SELECT DISTINCT ON (i.image_url) i.image_url, i.url, s.name
    FROM articles a
    JOIN news_items i ON i.cluster_id = a.news_cluster_id
    LEFT JOIN news_sources s ON s.id = i.source_id
    WHERE a.id = ${articleId} AND i.image_url IS NOT NULL AND i.image_url <> ''
    LIMIT 8
  `;
  return rows.map((r: any) => ({ url: r.image_url, publisher: r.name || "", itemUrl: r.url || "" }));
}

// Downloads an image into our own storage (re-encoded, size-capped) and makes
// it the article cover. Only URLs from this story's own candidates are allowed.
export async function importCandidate(articleId: string, imageUrl: string): Promise<{ url: string; meta: ImageMeta }> {
  const candidates = await listCandidates(articleId);
  const cand = candidates.find((c) => c.url === imageUrl);
  if (!cand) throw new Error("That image isn't one of this story's candidates.");
  if (!isPublicUrl(cand.url)) throw new Error("Image URL isn't allowed.");

  const uploaded = await uploadNewsCover(await downloadImage(cand.url));
  await saveCoverSize(articleId, uploaded);

  const title = (await sql`SELECT title FROM articles WHERE id = ${articleId} LIMIT 1`)[0]?.title || "";
  await sql`UPDATE articles SET image = ${uploaded.url}, image_alt = CASE WHEN COALESCE(image_alt, '') = '' THEN ${title} ELSE image_alt END, updated_at = now() WHERE id = ${articleId}`;
  const meta = await saveImageMeta(articleId, {
    sourceType: "unverified",
    credit: cand.publisher,
    license: "Not verified. Record the rights before publishing.",
    sourceUrl: cand.itemUrl,
  });
  return { url: uploaded.url, meta };
}
