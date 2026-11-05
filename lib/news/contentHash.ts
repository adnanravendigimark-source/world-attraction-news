import { createHash } from "crypto";

// Fingerprint of an article's readable text. Photo figures, tags and
// whitespace are ignored, so adding internal links or inline photos does not
// change it, but any change to the words does. A fact check stores the hash
// of the text it checked; a different hash later means the check is stale.
// (No imports from lib/articles here: articles.ts uses this for its publish
// gate, and the writer modules import articles.ts.)
// Inline tags (links, bold, italics) are removed without a space, so linking
// "Tokyo," doesn't turn it into "Tokyo ,": before, adding internal links made
// a fresh fact check look out of date. Block tags still separate words.
const INLINE_TAG = /<\/?(?:a|strong|b|em|i|u|span|abbr|small|mark)\b[^>]*>/gi;

export function articleText(html: string): string {
  return String(html || "")
    .replace(/<figure class="news-figure">[\s\S]*?<\/figure>/g, " ")
    .replace(INLINE_TAG, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

// `extra` is any other checked text shown with the story (the Key Updates /
// What Travelers Should Do bullets). Left empty, the hash is exactly what it
// was before those existed, so older checks stay current.
// The fingerprint used before inline tags were dropped without a space, so a
// check saved then still matches its unchanged text.
function legacyText(html: string): string {
  return String(html || "")
    .replace(/<figure class="news-figure">[\s\S]*?<\/figure>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function hashOf(body: string, extra: string[]): string {
  const lines = extra.map((s) => String(s || "").replace(/\s+/g, " ").trim()).filter(Boolean);
  const text = lines.length ? `${body}\n${lines.join("\n")}` : body;
  return createHash("sha256").update(text).digest("hex").slice(0, 32);
}

// True when a stored check fingerprint still matches the article: the
// current fingerprint, or the older one for checks saved before.
export function hashMatches(stored: string, html: string, extra: string[] = []): boolean {
  return stored === contentHash(html, extra) || stored === hashOf(legacyText(html), extra);
}

export function contentHash(html: string, extra: string[] = []): string {
  const lines = extra.map((s) => String(s || "").replace(/\s+/g, " ").trim()).filter(Boolean);
  const text = lines.length ? `${articleText(html)}\n${lines.join("\n")}` : articleText(html);
  return createHash("sha256").update(text).digest("hex").slice(0, 32);
}
