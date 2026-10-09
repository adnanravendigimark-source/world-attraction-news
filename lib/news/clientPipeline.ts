// Browser-side runner for "Generate article": calls the pipeline route one
// step at a time (each request stays under the function time limit) and
// reports progress. No server imports: safe to use from client components.

export interface PipelineProgress {
  stage: string;
}

export interface PipelineResult {
  articleId: string;
  adminUrl: string;
  wordCount: number;
  verdict: string;
  quality: { score: number; checks: { key: string; label: string; ok: boolean; earned: number; note: string }[] };
}

async function step(body: Record<string, unknown>): Promise<any> {
  const res = await fetch("/api/admin/news/pipeline", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || "Step failed.");
  return d;
}

export async function generateNewsArticle(clusterId: string, onStage: (text: string) => void): Promise<PipelineResult> {
  onStage("Reading sources and extracting facts…");
  await step({ step: "research", clusterId });
  onStage("Writing the article, SEO and internal links…");
  const w = await step({ step: "write", clusterId });
  onStage("Checking every claim against the research…");
  const c = await step({ step: "check", articleId: w.articleId });
  onStage("Finding a relevant image…");
  await step({ step: "images", articleId: w.articleId });
  onStage("Running quality checks…");
  const q = await step({ step: "quality", articleId: w.articleId });
  return { articleId: w.articleId, adminUrl: w.adminUrl, wordCount: w.wordCount, verdict: c.verdict, quality: q.quality };
}
