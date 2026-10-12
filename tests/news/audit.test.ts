import { describe, expect, it, vi } from "vitest";

const inserts: any[][] = [];
vi.mock("@/lib/db", () => ({
  sql: (strings: TemplateStringsArray, ...values: any[]) => {
    const q = strings.join("?");
    if (/INSERT INTO ai_runs/.test(q)) inserts.push(values);
    return Promise.resolve([]);
  },
}));

const { estimateCost } = await import("@/lib/news/aiRuns");
const { chatJson } = await import("@/lib/news/aiClient");
const { summarizeRuns } = await import("@/lib/news/audit");
const { isNewsEntry } = await import("@/components/admin/ActivityLog");

describe("cost estimate", () => {
  it("prices tokens per million and images per call", () => {
    expect(estimateCost("gpt-4o", 1_000_000, 100_000)).toBeCloseTo(2.5 + 1);
    expect(estimateCost("gpt-4o-mini-2024-07-18", 2_000_000, 0)).toBeCloseTo(0.3); // dated name → gpt-4o-mini, not gpt-4o
    expect(estimateCost("gpt-image-1", null, null, 1)).toBeCloseTo(0.063);
    expect(estimateCost("some-new-model", 1000, 1000)).toBeNull();
  });
});

describe("ai_runs logging", () => {
  it("records a successful call with its tokens, prompt version and article", async () => {
    process.env.OPENAI_API_KEY = "test";
    inserts.length = 0;
    const fetchOk = vi.fn(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }], usage: { prompt_tokens: 1200, completion_tokens: 300 } }), { status: 200 })
    );
    const r = await chatJson({ kind: "write", model: "gpt-4o", system: "s", user: "u", log: { articleId: "a1", promptVersion: "v4" } }, fetchOk as any);
    expect(r.json).toEqual({ ok: true });
    expect(inserts).toHaveLength(1);
    const [kind, model, version, articleId, clusterId, tin, tout, cost, , outcome] = inserts[0];
    expect([kind, model, version, articleId, clusterId, tin, tout, outcome]).toEqual(["write", "gpt-4o", "v4", "a1", null, 1200, 300, "ok"]);
    expect(cost).toBeCloseTo((1200 / 1e6) * 2.5 + (300 / 1e6) * 10);
  });

  it("records a failed call too", async () => {
    inserts.length = 0;
    const fetchBad = vi.fn(async () => new Response(JSON.stringify({ error: { message: "bad key" } }), { status: 401 }));
    await expect(chatJson({ kind: "check", model: "gpt-4o", system: "s", user: "u" }, fetchBad as any)).rejects.toThrow(/bad key/);
    expect(inserts).toHaveLength(1);
    expect(inserts[0][9]).toBe("error");
    expect(String(inserts[0][10])).toMatch(/bad key/);
  });
});

describe("audit totals", () => {
  it("adds up calls, failures, tokens and cost", () => {
    const run = (o: any) => ({ id: 1, kind: "write", model: "gpt-4o", promptVersion: "", articleId: "a", clusterId: null, tokensIn: 100, tokensOut: 50, costUsd: 0.001, durationMs: 1000, outcome: "ok", error: "", createdAt: "", ...o });
    expect(summarizeRuns([run({}), run({ outcome: "error", tokensIn: null, tokensOut: null, costUsd: null })])).toEqual({
      calls: 2, failed: 1, tokensIn: 100, tokensOut: 50, costUsd: 0.001,
    });
  });
});

describe("news publish log filter", () => {
  const ids = new Set(["n1"]);
  it("keeps news actions and actions on news articles only", () => {
    expect(isNewsEntry({ action: "news_source_created", targetType: "news_source", targetId: "x" }, ids)).toBe(true);
    expect(isNewsEntry({ action: "article_published", targetType: "article", targetId: "n1" }, ids)).toBe(true);
    expect(isNewsEntry({ action: "article_published", targetType: "article", targetId: "g1" }, ids)).toBe(false);
    expect(isNewsEntry({ action: "user_suspended", targetType: "user", targetId: "u1" }, ids)).toBe(false);
  });
});
