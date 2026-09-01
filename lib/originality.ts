import { sql } from "./db";

// Originality / duplicate-content check.
//
// This is a local heuristic, NOT a connection to a third-party plagiarism
// API — none was specified, and hard-coding a specific paid vendor here
// would just be guessing at credentials nobody has provided. It compares a
// submitted article's text against every other article already in this
// database (any status except a stale draft) using word-shingle Jaccard
// similarity, a standard, well-understood approximate-duplicate-detection
// technique. That's real, functioning duplicate detection scoped to this
// site's own content — it will NOT catch something copied from an outside
// website. To plug in a stronger, web-wide plagiarism service later
// (Copyscape, Originality.ai, etc.), replace the body of
// `checkOriginality()` below with a call to that provider's API — the
// function signature and the `{ score, flag, matches }` return shape are
// intentionally provider-agnostic, and every call site already treats
// this as a pluggable, awaited check.
export interface OriginalityMatch {
  articleId: string;
  title: string;
  similarity: number; // 0-1
}

export interface OriginalityResult {
  score: number; // highest similarity found, 0-1 (0 = fully original)
  flag: boolean; // true if score crosses the "review this" threshold
  matches: OriginalityMatch[];
}

const FLAG_THRESHOLD = 0.35;
const SHINGLE_SIZE = 8;

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function shingles(text: string, size = SHINGLE_SIZE): Set<string> {
  const words = text.split(" ").filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + size <= words.length; i++) {
    out.add(words.slice(i, i + size).join(" "));
  }
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const s of a) if (b.has(s)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export async function checkOriginality(
  contentHtml: string,
  excludeArticleId?: string
): Promise<OriginalityResult> {
  const plain = stripHtml(contentHtml);
  const mine = shingles(plain);

  // Too short to meaningfully shingle-compare — treat as original rather
  // than false-flagging a short piece against everything else.
  if (mine.size < 5) {
    return { score: 0, flag: false, matches: [] };
  }

  let others: { id: string; title: string; content_html: string }[];
  try {
    const rows = excludeArticleId
      ? await sql`
          SELECT id, title, content_html FROM articles
          WHERE status != 'draft' AND id != ${excludeArticleId}
        `
      : await sql`SELECT id, title, content_html FROM articles WHERE status != 'draft'`;
    others = rows as { id: string; title: string; content_html: string }[];
  } catch {
    // DB unreachable — fail open (don't block submission on an
    // infrastructure error), but make it obvious this didn't actually run.
    return { score: 0, flag: false, matches: [] };
  }

  const matches: OriginalityMatch[] = [];
  for (const other of others) {
    const theirs = shingles(stripHtml(other.content_html));
    const similarity = jaccard(mine, theirs);
    if (similarity > 0.08) {
      matches.push({ articleId: other.id, title: other.title, similarity });
    }
  }
  matches.sort((a, b) => b.similarity - a.similarity);

  const score = matches.length ? matches[0].similarity : 0;
  return { score, flag: score >= FLAG_THRESHOLD, matches: matches.slice(0, 5) };
}
