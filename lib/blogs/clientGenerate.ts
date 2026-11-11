// Browser-side runner for "Generate blog": research (if needed) -> outline ->
// each section -> finish -> photos -> links -> check. One request per step,
// so none hits the time limit. No server imports: safe to use from client
// components.
//
// Steps after the draft exists don't stop the run when they fail (the draft
// is saved), but their errors and notes are returned as warnings so the
// editor sees them; before, they were swallowed silently.

async function post(url: string, body: Record<string, unknown>): Promise<any> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || `Step failed (HTTP ${res.status}).`);
  return d;
}

export interface GenerateResult {
  articleId: string;
  adminUrl: string;
  wordCount: number;
  quality?: number;
  warnings: string[];
}

export async function generateBlog(topicId: string, onStage: (text: string) => void): Promise<GenerateResult> {
  const warnings: string[] = [];
  const current = await fetch(`/api/admin/blogs/research?topicId=${topicId}`).then((r) => r.json()).catch(() => ({}));
  let research = current?.research;
  if (research?.status !== "done") {
    onStage("Researching (Wikidata, Wikipedia, recent news, official site)…");
    const r = await post("/api/admin/blogs/research", { topicId });
    if (r.research?.status !== "done") throw new Error(r.research?.error || "Research failed.");
    research = r.research;
  }
  // On finished research the error field holds notes (destination corrected, stale prices left out).
  if (research?.error) warnings.push(String(research.error));
  onStage("Planning the outline…");
  const { outline } = await post("/api/admin/blogs/generate", { topicId, step: "outline" });
  const n = outline.sections.length;
  for (let i = 0; i < n; i++) {
    onStage(`Writing section ${i + 1} of ${n}: ${outline.sections[i].heading}`);
    await post("/api/admin/blogs/generate", { topicId, step: "section", index: i });
  }
  onStage("Writing the introduction, conclusion and FAQ…");
  const draft = await post("/api/admin/blogs/generate", { topicId, step: "finish" });
  const articleId = draft.articleId;
  const soft = async (label: string, body: Record<string, unknown>): Promise<any> => {
    try {
      return await post("/api/admin/blogs/generate", { topicId, articleId, ...body });
    } catch (e: any) {
      warnings.push(`${label}: ${e?.message || "failed"}`);
      return {};
    }
  };
  // Photos and links first, then the fact check of the final text (the
  // check is tied to the exact text, so it must come last).
  onStage("Finding proven photos (Wikidata, Commons, location-checked)…");
  const img = await soft("Photos", { step: "images" });
  if (Array.isArray(img.notes)) warnings.push(...img.notes);
  onStage("Adding links…");
  await soft("Links", { step: "links" });
  onStage("Checking every claim against the research…");
  const q = await soft("Fact check", { step: "check" });
  return { ...draft, quality: q.quality, warnings };
}
