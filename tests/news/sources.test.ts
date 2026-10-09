import { readFileSync } from "fs";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_NEWS_SOURCES, OFFICIAL_NEWS_SOURCES, validateNewsSourceInput } from "@/lib/news/sources";
import { isOfficialSource, officialSites, siteOf } from "@/lib/news/official";
import { parseFeed } from "@/lib/news/rss";
import { previewFeed } from "@/lib/news/collector";
import { scoreCluster, DEFAULT_TREND_CONFIG, type ClusterFacts } from "@/lib/news/trend";

const FIXTURES: Record<string, string> = {
  "https://travel.state.gov/_res/rss/TAsTWs.xml": "state-dept",
  "https://www.gov.uk/foreign-travel-advice.atom": "fcdo",
  "https://wwwnc.cdc.gov/travel/rss/notices.xml": "cdc",
  "https://news.delta.com/rss.xml": "delta",
  "https://united.mediaroom.com/news-releases?pagetemplate=rss": "united",
  "https://news.alaskaair.com/feed/": "alaska",
  "https://www.daa.ie/feed/": "daa",
  "https://media.amtrak.com/feed/": "amtrak",
  "https://news.flyfrontier.com/feed/": "frontier",
  "https://stories.hilton.com/feed": "hilton",
  "https://www.carnivalcorp.com/rss": "carnival",
  "https://disneyparksblog.com/feed/": "disney-parks",
  "https://blog.universalorlando.com/feed/": "universal-orlando",
};
const fixture = (name: string) => readFileSync(path.join(__dirname, "fixtures/official", `${name}.xml`), "utf8");

describe("official source list", () => {
  it("has 12-30 official feeds, all inactive for review", () => {
    expect(OFFICIAL_NEWS_SOURCES.length).toBeGreaterThanOrEqual(12);
    expect(OFFICIAL_NEWS_SOURCES.length).toBeLessThanOrEqual(30);
    for (const s of OFFICIAL_NEWS_SOURCES) {
      expect(s.isOfficial).toBe(true);
      expect(s.isActive).toBe(false);
      expect(validateNewsSourceInput(s)).toBeNull();
    }
  });

  it("never repeats a feed URL across the recommended lists", () => {
    const urls = [...DEFAULT_NEWS_SOURCES, ...OFFICIAL_NEWS_SOURCES].map((s) => s.rssUrl.toLowerCase());
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("has a fixture snapshot of every official feed that parses into dated, linked items", () => {
    for (const s of OFFICIAL_NEWS_SOURCES) {
      const name = FIXTURES[s.rssUrl];
      expect(name, s.rssUrl).toBeTruthy();
      const items = parseFeed(fixture(name), s.rssUrl);
      expect(items.length, name).toBeGreaterThan(0);
      for (const it of items) {
        expect(it.title, name).not.toBe("");
        expect(it.url, name).toMatch(/^https?:\/\//);
      }
    }
  });
});

describe("source validation", () => {
  const base = { name: "X", type: "rss", rssUrl: "https://example.com/feed" };
  it("rejects official aggregator sources", () => {
    expect(validateNewsSourceInput({ ...base, type: "google_news_rss", isOfficial: true })).toMatch(/can't be official/);
    expect(validateNewsSourceInput({ ...base, isOfficial: true })).toBeNull();
  });
  it("checks priority is 1-5", () => {
    expect(validateNewsSourceInput({ ...base, priority: 6 })).toMatch(/Priority/);
    expect(validateNewsSourceInput({ ...base, priority: 0 })).toMatch(/Priority/);
    expect(validateNewsSourceInput({ ...base, priority: 5 })).toBeNull();
  });
});

describe("official source detection", () => {
  const sites = officialSites([
    { url: "https://www.delta.com", rssUrl: "https://news.delta.com/rss.xml", isOfficial: true },
    { url: "https://www.united.com", rssUrl: "https://united.mediaroom.com/news-releases?pagetemplate=rss", isOfficial: true },
    { url: "https://skift.com", rssUrl: "https://skift.com/feed/", isOfficial: false },
  ]);

  it("trusts the editor's flag", () => {
    expect(isOfficialSource({ flagged: true, url: "https://example.com/a", sites })).toBe(true);
  });

  it("recognises an official site reached through an aggregator", () => {
    expect(isOfficialSource({ flagged: false, url: "https://news.delta.com/some-release", sites })).toBe(true);
    expect(isOfficialSource({ flagged: false, url: "https://www.delta.com/us/en/travel-update", sites })).toBe(true);
  });

  it("does not let a shared press-release platform vouch for other companies", () => {
    expect(isOfficialSource({ flagged: false, url: "https://united.mediaroom.com/2026-10-01-x", sites })).toBe(true);
    expect(isOfficialSource({ flagged: false, url: "https://othercorp.mediaroom.com/news", sites })).toBe(false);
  });

  it("accepts government domains and nothing merely named after airports or tourism", () => {
    expect(isOfficialSource({ flagged: false, url: "https://www.gov.uk/foreign-travel-advice/japan", sites })).toBe(true);
    expect(isOfficialSource({ flagged: false, url: "https://travel.state.gov/content/x.html", sites })).toBe(true);
    expect(isOfficialSource({ flagged: false, url: "https://home-affairs.ec.europa.eu/news/x", sites })).toBe(true);
    expect(isOfficialSource({ flagged: false, url: "https://www.travelandtourworld.com/news/airport-tourism", sites })).toBe(false);
    expect(isOfficialSource({ flagged: false, url: "https://airportwatch.example.com/", sites })).toBe(false);
    expect(isOfficialSource({ flagged: false, url: "https://skift.com/2026/10/01/x", sites })).toBe(false);
  });

  it("reduces hosts to their site", () => {
    expect(siteOf("news.delta.com")).toBe("delta.com");
    expect(siteOf("www.bbc.co.uk")).toBe("bbc.co.uk");
    expect(siteOf("travel.state.gov")).toBe("state.gov");
  });
});

describe("trend reliability", () => {
  const facts: ClusterFacts = {
    newestAt: new Date(),
    sourceCount: 1,
    category: "Aviation",
    maxRelevance: 80,
    maxReliability: 50,
    avgReliability: 50,
    matchesCoverage: false,
    duplicatesPublished: false,
  };
  it("lifts reliability when an official source carries the story", () => {
    const plain = scoreCluster(facts, DEFAULT_TREND_CONFIG);
    const official = scoreCluster({ ...facts, official: true }, DEFAULT_TREND_CONFIG);
    expect(plain.reliability).toBe(50);
    expect(official.reliability).toBe(90);
    expect(official.total).toBeGreaterThan(plain.total);
    expect(official.notes).toContain("official source");
  });
});

describe("test feed (preview without storing)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads a feed and reports items, travel matches and the newest date", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(fixture("state-dept"), { status: 200, headers: { "content-type": "application/rss+xml" } })));
    const p = await previewFeed("https://travel.state.gov/_res/rss/TAsTWs.xml", "Travel Rules");
    expect(p.itemCount).toBe(3);
    expect(p.sample).toHaveLength(3);
    expect(p.newestAt).toBeTruthy();
  });

  it("refuses private addresses and reports non-feeds", async () => {
    await expect(previewFeed("http://127.0.0.1/feed")).rejects.toThrow(/public/);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html><body>hello</body></html>", { status: 200 })));
    await expect(previewFeed("https://example.com/")).rejects.toThrow(/not an RSS/);
  });
});
