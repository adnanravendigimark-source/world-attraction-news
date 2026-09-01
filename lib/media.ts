import { sql } from "./db";
import { deleteImage } from "./blob";

export interface MediaItem {
  id: number;
  url: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  altText: string;
  caption: string;
  createdAt: string;
}

function rowToMedia(row: any): MediaItem {
  return {
    id: row.id,
    url: row.url,
    filename: row.filename,
    contentType: row.content_type,
    sizeBytes: row.size_bytes,
    altText: row.alt_text || "",
    caption: row.caption || "",
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

// Powers the admin/dashboard "Media Library" picker tab — every image ever
// uploaded gets listed here so a previously-uploaded photo can be reused
// without uploading it again. Nothing here is ever deleted automatically;
// replacing a field's image just points that field at a new URL.
export async function getMediaLibrary(limit = 200): Promise<MediaItem[]> {
  try {
    const rows = await sql`SELECT * FROM media_library ORDER BY created_at DESC LIMIT ${limit}`;
    return rows.map(rowToMedia);
  } catch {
    return [];
  }
}

export async function updateMediaMeta(id: number, updates: { altText?: string; caption?: string }): Promise<MediaItem> {
  const current = await sql`SELECT * FROM media_library WHERE id = ${id} LIMIT 1`;
  if (!current.length) throw new Error("Media item not found.");
  const c = current[0];
  const rows = await sql`
    UPDATE media_library
    SET alt_text = ${updates.altText ?? c.alt_text}, caption = ${updates.caption ?? c.caption}
    WHERE id = ${id}
    RETURNING *
  `;
  return rowToMedia(rows[0]);
}

// Deletes both the Blob file itself and its media_library index row. If a
// file is still referenced somewhere (check with getMediaUsage() first —
// the /admin/media UI does, and warns before letting an admin delete a
// used image), deleting it here will break wherever it's used; this
// function itself doesn't block on that, the caller decides.
export async function deleteMediaItem(id: number): Promise<void> {
  const rows = await sql`SELECT url FROM media_library WHERE id = ${id} LIMIT 1`;
  if (!rows.length) return;
  try {
    await deleteImage(rows[0].url);
  } catch (err) {
    console.error("[media] failed to delete blob (removing DB row anyway):", err);
  }
  await sql`DELETE FROM media_library WHERE id = ${id}`;
}

export interface MediaUsage {
  cityHero: { id: string; name: string }[];
  articleCover: { id: string; title: string }[];
  articleContent: { id: string; title: string }[];
}

// Best-effort "where is this used" check — scans the fields that can hold
// an image URL directly (city hero, article cover) plus a plain substring
// search through every article's stored content_html for inline images
// inserted via the rich text editor. Not a full reverse index (there isn't
// one), but real and accurate as of the moment it's called, not a fake
// placeholder.
export async function getMediaUsage(url: string): Promise<MediaUsage> {
  const [cityRows, articleCoverRows, articleContentRows] = await Promise.all([
    sql`SELECT id, name FROM cities WHERE hero_image = ${url}`,
    sql`SELECT id, title FROM articles WHERE image = ${url}`,
    sql`SELECT id, title FROM articles WHERE content_html LIKE ${"%" + url + "%"}`,
  ]);
  return {
    cityHero: cityRows as { id: string; name: string }[],
    articleCover: articleCoverRows as { id: string; title: string }[],
    articleContent: articleContentRows as { id: string; title: string }[],
  };
}
