import { sql } from "../db";
import { uploadImage } from "../blob";
import { isPublicUrl } from "./extract";

export const IMAGE_SOURCE_TYPES = ["licensed", "own", "permission", "ai", "unverified"] as const;
export type ImageSourceType = (typeof IMAGE_SOURCE_TYPES)[number];

export interface ImageMeta {
  sourceType: ImageSourceType;
  credit: string;
  license: string;
  sourceUrl: string;
}

export interface ImageCandidate {
  url: string;
  publisher: string;
  itemUrl: string;
}

const EMPTY: ImageMeta = { sourceType: "unverified", credit: "", license: "", sourceUrl: "" };

export async function getImageMeta(articleId: string): Promise<ImageMeta> {
  try {
    const rows = await sql`SELECT source_type, credit, license, source_url FROM article_image_meta WHERE article_id = ${articleId} LIMIT 1`;
    const r = rows[0];
    if (!r) return EMPTY;
    return { sourceType: r.source_type, credit: r.credit, license: r.license, sourceUrl: r.source_url };
  } catch {
    return EMPTY;
  }
}

export async function saveImageMeta(articleId: string, m: Partial<ImageMeta>): Promise<ImageMeta> {
  const cur = await getImageMeta(articleId);
  const sourceType = IMAGE_SOURCE_TYPES.includes(m.sourceType as ImageSourceType) ? (m.sourceType as ImageSourceType) : cur.sourceType;
  const next: ImageMeta = {
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

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  let buf: ArrayBuffer;
  let type = "";
  try {
    const res = await fetch(cand.url, { signal: ctrl.signal, redirect: "follow", headers: { "User-Agent": "WorldAttractionNewsBot/1.0" } });
    if (!res.ok) throw new Error(`Image download failed (HTTP ${res.status}).`);
    type = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    buf = await res.arrayBuffer();
  } catch (err: any) {
    throw new Error(err?.name === "AbortError" ? "Image download timed out." : err?.message || "Image download failed.");
  } finally {
    clearTimeout(timer);
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(type)) throw new Error("Unsupported image type (need JPG, PNG or WebP).");
  const file = new File([buf], "cover", { type });
  const uploaded = await uploadImage(file, "news");

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
