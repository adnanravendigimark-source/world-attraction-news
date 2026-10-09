import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  sql: (strings: TemplateStringsArray) => {
    const q = strings.join("?");
    if (/FROM articles WHERE id = \? AND type = 'news'/.test(q))
      return Promise.resolve([
        {
          id: "a1", title: "Lufthansa adds Frankfurt to Tokyo route", slug: "s", excerpt: "e", meta_title: "m", meta_description: "d",
          focus_keyword: "k", canonical_url: "c", tags: ["airlines"], image: "https://x/i.webp", image_alt: "alt", category_id: "c1",
          word_count: 240, news_cluster_id: "c1",
          content_html: "<p>Lufthansa will fly daily from Frankfurt to Tokyo from 1 December, the airline said.</p><p>Travelers booked on the old route may want to check their tickets.</p>",
        },
      ]);
    if (/FROM news_items i JOIN news_sources/.test(q))
      return Promise.resolve([{ title: "Lufthansa will fly daily from Frankfurt to Tokyo from 1 December", description: "", source: "Reuters" }]);
    return Promise.resolve([]);
  },
}));

const { computeQuality, hasTravelerGuidance, freshnessFraction } = await import("@/lib/news/quality");
const { sourceOverlap } = await import("@/lib/news/overlap");
const { validateSourceList } = await import("@/lib/news/articleSources");

describe("source overlap", () => {
  const src = [{ label: "Reuters", text: "Japan will require all foreign visitors to register online before arrival starting April 2027, officials said." }];

  it("finds a copied run of 8+ words and reports the whole run", () => {
    const m = sourceOverlap("<p>From next year Japan will require all foreign visitors to register online before arrival, the agency said.</p>", src);
    expect(m).toHaveLength(1);
    expect(m[0].phrase).toBe("japan will require all foreign visitors to register online before arrival");
    expect(m[0].words).toBe(11);
    expect(m[0].source).toBe("Reuters");
  });

  it("ignores runs shorter than 8 words and punctuation or case changes", () => {
    expect(sourceOverlap("<p>Japan will require foreign visitors to sign up online.</p>", src)).toEqual([]);
    expect(sourceOverlap("<p>JAPAN WILL REQUIRE ALL FOREIGN, VISITORS TO REGISTER ONLINE.</p>", src)[0]?.words).toBe(9);
  });
});

describe("quality helpers", () => {
  it("spots a practical travelers paragraph", () => {
    expect(hasTravelerGuidance("<p>Passengers may want to check their booking.</p>")).toBe(true);
    expect(hasTravelerGuidance("<p>The airline reported strong results.</p><p>Travelers love Tokyo.</p>")).toBe(false);
  });

  it("scores freshness by age", () => {
    expect(freshnessFraction(10)).toBe(1);
    expect(freshnessFraction(100)).toBe(0.5);
    expect(freshnessFraction(400)).toBe(0);
  });
});

describe("computeQuality", () => {
  it("has weights that add up to 100 and catches copying from a source", async () => {
    const q = await computeQuality("a1");
    expect(q.checks.reduce((n, c) => n + c.weight, 0)).toBe(100);
    expect(q.overlap.length).toBe(1);
    expect(q.checks.find((c) => c.key === "overlap")!.ok).toBe(false);
    expect(q.checks.find((c) => c.key === "travelers")!.ok).toBe(true);
  });
});

describe("article source list validation", () => {
  it("cleans and keeps order", () => {
    const r = validateSourceList([{ url: "https://www.reuters.com/a", title: " Headline " }, { url: "https://gov.example/b", publisher: "Gov", isOfficial: true }]);
    expect(r).toEqual({
      sources: [
        { url: "https://www.reuters.com/a", publisher: "reuters.com", title: "Headline", isOfficial: false },
        { url: "https://gov.example/b", publisher: "Gov", title: "", isOfficial: true },
      ],
    });
  });

  it("rejects bad links and duplicates", () => {
    expect(validateSourceList([{ url: "javascript:alert(1)" }])).toHaveProperty("error");
    expect(validateSourceList([{ url: "not a url" }])).toHaveProperty("error");
    expect(validateSourceList([{ url: "https://a.com/x" }, { url: "https://a.com/x" }])).toHaveProperty("error");
  });
});

describe("inline photos", () => {
  it("keeps short news stories free of inline photos", async () => {
    const { inlinePhotoLimit } = await import("@/lib/news/imagegen");
    expect(inlinePhotoLimit(205)).toBe(0);
    expect(inlinePhotoLimit(420)).toBe(1);
    expect(inlinePhotoLimit(900)).toBe(2);
  });
});
