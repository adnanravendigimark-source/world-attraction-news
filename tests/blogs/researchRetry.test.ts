import { describe, it, expect, vi, beforeEach } from "vitest";

// Every UPDATE of blog_research is recorded so the test can see whether the
// run was saved as done or failed.
const updates: { text: string; values: any[] }[] = [];
const statements: { text: string; values: any[] }[] = [];
vi.mock("@/lib/db", () => ({
  sql: Object.assign(async (strings: TemplateStringsArray, ...values: any[]) => {
    const text = strings.join("?");
    statements.push({ text, values });
    if (/INSERT INTO blog_research/.test(text)) return [{ id: "r1" }];
    if (/UPDATE blog_research/.test(text)) updates.push({ text, values });
    if (/SELECT \* FROM blog_research/.test(text)) {
      const last = updates[updates.length - 1];
      const done = last && /status = 'done'/.test(last.text);
      return [{ id: "r1", topic_id: "t1", status: done ? "done" : "failed", facts: done ? JSON.parse(last.values[0]) : [], sources: [], error: done ? "" : String(last?.values[0] || "") }];
    }
    return [];
  }, {}),
}));
vi.mock("@/lib/blogs/topics", () => ({
  getTopic: async () => ({ id: "t1", title: "Sagrada Familia 2027: Construction Updates and Visitor News", destination: "United States", topicType: "travel_guide", angle: "" }),
  resolveDestination: async (name: string) => ({ cityId: "city-" + name.toLowerCase(), countryId: null, label: `${name}, Spain` }),
}));
const chatJson = vi.fn();
vi.mock("@/lib/news/aiClient", () => ({ chatJson: (...a: any[]) => chatJson(...a) }));

import { runBlogResearch, topicSubject, isNamedSubject } from "@/lib/blogs/research";

const searched: string[] = [];
const longText = Array.from({ length: 8 }, (_, i) => `Paragraph ${i} about the Sagrada Família basilica in Barcelona, designed by Antoni Gaudí, with construction details and visitor information.`).join("\n");
function mockWiki() {
  globalThis.fetch = vi.fn(async (url: any) => {
    const u = String(url);
    const q = new URL(u).searchParams;
    if (q.get("list") === "search") {
      const term = q.get("srsearch") || "";
      searched.push(term);
      // Only the search without the wrong country finds the page.
      const results = /United States/.test(term) ? [{ title: "United States" }] : [{ title: "Sagrada Família" }];
      return new Response(JSON.stringify({ query: { search: results } }));
    }
    if (q.get("prop") === "extracts") {
      const title = q.get("titles") || "";
      return new Response(JSON.stringify({ query: { pages: [{ title, extract: longText }] } }));
    }
    return new Response("{}", { status: 404 });
  }) as any;
}

const facts = (n: number) => ({ facts: Array.from({ length: n }, (_, i) => ({ subtopic: "places", claim: `Sagrada Família fact number ${i} from the source.`, sources: [1], volatile: false })) });

beforeEach(() => {
  process.env.OPENAI_API_KEY = "test";
  updates.length = 0;
  statements.length = 0;
  searched.length = 0;
  chatJson.mockReset();
  mockWiki();
});

describe("a year in the headline", () => {
  it("is not part of the subject's name", () => {
    expect(topicSubject("Sagrada Familia 2027: Construction Updates and Visitor News", "United States")).toBe("Sagrada Familia");
    expect(isNamedSubject("Sagrada Familia", "Sagrada Família")).toBe(true);
  });
});

describe("research never stops at an empty first answer", () => {
  it("asks once more, thinking harder, when the first pass returns too few facts", async () => {
    chatJson.mockResolvedValueOnce({ json: { facts: [] }, tokensIn: 100, tokensOut: 10 }).mockResolvedValueOnce({ json: facts(20), tokensIn: 100, tokensOut: 900 });
    const r = await runBlogResearch("t1");
    expect(chatJson).toHaveBeenCalledTimes(2);
    expect(chatJson.mock.calls[0][0].reasoningEffort).toBe("low");
    expect(chatJson.mock.calls[1][0].reasoningEffort).toBe("medium");
    expect(r.status).toBe("done");
    expect(r.facts.length).toBe(20);
  });
  it("makes one call when the first pass is enough", async () => {
    chatJson.mockResolvedValueOnce({ json: facts(15), tokensIn: 100, tokensOut: 900 });
    const r = await runBlogResearch("t1");
    expect(chatJson).toHaveBeenCalledTimes(1);
    expect(r.status).toBe("done");
  });
  it("finds the subject's page even when the topic is filed under the wrong country", async () => {
    chatJson.mockResolvedValueOnce({ json: facts(15), tokensIn: 100, tokensOut: 900 });
    await runBlogResearch("t1");
    expect(searched).toContain("Sagrada Familia");
    const prompt = String(chatJson.mock.calls[0][0].user);
    expect(prompt).toContain("Wikipedia (encyclopedia, may be years old): Sagrada Família");
  });
  it("does not read pages about the wrong country when the subject's page never mentions it", async () => {
    chatJson.mockResolvedValueOnce({ json: facts(15), tokensIn: 100, tokensOut: 900 });
    await runBlogResearch("t1");
    const prompt = String(chatJson.mock.calls[0][0].user);
    expect(prompt).not.toMatch(/Wikipedia[^:\n]*: United States/);
    expect(prompt).not.toContain("Wikivoyage: United States");
  });
  it("still fails honestly when both passes find too little", async () => {
    chatJson.mockResolvedValue({ json: facts(3), tokensIn: 100, tokensOut: 100 });
    const r = await runBlogResearch("t1");
    expect(chatJson).toHaveBeenCalledTimes(2);
    expect(r.status).toBe("failed");
  });
});

// Wikidata answers for the Sagrada Família (trimmed): in Barcelona, Spain.
function mockWikidata() {
  const wiki = globalThis.fetch as any;
  globalThis.fetch = vi.fn(async (url: any, init?: any) => {
    const q = new URL(String(url)).searchParams;
    if (q.get("prop") === "pageprops") return new Response(JSON.stringify({ query: { pages: [{ title: "Sagrada Família", pageprops: { wikibase_item: "Q48435" } }] } }));
    if (q.get("action") === "wbgetentities") {
      const ids = String(q.get("ids")).split("|");
      const ent: Record<string, any> = {};
      for (const id of ids) {
        if (id === "Q48435")
          ent[id] = { id, labels: { en: { value: "Sagrada Família" } }, claims: { P17: [{ mainsnak: { datavalue: { value: { id: "Q29" } } } }], P131: [{ mainsnak: { datavalue: { value: { id: "Q1492" } } } }] } };
        if (id === "Q1492") ent[id] = { id, labels: { en: { value: "Barcelona" } }, claims: {} };
        if (id === "Q29") ent[id] = { id, labels: { en: { value: "Spain" } }, claims: {} };
      }
      return new Response(JSON.stringify({ entities: ent }));
    }
    return wiki(url, init);
  }) as any;
}

describe("a topic filed under the wrong country", () => {
  it("is moved to the subject's real city, with a note for the editor", async () => {
    mockWikidata();
    chatJson.mockResolvedValueOnce({ json: facts(15), tokensIn: 100, tokensOut: 900 });
    await runBlogResearch("t1");
    const move = statements.find((x) => /UPDATE blog_topics SET city_id/.test(x.text));
    expect(move?.values.slice(0, 2)).toEqual(["city-barcelona", null]);
    const done = updates.find((u) => /status = 'done'/.test(u.text))!;
    expect(done.values.join(" ")).toContain("Destination corrected: Sagrada Família is in Barcelona, Spain, not United States");
  });
});
