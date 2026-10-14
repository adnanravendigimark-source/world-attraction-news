import { describe, it, expect } from "vitest";
import { pickHomeStories, storyHref, storyKicker } from "@/lib/home";

const s = (id: string, type: "news" | "guide", day: number, extra: any = {}) =>
  ({ id, type, slug: id, title: id, publishedAt: `2026-10-${String(day).padStart(2, "0")}T10:00:00Z`, countrySlug: "italy", citySlug: "florence", cityName: "Florence", ...extra }) as any;

describe("home page story picking", () => {
  const news = [s("n1", "news", 12), s("n2", "news", 11), s("n3", "news", 5)];
  const guides = [s("g1", "guide", 14), s("g2", "guide", 13), s("g3", "guide", 10)];

  it("leads with the featured story, then mixes one news and one guide", () => {
    const r = pickHomeStories({ featured: [guides[2]], editorsPicks: [], guides, news });
    expect(r.lead?.id).toBe("g3");
    expect(r.secondary.map((a) => a.id).sort()).toEqual(["g1", "n1"]);
  });

  it("never shows a story twice", () => {
    const r = pickHomeStories({ featured: [], editorsPicks: [guides[0]], guides, news });
    const ids = [r.lead!.id, ...r.secondary.map((a) => a.id), ...r.news.map((a) => a.id), ...r.guides.map((a) => a.id)];
    expect(new Set(ids).size).toBe(ids.length);
    expect(r.lead?.id).toBe("g1"); // newest when nothing is featured
  });

  it("puts editor's picks first in the guides row", () => {
    const old = s("g4", "guide", 1);
    const r = pickHomeStories({ featured: [], editorsPicks: [old], guides: [...guides, old, s("g5", "guide", 2)], news: [] });
    expect(r.guides.map((a) => a.id)).toEqual(["g4", "g5"]);
  });

  it("copes with almost no content", () => {
    expect(pickHomeStories({ featured: [], editorsPicks: [], guides: [], news: [] }).lead).toBeNull();
    const one = pickHomeStories({ featured: [], editorsPicks: [], guides: [guides[0]], news: [] });
    expect(one.lead?.id).toBe("g1");
    expect(one.secondary).toEqual([]);
    expect(one.guides).toEqual([]);
  });

  it("links news and guides to their own URLs and labels them", () => {
    expect(storyHref(news[0])).toBe("/news/n1");
    expect(storyHref(guides[0])).toBe("/italy/florence/g1");
    expect(storyKicker(news[0])).toEqual({ label: "News", place: "Florence", breaking: false });
    expect(storyKicker(s("x", "news", 1, { cityName: "Global" })).place).toBe("");
  });
});
