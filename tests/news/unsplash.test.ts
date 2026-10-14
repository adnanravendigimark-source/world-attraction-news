import { describe, it, expect, vi, afterEach } from "vitest";
vi.mock("@/lib/db", () => ({ sql: vi.fn(async () => []) }));
import { unsplashUrls, storePhoto, captionHtml } from "@/lib/news/media";

const photo = {
  provider: "unsplash" as const,
  imageUrl: "https://images.unsplash.com/photo-1?ixid=abc&w=1080",
  rawUrl: "https://images.unsplash.com/photo-1?ixid=abc",
  pageUrl: "https://unsplash.com/photos/x",
  author: "Ana Lopez",
  license: "Unsplash License",
  licenseUrl: "",
  title: "Siam Park wave pool, Tenerife",
  query: "Siam Park Tenerife",
  width: 6000,
  height: 4000,
  _download: "https://api.unsplash.com/photos/x/download",
  _profile: "https://unsplash.com/@ana?utm_source=world_attraction_news&utm_medium=referral",
};

describe("Unsplash photos are hotlinked, as Unsplash's API terms require", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("a cover is cropped by Unsplash's image server to exactly 1200×675", () => {
    const c = unsplashUrls(photo, true);
    expect(c.url).toBe("https://images.unsplash.com/photo-1?ixid=abc&w=1200&h=675&fit=crop&crop=entropy&q=80&auto=format");
    expect([c.width, c.height]).toEqual([1200, 675]);
  });
  it("an in-article photo keeps its shape", () => {
    const c = unsplashUrls(photo, false);
    expect(c.url).toContain("w=1600&fit=max");
    expect(c.height).toBe(1067);
  });
  it("is never downloaded into our storage, but the download is reported to Unsplash", async () => {
    process.env.UNSPLASH_ACCESS_KEY = "test-key";
    const f = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", f);
    const r = await storePhoto(photo as any, { cover: true });
    expect(r.url).toMatch(/^https:\/\/images\.unsplash\.com\//);
    expect(f).toHaveBeenCalledTimes(1);
    expect(String((f.mock.calls[0] as any[])[0])).toBe(photo._download);
    delete process.env.UNSPLASH_ACCESS_KEY;
  });
  it("credits 'Photo by <name> on Unsplash' with both links", () => {
    const html = captionHtml(photo as any);
    expect(html).toContain("Photo by <a href=\"https://unsplash.com/@ana?utm_source=world_attraction_news&amp;utm_medium=referral\"");
    expect(html).toContain(">Ana Lopez</a> on <a href=\"https://unsplash.com/?utm_source=world_attraction_news&amp;utm_medium=referral\"");
  });
});

import { unsplashDescription, scorePhoto } from "@/lib/news/media";
describe("Unsplash location from the photo's own page", () => {
  it("adds the location and tags so the relevance check can see the place", () => {
    const d = unsplashDescription({ alt_description: "aerial view of city buildings during daytime", location: { name: "Barcelona, Spain", city: "Barcelona", country: "Spain" }, tags: [{ title: "architecture" }] });
    expect(d).toContain("Barcelona, Spain");
    expect(scorePhoto({ title: "aerial view of city buildings during daytime", description: d, query: "Barcelona skyline", width: 5000 }, { place: "Barcelona", country: "Spain" })).not.toBeNull();
  });
  it("without a location the same photo is not trusted", () => {
    expect(scorePhoto({ title: "aerial view of city buildings during daytime", description: "aerial view of city buildings during daytime", query: "Barcelona skyline" }, { place: "Barcelona", country: "Spain" })).toBeNull();
  });
});
