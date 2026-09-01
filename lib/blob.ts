import { put, del } from "@vercel/blob";
import sharp from "sharp";
import { sql } from "./db";

const MAX_DIMENSION = 2000;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 8 * 1024 * 1024; // 8MB upload cap before compression

export interface UploadResult {
  url: string;
  width: number;
  height: number;
}

// Shared upload path for every image in the app (contributor article
// covers/inline images, admin city hero images) — always re-encodes to
// WebP and caps the longest edge at 2000px server-side with sharp, so a
// contributor's un-optimized phone photo never ships to the public site at
// full multi-megabyte size. Nothing is ever accepted as a pasted external
// URL; this is the only way an image gets into the app.
export async function uploadImage(file: File, folder: string): Promise<UploadResult> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Unsupported image type — please upload a JPG, PNG, or WebP file.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Image is too large — please upload a file under 8MB.");
  }

  const inputBuffer = Buffer.from(await file.arrayBuffer());
  const optimized = await sharp(inputBuffer)
    .rotate()
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });

  const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      "Image uploads aren't configured yet — BLOB_READ_WRITE_TOKEN is missing. See README.md for setup."
    );
  }

  const blob = await put(filename, optimized.data, {
    access: "public",
    contentType: "image/webp",
  });

  try {
    await sql`
      INSERT INTO media_library (url, filename, content_type, size_bytes)
      VALUES (${blob.url}, ${filename}, 'image/webp', ${optimized.data.length})
      ON CONFLICT (url) DO NOTHING
    `;
  } catch {
    // Media library logging is best-effort — never block the actual upload
    // (which already succeeded in Blob storage) on this table being ready.
  }

  return { url: blob.url, width: optimized.info.width, height: optimized.info.height };
}

// Used by the Admin Panel's Media Library (/admin/media) to actually
// remove a file from Blob storage, not just from the media_library index
// row — deleting only the DB row would leave the file live at its old URL
// forever.
export async function deleteImage(url: string): Promise<void> {
  await del(url);
}
