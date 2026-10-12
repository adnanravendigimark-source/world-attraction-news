import { describe, it, expect } from "vitest";
import { canonicalArticleUrl, cleanPublisher, dedupeSources, sourceKey, staleYears } from "@/lib/news/sourceNames";

describe("source names", () => {
  it("shows a web address as its site", () => {
    expect(cleanPublisher("https://www.briefasia.com/")).toBe("briefasia.com");
    expect(cleanPublisher("www.briefasia.com")).toBe("briefasia.com");
    expect(cleanPublisher("Travel And Tour World")).toBe("Travel And Tour World");
    expect(cleanPublisher("", "https://news.bbc.co.uk/x")).toBe("bbc.co.uk");
  });
  it("treats locale and www variants as one article", () => {
    expect(canonicalArticleUrl("https://www.briefasia.com/en/article/thai-visa/")).toBe(canonicalArticleUrl("https://briefasia.com/article/thai-visa?utm=x"));
  });
  it("keeps one source per site", () => {
    const out = dedupeSources([
      { publisher: "Travel And Tour World", url: "https://www.travelandtourworld.com/news/article/a/" },
      { publisher: "www.briefasia.com", url: "https://www.briefasia.com/article/thai-visa" },
      { publisher: "https://www.briefasia.com/", url: "https://www.briefasia.com/en/article/thai-visa" },
    ]);
    expect(out.map((s) => s.publisher)).toEqual(["Travel And Tour World", "briefasia.com"]);
  });
  it("keys Google News links by publisher name", () => {
    expect(sourceKey({ publisher: "Reuters", url: "https://news.google.com/rss/articles/abc" })).toBe("reuters");
  });
  it("flags years well before today", () => {
    const now = new Date("2026-10-12T00:00:00Z");
    expect(staleYears("<p>levy effective February 2024; plans for 2027 and 2025</p>", now)).toEqual([2024]);
    expect(staleYears("no years here", now)).toEqual([]);
  });
});
