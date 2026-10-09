import { put } from "@vercel/blob";
import sharp from "sharp";

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
// News covers are always exactly this size (16:9), so cards, social previews
// and Google's image requirements all get the same picture.
export const NEWS_COVER = { width: 1200, height: 675 } as const;

export interface CoverUploadResult extends UploadResult {
  originalUrl: string; // the uncropped image (longest edge capped at 2000px)
}

// Crops to the news cover size, keeping the most interesting part of the
// frame (sharp's attention strategy: faces, contrast, saturation). Upscales
// small images so every cover has the same dimensions.
export async function cropToNewsCover(input: Buffer): Promise<{ data: Buffer; width: number; height: number }> {
  const out = await sharp(input)
    .rotate()
    .resize(NEWS_COVER.width, NEWS_COVER.height, { fit: "cover", position: sharp.strategy.attention })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
  return { data: out.data, width: out.info.width, height: out.info.height };
}

async function putWebp(data: Buffer, folder: string): Promise<string> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("Image uploads aren't configured yet — BLOB_READ_WRITE_TOKEN is missing. See README.md for setup.");
  }
  const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
  const blob = await put(filename, data, { access: "public", contentType: "image/webp" });
  return blob.url;
}

// Stores a news cover twice: cropped to 1200×675 (what the site shows) and
// the original, kept so the cover can be re-cropped later.
export async function uploadNewsCover(file: File, folder = "news"): Promise<CoverUploadResult> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Unsupported image type — please upload a JPG, PNG, or WebP file.");
  }
  if (file.size > MAX_BYTES * 1.5) {
    throw new Error("Image is too large — please upload a file under 12MB.");
  }
  const input = Buffer.from(await file.arrayBuffer());
  const original = await sharp(input)
    .rotate()
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  const cover = await cropToNewsCover(input);
  const [originalUrl, url] = await Promise.all([putWebp(original, `${folder}/originals`), putWebp(cover.data, folder)]);
  return { url, width: cover.width, height: cover.height, originalUrl };
}

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

  return { url: blob.url, width: optimized.info.width, height: optimized.info.height };
}
