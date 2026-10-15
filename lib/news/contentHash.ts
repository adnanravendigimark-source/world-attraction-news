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

// `extra` is any other checked text shown with the story (the Key Updates /
// What Travelers Should Do bullets). Left empty, the hash is exactly what it
// was before those existed, so older checks stay current.
export function contentHash(html: string, extra: string[] = []): string {
  const lines = extra.map((s) => String(s || "").replace(/\s+/g, " ").trim()).filter(Boolean);
  const text = lines.length ? `${articleText(html)}\n${lines.join("\n")}` : articleText(html);
  return createHash("sha256").update(text).digest("hex").slice(0, 32);
}
