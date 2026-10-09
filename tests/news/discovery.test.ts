import { describe, expect, it } from "vitest";
import { scoreRelevance, DEFAULT_FILTER_CONFIG } from "@/lib/news/filter";
import { normalizeUrl, sameStoryTitles, entities } from "@/lib/news/similarity";
import { parseFeed, stripHtml } from "@/lib/news/rss";
import { isPublicUrl, htmlToText } from "@/lib/news/extract";

describe("travel relevance filter", () => {
  it("scores clear travel stories as relevant", () => {
    const r = scoreRelevance({ title: "Japan changes tourist entry requirements for visa-free visitors" }, DEFAULT_FILTER_CONFIG);
    expect(r.status).toBe("relevant");
    expect(r.category).toBe("Travel Rules");
  });

  it("rejects off-topic stories", () => {
    const r = scoreRelevance({ title: "Apple launches new iPhone with better camera" }, DEFAULT_FILTER_CONFIG);
    expect(r.status).toBe("irrelevant");
  });

  it("penalises sports even when a travel word appears", () => {
    const r = scoreRelevance({ title: "Premier League club confirms transfer window signing after flight to Madrid" }, DEFAULT_FILTER_CONFIG);
    expect(r.status).not.toBe("relevant");
  });
});

describe("story similarity", () => {
  it("matches differently worded headlines about the same event", () => {
    expect(sameStoryTitles("Japan Updates Tourist Entry Rules", "Japan Changes Rules for Tourists")).toBe(true);
  });

  it("keeps the same story in different countries apart", () => {
    expect(sameStoryTitles("Japan updates tourist entry rules", "Thailand updates tourist entry rules")).toBe(false);
  });

  it("finds known places as entities", () => {
    expect([...entities("New Lufthansa route links Frankfurt and Tokyo")]).toEqual(expect.arrayContaining(["lufthansa", "frankfurt", "tokyo"]));
  });

  it("normalises tracking parameters, www and trailing slashes", () => {
    expect(normalizeUrl("https://www.example.com/a/b/?utm_source=x&id=3#top")).toBe(normalizeUrl("https://example.com/a/b?id=3"));
  });
});

describe("feed parsing", () => {
  it("parses RSS 2.0 items", () => {
    const xml = `<?xml version="1.0"?><rss><channel><item><title><![CDATA[Airport opens new terminal]]></title><link>https://ex.com/a</link><guid>a1</guid><pubDate>Wed, 08 Oct 2026 08:00:00 GMT</pubDate><description>&lt;p&gt;Big &amp;amp; new&lt;/p&gt;</description></item></channel></rss>`;
    const items = parseFeed(xml);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Airport opens new terminal");
    expect(items[0].url).toBe("https://ex.com/a");
    expect(items[0].publishedAt).toBe("2026-10-08T08:00:00.000Z");
  });

  it("strips tags and decodes entities", () => {
    expect(stripHtml("<p>Caf&eacute; &amp; bar</p>")).toContain("&");
  });
});

describe("page extraction safety", () => {
  it("blocks private and local addresses", () => {
    expect(isPublicUrl("http://localhost:3000/x")).toBe(false);
    expect(isPublicUrl("http://10.0.0.5/")).toBe(false);
    expect(isPublicUrl("http://192.168.1.1/")).toBe(false);
    expect(isPublicUrl("file:///etc/passwd")).toBe(false);
    expect(isPublicUrl("https://www.reuters.com/travel")).toBe(true);
  });

  it("keeps article paragraphs and drops navigation", () => {
    const long = "This is a long paragraph about the new airline route that starts in December and runs daily.";
    const { text } = htmlToText(`<html><nav><p>${long} nav</p></nav><article><p>${long}</p><p>${long} Second.</p>${"<p>filler text that is long enough to count as a paragraph here.</p>".repeat(20)}</article></html>`);
    expect(text).toContain("Second.");
    expect(text).not.toContain("nav");
  });
});

describe("duplicate stories", () => {
  it("matches the two Belgrade tourist tax headlines", async () => {
    const { sameStoryTitles: same } = await import("@/lib/news/similarity");
    expect(
      same(
        "Belgrade increases visitor fee – Tourist tax set at 240 dinars per day starting October 15 - eKapija",
        "Belgrade introduces new tourist tax: From October 15th, stays will be more expensive - Слободен печат"
      )
    ).toBe(true);
  });

  it("still keeps different events in the same place apart", async () => {
    const { sameStoryTitles: same } = await import("@/lib/news/similarity");
    expect(same("Paris opens new Louvre entrance for visitors", "Paris metro strike disrupts airport trains")).toBe(false);
    expect(same("Lufthansa adds daily Frankfurt to Tokyo flights", "Lufthansa pilots announce strike on Friday")).toBe(false);
  });

  it("plans merges: keeps the story with an article as the target and never merges one away", async () => {
    const { planMerges } = await import("@/lib/news/cluster");
    const plans = planMerges([
      { id: "a", titles: ["Belgrade increases visitor fee – Tourist tax set at 240 dinars per day starting October 15"], hasArticle: true, itemCount: 2, firstSeen: 1 },
      { id: "b", titles: ["Belgrade introduces new tourist tax: From October 15th, stays will be more expensive"], hasArticle: false, itemCount: 1, firstSeen: 2 },
      { id: "c", titles: ["Air Canada cancels flights to six destinations"], hasArticle: false, itemCount: 1, firstSeen: 3 },
    ]);
    expect(plans).toEqual([{ target: "a", merge: ["b"] }]);
  });
});
