// The two boxes beside a news story: "Key Updates" (the main facts as short
// bullets) and "What Travelers Should Do" (practical steps). The AI writer
// fills them from the same researched facts as the story; editors can change
// them. They are claims like the story text, so the fact check reads them
// too and a bullet it flags is dropped.
//
// Pure helpers only (no database), so they can be tested.

export const MAX_KEY_UPDATES = 4;
export const MAX_TRAVELER_STEPS = 4;
const MAX_ITEM_CHARS = 200;

export interface NewsHighlights {
  keyUpdates: string[];
  travelerSteps: string[];
}

// Plain text, one item each: tags, list markers and extra spaces removed,
// duplicates and empties dropped, capped in count and length.
export function cleanList(value: unknown, max: number): string[] {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(/\r?\n/) : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const text = v
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/^\s*(?:[-*•–—]|\d+[.)])\s*/, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_ITEM_CHARS);
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= max) break;
  }
  return out;
}

export function cleanHighlights(v: { keyUpdates?: unknown; travelerSteps?: unknown }): NewsHighlights {
  return {
    keyUpdates: cleanList(v.keyUpdates, MAX_KEY_UPDATES),
    travelerSteps: cleanList(v.travelerSteps, MAX_TRAVELER_STEPS),
  };
}

// From a database row (columns key_updates / traveler_steps; missing before
// the migration runs).
export function highlightsFromRow(row: any): NewsHighlights {
  return cleanHighlights({ keyUpdates: row?.key_updates, travelerSteps: row?.traveler_steps });
}

// What the fingerprint and the fact check include besides the story text.
// Empty for a story without boxes, so its fingerprint is unchanged.
export function highlightLines(h: NewsHighlights): string[] {
  return [...h.keyUpdates, ...h.travelerSteps];
}

// The boxes as paragraphs, appended to the story for the fact checker.
export function highlightsCheckHtml(h: NewsHighlights): string {
  const p = (s: string) => `<p>${s.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>`;
  return highlightLines(h).map(p).join("");
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/<[^>]*>/g, " ")
    .replace(/[^\p{L}\p{N}%.]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

// True when a fact-check issue quotes this bullet (or most of it).
export function issueMatches(item: string, issueText: string): boolean {
  const a = norm(item);
  const b = norm(issueText);
  if (!a || !b) return false;
  if (a.includes(b) || b.includes(a)) return true;
  const words = new Set(a.split(" ").filter((w) => w.length > 2));
  const hit = b.split(" ").filter((w) => words.has(w)).length;
  return words.size > 0 && hit / words.size >= 0.75;
}

// Drops every bullet a high-severity issue points at. Returns the kept
// lists and which issues were about the boxes (so the body reviser skips them).
export function dropFlagged(
  h: NewsHighlights,
  issues: { text: string; severity: string }[]
): { kept: NewsHighlights; removed: string[]; boxIssues: Set<string> } {
  const high = issues.filter((i) => i.severity === "high");
  const removed: string[] = [];
  const boxIssues = new Set<string>();
  const keep = (list: string[]) =>
    list.filter((item) => {
      const hits = high.filter((i) => issueMatches(item, i.text));
      hits.forEach((i) => boxIssues.add(i.text));
      if (hits.length) removed.push(item);
      return hits.length === 0;
    });
  return { kept: { keyUpdates: keep(h.keyUpdates), travelerSteps: keep(h.travelerSteps) }, removed, boxIssues };
}
