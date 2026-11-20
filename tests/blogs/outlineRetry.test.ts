import { describe, it, expect, vi, beforeEach } from "vitest";

const saved: any[] = [];
vi.mock("@/lib/db", () => ({
  sql: Object.assign(async (strings: TemplateStringsArray, ...values: any[]) => {
    const text = strings.join("?");
    if (/UPDATE blog_topics SET outline/.test(text)) saved.push(JSON.parse(values[0]));
    return [{ outline: null }];
  }, {}),
}));
vi.mock("@/lib/blogs/topics", async (orig) => ({
  ...(await orig<any>()),
  getTopic: async () => ({ id: "t1", title: "New Attractions Opening in 2027", destination: "Germany", topicType: "attractions", targetWords: 1800, angle: "", plan: null }),
}));
const facts = Array.from({ length: 20 }, (_, i) => ({ subtopic: i < 14 ? "places" : "history", claim: `Fact number ${i} about a sight in Germany.`, sources: [1], volatile: false }));
vi.mock("@/lib/blogs/research", async (orig) => ({
  ...(await orig<any>()),
  getLatestBlogResearch: async () => ({ status: "done", facts, sources: [] }),
}));
const chatJson = vi.fn();
vi.mock("@/lib/news/aiClient", async (orig) => ({ ...(await orig<any>()), chatJson: (...a: any[]) => chatJson(...a) }));

import { outlineStep } from "@/lib/blogs/writer";

const good = { title: "Top Sights in Germany", sections: [0, 1, 2, 3].map((k) => ({ heading: `Section ${k}`, intent: "x", words: 300, facts: [k * 5, k * 5 + 1, k * 5 + 2, k * 5 + 3, k * 5 + 4] })) };

beforeEach(() => {
  process.env.OPENAI_API_KEY = "test";
  saved.length = 0;
  chatJson.mockReset();
});

describe("outline never stops at too few sections", () => {
  it("asks once more when the first plan has no sections", async () => {
    chatJson.mockResolvedValueOnce({ json: { sections: [] } }).mockResolvedValueOnce({ json: good });
    const o = await outlineStep("t1");
    expect(chatJson).toHaveBeenCalledTimes(2);
    expect(chatJson.mock.calls[1][0].reasoningEffort).toBe("medium");
    expect(o.sections.length).toBe(4);
    expect(o.title).toBe("Top Sights in Germany");
  });
  it("builds the outline from the facts when both tries fail", async () => {
    chatJson.mockResolvedValue({ json: { sections: [] } });
    const o = await outlineStep("t1");
    expect(chatJson).toHaveBeenCalledTimes(2);
    expect(o.sections.length).toBeGreaterThanOrEqual(3);
    expect(o.sections.reduce((n, s) => n + s.facts.length, 0)).toBe(20);
    expect(saved.length).toBe(1);
  });
  it("makes one call when the first plan is good", async () => {
    chatJson.mockResolvedValueOnce({ json: good });
    await outlineStep("t1");
    expect(chatJson).toHaveBeenCalledTimes(1);
  });
});
