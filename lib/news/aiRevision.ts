// Phase 12 — a revision snapshot whenever the AI changes an article's text
// (writing, fact-check revision, photos placed, links added), so the
// article's history shows every AI step next to every human edit.
import { sql } from "../db";
import { recordRevision } from "../revisions";

export const AI_EDITOR = { email: "ai@worldattractionnews.system", role: "ai" } as const;

export async function recordAiRevision(articleId: string, changeSummary: string): Promise<void> {
  try {
    const a = (await sql`SELECT title, excerpt, content_html, image, image_alt FROM articles WHERE id = ${articleId} LIMIT 1`)[0];
    if (!a) return;
    await recordRevision({
      articleId,
      editorId: null,
      editorEmail: AI_EDITOR.email,
      editorRole: AI_EDITOR.role,
      title: a.title || "",
      excerpt: a.excerpt || "",
      contentHtml: a.content_html || "",
      image: a.image || "",
      imageAlt: a.image_alt || "",
      changeSummary: changeSummary.slice(0, 300),
    });
  } catch (err) {
    console.error("[news] recording an AI revision failed:", (err as Error)?.message);
  }
}
