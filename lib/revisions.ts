import { sql } from "./db";

// Article revision history. A snapshot is recorded at meaningful save
// points — submit, admin edit, restore — NOT on every autosave keystroke
// (that would flood the table with near-duplicate rows every 2.5 seconds
// while someone is writing). See lib/articles.ts call sites.
export interface ArticleRevision {
  id: number;
  articleId: string;
  editorId: string | null;
  editorEmail: string;
  editorRole: string;
  title: string;
  excerpt: string;
  contentHtml: string;
  image: string;
  imageAlt: string;
  changeSummary: string;
  createdAt: string;
}

function rowToRevision(row: any): ArticleRevision {
  return {
    id: row.id,
    articleId: row.article_id,
    editorId: row.editor_id,
    editorEmail: row.editor_email || "",
    editorRole: row.editor_role || "",
    title: row.title || "",
    excerpt: row.excerpt || "",
    contentHtml: row.content_html || "",
    image: row.image || "",
    imageAlt: row.image_alt || "",
    changeSummary: row.change_summary || "",
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

export async function recordRevision(input: {
  articleId: string;
  editorId: string | null;
  editorEmail: string;
  editorRole: string;
  title: string;
  excerpt: string;
  contentHtml: string;
  image: string;
  imageAlt: string;
  changeSummary: string;
}): Promise<void> {
  try {
    await sql`
      INSERT INTO article_revisions (
        article_id, editor_id, editor_email, editor_role, title, excerpt, content_html, image, image_alt, change_summary
      ) VALUES (
        ${input.articleId}, ${input.editorId}, ${input.editorEmail}, ${input.editorRole},
        ${input.title}, ${input.excerpt}, ${input.contentHtml}, ${input.image}, ${input.imageAlt}, ${input.changeSummary}
      )
    `;
  } catch (err) {
    // Best-effort, same pattern as activity log — never block the actual
    // save on history-tracking failing.
    console.error("[revisions] failed to record revision:", err);
  }
}

export async function getRevisions(articleId: string): Promise<ArticleRevision[]> {
  try {
    const rows = await sql`
      SELECT * FROM article_revisions WHERE article_id = ${articleId} ORDER BY created_at DESC
    `;
    return rows.map(rowToRevision);
  } catch {
    return [];
  }
}

export async function getRevisionById(id: number): Promise<ArticleRevision | undefined> {
  const rows = await sql`SELECT * FROM article_revisions WHERE id = ${id} LIMIT 1`;
  return rows.length ? rowToRevision(rows[0]) : undefined;
}
