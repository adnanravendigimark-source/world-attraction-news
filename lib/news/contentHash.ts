import { createHash } from "crypto";

// Fingerprint of an article's readable text. Photo figures, tags and
// whitespace are ignored, so adding internal links or inline photos does not
// change it, but any change to the words does. A fact check stores the hash
// of the text it checked; a different hash later means the check is stale.
// (No imports from lib/articles here: articles.ts uses this for its publish
// gate, and the writer modules import articles.ts.)
export function articleText(html: string): string {
  return String(html || "")
    .replace(/<figure class="news-figure">[\s\S]*?<\/figure>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function contentHash(html: string): string {
  return createHash("sha256").update(articleText(html)).digest("hex").slice(0, 32);
}
