// Copyright safeguard: finds passages of the article that repeat a source
// word for word. Any run of OVERLAP_WORDS or more consecutive words shared
// with a source text is reported (merged into the longest matching phrase).
// Pure function, no database access.
//
// Only what we store can be compared: each source's headline and feed
// teaser. Full source pages are read during research but never stored, so
// copying from deeper in a source page can't be detected here; the writer
// never sees those pages either (it only gets the extracted facts).

export const OVERLAP_WORDS = 8;

function words(text: string): string[] {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .filter(Boolean);
}

export interface OverlapMatch {
  phrase: string; // the copied words, lower-cased
  words: number;
  source: string; // label of the source it matches
}

export function sourceOverlap(articleHtml: string, sources: { label: string; text: string }[], n = OVERLAP_WORDS): OverlapMatch[] {
  const art = words(articleHtml);
  if (art.length < n) return [];
  const matches: OverlapMatch[] = [];
  for (const src of sources) {
    const sw = words(src.text);
    if (sw.length < n) continue;
    const grams = new Set<string>();
    for (let i = 0; i + n <= sw.length; i++) grams.add(sw.slice(i, i + n).join(" "));
    // Walk the article; extend each hit as far as it keeps matching.
    let i = 0;
    while (i + n <= art.length) {
      if (!grams.has(art.slice(i, i + n).join(" "))) {
        i++;
        continue;
      }
      let end = i + n;
      while (end < art.length && grams.has(art.slice(end - n + 1, end + 1).join(" "))) end++;
      matches.push({ phrase: art.slice(i, end).join(" "), words: end - i, source: src.label });
      i = end;
    }
  }
  return matches.sort((a, b) => b.words - a.words);
}
