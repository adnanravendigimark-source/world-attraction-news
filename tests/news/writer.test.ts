import { beforeEach, describe, expect, it, vi } from "vitest";

// writeArticle talks to the database and OpenAI; both are replaced here.
const calls: { kind?: string; system: string; user: string }[] = [];
let replies: any[] = [];
const updates: string[] = [];

vi.mock("@/lib/db", () => ({
  sql: (strings: TemplateStringsArray, ...values: any[]) => {
    const q = strings.join("?");
    if (/SELECT status, news_cluster_id FROM articles/.test(q)) return Promise.resolve([{ status: "pending", news_cluster_id: "c1" }]);
    if (/FROM categories/.test(q)) return Promise.resolve([{ id: "cat1", name: "Aviation" }]);
    if (/FROM story_research/.test(q))
      return Promise.resolve([
        {
          id: "r1",
          cluster_id: "c1",
          status: "done",
          model: "m",
          facts: {
            what_happened: "Lufthansa added a Frankfurt to Tokyo route.",
            when: "From 1 December 2026",
            where: "Frankfurt",
            who_is_affected: "Passengers flying to Japan",
            what_changed: "A new daily flight",
            traveler_impact: "Travelers may want to compare fares.",
            important_facts: [{ claim: "The flight runs daily.", sources: [1], confidence: "single_source" }],
            confirmed_numbers: [],
            uncertain_claims: [],
            conflicts: [],
            missing_info: [],
          },
          sources: [{ n: 1, title: "t", url: "https://x", publisher: "Reuters", reliability: 80, official: false, usedText: true, note: "" }],
          error: "",
          created_at: new Date(),
          finished_at: new Date(),
        },
      ]);
    if (/^\s*UPDATE articles SET/.test(q)) updates.push(String(values.find((v) => typeof v === "string" && v.startsWith("<p>")) ?? ""));
    return Promise.resolve([]);
  },
}));

vi.mock("@/lib/news/aiClient", () => ({
  chatJson: vi.fn(async (input: any) => {
    calls.push(input);
    const r = replies.shift();
    if (r instanceof Error) throw r;
    return { json: r, model: input.model, tokensIn: 1, tokensOut: 1, durationMs: 1 };
  }),
}));

const { writeArticle, stripHeadings, lengthStatus, WRITER_PROMPT_VERSION } = await import("@/lib/news/writer");

const para = (n: number) => `<p>${Array.from({ length: n }, (_, i) => `word${i}`).join(" ")}.</p>`;
const article = (body: string) => ({ title: "Lufthansa adds Frankfurt-Tokyo route", excerpt: "x", body_html: body, tags: ["airlines"], category: "Aviation" });

beforeEach(() => {
  calls.length = 0;
  updates.length = 0;
  replies = [];
});

describe("writer helpers", () => {
  it("removes every heading", () => {
    expect(stripHeadings("<h2>What happened</h2><p>A.</p><h3>Why</h3><p>B.</p>")).toBe("<p>A.</p><p>B.</p>");
  });

  it("classifies length against the 200-300 house range", () => {
    expect(lengthStatus(120)).toBe("too_short");
    expect(lengthStatus(250)).toBe("ok");
    expect(lengthStatus(420)).toBe("too_long");
  });

  it("has a versioned prompt", () => {
    expect(WRITER_PROMPT_VERSION).toMatch(/^news-writer-v\d+/);
  });
});

describe("writeArticle", () => {
  it("tells the model: no headings, 200-300 words, unlabelled travelers paragraph", async () => {
    replies = [article(para(240))];
    await writeArticle("a1");
    const sys = calls[0].system;
    expect(sys).toContain("No headings, labels or section titles of any kind");
    expect(sys).toContain("200 to 300 words");
    expect(sys).toContain("what this means for them in practice");
    expect(sys).not.toMatch(/<h2>/);
    expect(calls[0].user).toContain("F1 What happened");
  });

  it("strips headings the model adds anyway", async () => {
    replies = [article("<h2>What happened</h2>" + para(240))];
    const r = await writeArticle("a1");
    expect(r.wordCount).toBe(240);
    expect(updates[0]).not.toContain("<h2>");
  });

  it("refuses a story that is too thin", async () => {
    replies = [article(para(100))];
    await expect(writeArticle("a1")).rejects.toThrow(/too short \(100 words; the minimum is 150\)/);
  });

  it("tightens a long story once", async () => {
    replies = [article(para(500)), { body_html: para(280) }];
    const r = await writeArticle("a1");
    expect(calls.map((c) => c.kind)).toEqual(["write", "tighten"]);
    expect(r.wordCount).toBe(280);
  });

  it("keeps the long version if tightening fails", async () => {
    replies = [article(para(500)), new Error("timeout")];
    const r = await writeArticle("a1");
    expect(r.wordCount).toBe(500);
  });
});
