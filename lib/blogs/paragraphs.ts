// Paragraph clean-up shared by the guide writer and the fact-check fixer
// (kept apart so neither imports the other).

// Joins a paragraph of fewer than 15 words to the paragraph before it, when
// both are plain paragraphs next to each other (no heading, figure or list
// between). Fixes the one-sentence fragments a rewrite leaves. Pure; exported for tests.
export function joinShortParagraphs(html: string): string {
  let out = String(html || "");
  for (let i = 0; i < 20; i++) {
    const next = out.replace(/<p>((?:(?!<\/p>)[\s\S])+)<\/p>\s*<p>((?:(?!<\/p>)[\s\S])+)<\/p>/g, (m, a: string, b: string) =>
      b.replace(/<[^>]+>/g, " ").trim().split(/\s+/).length < 15 || a.replace(/<[^>]+>/g, " ").trim().split(/\s+/).length < 15 ? `<p>${a.trim()} ${b.trim()}</p>` : m
    );
    if (next === out) break;
    out = next;
  }
  return out;
}
