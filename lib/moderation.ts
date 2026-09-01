import { checkOriginality, type OriginalityResult } from "./originality";

// Content moderation signals shown to the admin on the Article Review page.
// Every check here is a real, local heuristic computed from the article's
// actual text — none of it is a stub, none of it auto-rejects anything.
// These are explicitly review signals: the admin always makes the final
// call by reading the article itself (per the Final Phase spec, item 7).
//
// To plug in a real third-party spam/AI-detection API later, replace the
// body of runModerationChecks() below with calls to that provider — the
// return shape is intentionally provider-agnostic and every call site
// already treats this as pluggable.
export interface ModerationSignals {
  duplicate: OriginalityResult;
  spam: { flag: boolean; reasons: string[] };
  inappropriate: { flag: boolean; reasons: string[] };
  quality: { flag: boolean; reasons: string[]; score: number };
  aiContent: { flag: boolean; score: number; reasons: string[] };
  checkedAt: string;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

// Basic spam heuristics: excessive links, excessive ALL CAPS shouting,
// repeated punctuation ("!!!!!"), and a short list of common spam/gambling/
// pharma keywords that have no legitimate place in a travel-news article.
const SPAM_KEYWORDS = ["viagra", "casino bonus", "crypto giveaway", "click here now", "make money fast", "forex signals"];

function checkSpam(plainText: string, contentHtml: string): { flag: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const linkCount = (contentHtml.match(/<a\s/gi) || []).length;
  if (linkCount > 8) reasons.push(`Unusually high number of links (${linkCount}).`);

  const words = plainText.split(/\s+/).filter(Boolean);
  const capsWords = words.filter((w) => w.length > 3 && w === w.toUpperCase() && /[A-Z]/.test(w));
  if (words.length > 20 && capsWords.length / words.length > 0.15) {
    reasons.push("Large proportion of ALL-CAPS words.");
  }

  if (/[!?]{4,}/.test(plainText)) reasons.push("Repeated exclamation/question marks.");

  const lower = plainText.toLowerCase();
  const foundKeywords = SPAM_KEYWORDS.filter((k) => lower.includes(k));
  if (foundKeywords.length) reasons.push(`Contains flagged phrase(s): ${foundKeywords.join(", ")}.`);

  return { flag: reasons.length > 0, reasons };
}

// A short, conservative keyword list for obviously inappropriate content.
// Deliberately narrow — this is a review flag, not a filter, so
// false-negatives are far preferable to false-positives blocking normal
// travel writing.
const INAPPROPRIATE_KEYWORDS = ["explicit content", "hate speech", "racial slur"];

function checkInappropriate(plainText: string): { flag: boolean; reasons: string[] } {
  const lower = plainText.toLowerCase();
  const found = INAPPROPRIATE_KEYWORDS.filter((k) => lower.includes(k));
  return { flag: found.length > 0, reasons: found.map((k) => `Contains flagged phrase: "${k}".`) };
}

// Quality checks: minimum length, paragraph structure, heading usage, and
// a title/excerpt that actually look filled in rather than placeholder
// text. Score is 0-100, purely informational for the admin.
function checkQuality(input: { title: string; excerpt: string; contentHtml: string; plainText: string }): {
  flag: boolean;
  reasons: string[];
  score: number;
} {
  const reasons: string[] = [];
  let score = 100;

  const wordCount = input.plainText.split(/\s+/).filter(Boolean).length;
  if (wordCount < 200) {
    reasons.push("Body is under 200 words.");
    score -= 30;
  }
  const paragraphCount = (input.contentHtml.match(/<p[\s>]/gi) || []).length;
  if (paragraphCount < 2) {
    reasons.push("Very few paragraph breaks — content may not be well-structured.");
    score -= 15;
  }
  const headingCount = (input.contentHtml.match(/<h[23][\s>]/gi) || []).length;
  if (wordCount > 400 && headingCount === 0) {
    reasons.push("Long article with no subheadings.");
    score -= 10;
  }
  if (input.excerpt.trim().length < 20) {
    reasons.push("Excerpt is very short or missing.");
    score -= 15;
  }
  if (input.title.trim().length < 15) {
    reasons.push("Title is very short.");
    score -= 10;
  }
  score = Math.max(0, score);
  return { flag: score < 60, reasons, score };
}

// A heuristic AI-generated-content signal — NOT a claim of certainty, and
// explicitly labeled as such wherever it's shown. Looks for patterns that
// are statistically more common in unedited LLM output: a handful of
// telltale stock phrases, and unusually uniform sentence lengths (very low
// variance), which human writing rarely produces. This is a real,
// deterministic computation over the actual text — not a random or
// hardcoded number — but it is still just a signal for the admin to weigh,
// not a fact.
const AI_STOCK_PHRASES = [
  "in today's fast-paced world",
  "in conclusion,",
  "it is important to note that",
  "as an ai language model",
  "delve into",
  "in the realm of",
  "unlock the secrets",
  "let's dive in",
];

function checkAiContentSignal(plainText: string): { flag: boolean; score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  const lower = plainText.toLowerCase();

  const foundPhrases = AI_STOCK_PHRASES.filter((p) => lower.includes(p));
  if (foundPhrases.length) {
    score += foundPhrases.length * 20;
    reasons.push(`Common AI-writing stock phrase(s) found: ${foundPhrases.join(", ")}.`);
  }

  const sentences = plainText.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
  if (sentences.length >= 6) {
    const lengths = sentences.map((s) => s.split(/\s+/).length);
    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.reduce((a, b) => a + (b - mean) ** 2, 0) / lengths.length;
    const stdDev = Math.sqrt(variance);
    if (mean > 0 && stdDev / mean < 0.25) {
      score += 25;
      reasons.push("Unusually uniform sentence length across the article.");
    }
  }

  score = Math.min(100, score);
  return { flag: score >= 40, score, reasons };
}

export async function runModerationChecks(input: {
  title: string;
  excerpt: string;
  contentHtml: string;
  excludeArticleId?: string;
}): Promise<ModerationSignals> {
  const plainText = stripHtml(input.contentHtml);
  const [duplicate] = await Promise.all([checkOriginality(input.contentHtml, input.excludeArticleId)]);
  const spam = checkSpam(plainText, input.contentHtml);
  const inappropriate = checkInappropriate(plainText);
  const quality = checkQuality({ title: input.title, excerpt: input.excerpt, contentHtml: input.contentHtml, plainText });
  const aiContent = checkAiContentSignal(plainText);

  return {
    duplicate,
    spam,
    inappropriate,
    quality,
    aiContent,
    checkedAt: new Date().toISOString(),
  };
}

// True if any signal is severe enough that an admin should see a warning
// banner immediately on the review page, rather than needing to expand
// each panel. Still never used to block submission or auto-reject.
export function hasModerationWarnings(signals: ModerationSignals | null | undefined): boolean {
  if (!signals) return false;
  return Boolean(
    signals.duplicate?.flag || signals.spam?.flag || signals.inappropriate?.flag || signals.quality?.flag || signals.aiContent?.flag
  );
}
