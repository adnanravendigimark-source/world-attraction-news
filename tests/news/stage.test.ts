import { describe, expect, it } from "vitest";
import { storyPipeline, STAGE_GROUPS, type PipelineInput } from "@/lib/news/stage";

const art = (o: Partial<NonNullable<PipelineInput["article"]>> = {}) => ({
  id: "a1",
  status: "pending",
  wordCount: 240,
  hasTodo: false,
  hasImage: true,
  imageRightsOk: true,
  ...o,
});
const base: PipelineInput = { researchStatus: "", job: null, article: null, check: null };
const passed = { verdict: "passed", stale: false, overridden: false };

describe("story pipeline stage", () => {
  it("starts as not started", () => {
    const p = storyPipeline(base);
    expect(p.stage).toBe("new");
    expect(p.steps).toEqual({ research: "todo", draft: "todo", factCheck: "todo", image: "todo", published: "todo" });
  });

  it("follows research and running jobs", () => {
    expect(storyPipeline({ ...base, researchStatus: "done" }).stage).toBe("researched");
    expect(storyPipeline({ ...base, researchStatus: "failed" }).stage).toBe("research_failed");
    expect(storyPipeline({ ...base, job: { kind: "research", status: "running", error: "" } }).stage).toBe("researching");
    const w = storyPipeline({ ...base, researchStatus: "done", job: { kind: "write", status: "queued", error: "" }, article: art({ hasTodo: true }) });
    expect(w.stage).toBe("writing");
  });

  it("flags a failed job", () => {
    expect(storyPipeline({ ...base, researchStatus: "done", job: { kind: "check", status: "failed", error: "x" }, article: art(), check: passed }).stage).toBe("step_failed");
  });

  it("needs a check before anything else", () => {
    expect(storyPipeline({ ...base, researchStatus: "done", article: art() }).stage).toBe("drafted");
    expect(storyPipeline({ ...base, researchStatus: "done", article: art({ hasTodo: true }), check: passed }).stage).toBe("drafted");
  });

  it("orders check problems: failed, stale, needs review", () => {
    const run = (check: any) => storyPipeline({ ...base, researchStatus: "done", article: art(), check }).stage;
    expect(run({ verdict: "failed", stale: false, overridden: false })).toBe("check_failed");
    expect(run({ verdict: "failed", stale: false, overridden: true })).toBe("ready");
    expect(run({ verdict: "passed", stale: true, overridden: false })).toBe("check_stale");
    expect(run({ verdict: "needs_review", stale: false, overridden: false })).toBe("needs_review");
  });

  it("needs an image with recorded rights", () => {
    const run = (o: any) => storyPipeline({ ...base, researchStatus: "done", article: art(o), check: passed });
    expect(run({ hasImage: false }).stage).toBe("needs_image");
    expect(run({ imageRightsOk: false }).steps.image).toBe("warn");
    expect(run({}).stage).toBe("ready");
    expect(run({ status: "approved" }).stage).toBe("approved");
  });

  it("ends at published, scheduled or rejected", () => {
    const run = (status: string) => storyPipeline({ ...base, researchStatus: "done", article: art({ status }), check: passed });
    expect(run("published").stage).toBe("published");
    expect(run("published").steps.published).toBe("done");
    expect(run("scheduled").stage).toBe("scheduled");
    expect(run("rejected").stage).toBe("rejected");
  });

  it("puts every stage in a filter group except rejected", () => {
    const grouped = new Set(Object.values(STAGE_GROUPS).flat());
    for (const s of ["new", "researching", "research_failed", "researched", "writing", "step_failed", "drafted", "check_failed", "needs_review", "check_stale", "needs_image", "ready", "approved", "scheduled", "published"]) {
      expect(grouped.has(s as any)).toBe(true);
    }
  });
});
