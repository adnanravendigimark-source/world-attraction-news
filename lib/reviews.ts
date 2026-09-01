import { sql } from "./db";
import type { ModerationSignals } from "./moderation";

// Append-only review decision audit trail — separate from the "current"
// score/admin_feedback columns cached directly on `articles` (which stay
// as the fast-path values shown everywhere), this is the full history of
// every review decision ever made, matching the Final Phase spec's
// database-architecture requirement to keep Article Reviews as its own
// entity rather than folding everything into one table.
export interface ArticleReview {
  id: number;
  articleId: string;
  adminId: string | null;
  adminEmail: string;
  decision: string;
  score: number | null;
  feedback: string;
  moderationSignals: ModerationSignals | null;
  createdAt: string;
}

function rowToReview(row: any): ArticleReview {
  return {
    id: row.id,
    articleId: row.article_id,
    adminId: row.admin_id,
    adminEmail: row.admin_email || "",
    decision: row.decision,
    score: row.score === null || row.score === undefined ? null : Number(row.score),
    feedback: row.feedback || "",
    moderationSignals: row.moderation_signals ?? null,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

export async function recordReview(input: {
  articleId: string;
  adminId: string;
  adminEmail: string;
  decision: string;
  score: number | null;
  feedback: string;
  moderationSignals?: ModerationSignals | null;
}): Promise<void> {
  try {
    await sql`
      INSERT INTO article_reviews (article_id, admin_id, admin_email, decision, score, feedback, moderation_signals)
      VALUES (
        ${input.articleId}, ${input.adminId}, ${input.adminEmail}, ${input.decision}, ${input.score}, ${input.feedback},
        ${input.moderationSignals ? JSON.stringify(input.moderationSignals) : null}
      )
    `;
  } catch (err) {
    console.error("[reviews] failed to record review:", err);
  }
}

export async function getReviewsForArticle(articleId: string): Promise<ArticleReview[]> {
  try {
    const rows = await sql`SELECT * FROM article_reviews WHERE article_id = ${articleId} ORDER BY created_at DESC`;
    return rows.map(rowToReview);
  } catch {
    return [];
  }
}
