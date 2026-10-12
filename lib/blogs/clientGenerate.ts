// Browser-side runner for "Generate blog": research (if needed) -> outline ->
// each section -> finish. One request per step, so none hits the time limit.
// No server imports: safe to use from client components.

async function post(url: string, body: Record<string, unknown>): Promise<any> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || "Step failed.");
  return d;
}

export async function generateBlog(topicId: string, onStage: (text: string) => void): Promise<{ articleId: string; adminUrl: string; wordCount: number }> {
  const current = await fetch(`/api/admin/blogs/research?topicId=${topicId}`).then((r) => r.json()).catch(() => ({}));
  if (current?.research?.status !== "done") {
    onStage("Researching (Wikivoyage, Wikipedia)…");
    const r = await post("/api/admin/blogs/research", { topicId });
    if (r.research?.status !== "done") throw new Error(r.research?.error || "Research failed.");
  }
  onStage("Planning the outline…");
  const { outline } = await post("/api/admin/blogs/generate", { topicId, step: "outline" });
  const n = outline.sections.length;
  for (let i = 0; i < n; i++) {
    onStage(`Writing section ${i + 1} of ${n}: ${outline.sections[i].heading}`);
    await post("/api/admin/blogs/generate", { topicId, step: "section", index: i });
  }
  onStage("Writing the introduction, conclusion and FAQ…");
  return post("/api/admin/blogs/generate", { topicId, step: "finish" });
}
