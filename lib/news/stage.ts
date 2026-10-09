// Where a story stands in the news pipeline, worked out from rows that
// already exist (research run, job queue, article, fact check, image
// rights). Nothing is stored: there is no status column to keep in sync.
// Pure function, no database access, so it is easy to test and reuse.

export type StepState = "todo" | "running" | "done" | "warn" | "failed";

export interface PipelineInput {
  researchStatus: string; // '' | running | done | failed
  job: { kind: string; status: string; error: string } | null; // latest queued/running/failed job
  article: {
    id: string;
    status: string;
    wordCount: number;
    hasTodo: boolean;
    hasImage: boolean;
    imageRightsOk: boolean;
  } | null;
  check: { verdict: string; stale: boolean; overridden: boolean } | null;
}

export type StageKey =
  | "new"
  | "researching"
  | "research_failed"
  | "researched"
  | "writing"
  | "step_failed"
  | "drafted"
  | "check_failed"
  | "needs_review"
  | "check_stale"
  | "needs_image"
  | "ready"
  | "approved"
  | "scheduled"
  | "published"
  | "rejected";

export interface StoryPipeline {
  stage: StageKey;
  label: string;
  tone: "neutral" | "progress" | "attention" | "good" | "done";
  // One state per step, for the chips on the story row.
  steps: { research: StepState; draft: StepState; factCheck: StepState; image: StepState; published: StepState };
  articleId: string | null;
}

const LABEL: Record<StageKey, [string, StoryPipeline["tone"]]> = {
  new: ["Not started", "neutral"],
  researching: ["Researching", "progress"],
  research_failed: ["Research failed", "attention"],
  researched: ["Researched", "neutral"],
  writing: ["Writing", "progress"],
  step_failed: ["Step failed", "attention"],
  drafted: ["Draft, not checked", "attention"],
  check_failed: ["Fact check failed", "attention"],
  needs_review: ["Fact check: review", "attention"],
  check_stale: ["Re-check needed", "attention"],
  needs_image: ["Needs image", "attention"],
  ready: ["Ready for review", "good"],
  approved: ["Approved", "good"],
  scheduled: ["Scheduled", "done"],
  published: ["Published", "done"],
  rejected: ["Rejected", "neutral"],
};

function checkState(check: PipelineInput["check"]): StepState {
  if (!check) return "todo";
  if (check.stale) return "warn";
  if (check.verdict === "passed" || check.verdict === "pass") return "done";
  if (check.overridden) return "done";
  if (check.verdict === "needs_review") return "warn";
  return "failed";
}

export function storyPipeline(p: PipelineInput): StoryPipeline {
  const a = p.article;
  const running = p.job?.status === "running" || p.job?.status === "queued";
  const failedJob = p.job?.status === "failed";
  const fc = checkState(p.check);

  const steps: StoryPipeline["steps"] = {
    research:
      p.researchStatus === "done" ? "done" : p.researchStatus === "running" || (running && p.job?.kind === "research") ? "running" : p.researchStatus === "failed" ? "failed" : "todo",
    draft: a ? (a.hasTodo ? "warn" : "done") : running && ["draft", "write"].includes(p.job!.kind) ? "running" : "todo",
    factCheck: running && p.job?.kind === "check" ? "running" : fc,
    image: a?.hasImage ? (a.imageRightsOk ? "done" : "warn") : running && p.job?.kind === "image" ? "running" : "todo",
    published: a?.status === "published" ? "done" : a?.status === "scheduled" ? "running" : "todo",
  };

  let stage: StageKey;
  if (a?.status === "published") stage = "published";
  else if (a?.status === "scheduled") stage = "scheduled";
  else if (a?.status === "rejected") stage = "rejected";
  else if (running && p.job?.kind === "research") stage = "researching";
  else if (running && ["draft", "write", "check", "image"].includes(p.job!.kind)) stage = "writing";
  else if (!a) {
    if (failedJob) stage = "step_failed";
    else if (p.researchStatus === "running") stage = "researching";
    else if (p.researchStatus === "failed") stage = "research_failed";
    else if (p.researchStatus === "done") stage = "researched";
    else stage = "new";
  } else if (failedJob) stage = "step_failed";
  else if (a.hasTodo || !p.check) stage = "drafted";
  else if (fc === "failed") stage = "check_failed";
  else if (p.check.stale) stage = "check_stale";
  else if (fc === "warn") stage = "needs_review";
  else if (!a.hasImage || !a.imageRightsOk) stage = "needs_image";
  else if (a.status === "approved") stage = "approved";
  else stage = "ready"; // in review (draft, pending, under review, changes requested) or unpublished

  const [label, tone] = LABEL[stage];
  return { stage, label, tone, steps, articleId: a?.id ?? null };
}

// Groups used by the inbox's stage filter.
export const STAGE_GROUPS: Record<string, StageKey[]> = {
  todo: ["new", "researched"],
  progress: ["researching", "writing"],
  attention: ["research_failed", "step_failed", "drafted", "check_failed", "needs_review", "check_stale", "needs_image"],
  ready: ["ready", "approved"],
  done: ["scheduled", "published"],
};
