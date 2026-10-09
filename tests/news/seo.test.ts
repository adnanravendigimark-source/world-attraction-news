import { describe, expect, it, vi } from "vitest";

// The news sitemap reads published news and noindex overrides; both faked.
vi.mock("@/lib/db", () => ({
  sql: (strings: TemplateStringsArray) => {
    const q = strings.join("?");
    if (/FROM indexing_settings/.test(q)) return Promise.resolve([{ key: "article:n2" }, { key: "/news/blocked-by-url" }]);
    return Promise.resolve([]);
  },
}));
vi.mock("@/lib/articles", async (orig) => {
  const real: any = await orig();
  return {
    ...real,
    getPublishedNews: vi.fn(async ({ offset }: { offset: number }) => ({
      total: 3,
      articles:
        offset > 0
          ? []
          : [
              { id: "n1", slug: "lufthansa-adds-frankfurt-tokyo-route", updatedAt: "2026-10-01T00:00:00.000Z", publishedAt: "2026-10-01T00:00:00.000Z" },
              { id: "n2", slug: "hidden-by-key", updatedAt: "2026-10-01T00:00:00.000Z", publishedAt: null },
              { id: "n3", slug: "blocked-by-url", updatedAt: "2026-10-01T00:00:00.000Z", publishedAt: null },
            ],
    })),
  };
});

const { getNewsSitemapUrls, getStaticSitemapUrls } = await import("@/lib/sitemaps");
const { SITEMAP_TYPES, SITEMAP_TYPE_LABELS } = await import("@/lib/sitemapTypes");
const { newsArticleJsonLd, NEWSROOM_AUTHOR_SLUG } = await import("@/lib/seo");
const { newsSlugBase } = await import("@/lib/news/seo");

describe("news sitemap", () => {
  it("lists published news at /news/<slug> and respects noindex by key or URL", async () => {
    const urls = await getNewsSitemapUrls();
    expect(urls.map((u) => u.loc)).toEqual(["https://www.worldattractionnews.com/news/lufthansa-adds-frankfurt-tokyo-route"]);
  });

  it("is a registered sitemap type with a label", () => {
    expect(SITEMAP_TYPES).toContain("NEWS");
    expect(SITEMAP_TYPE_LABELS.NEWS).toBe("News Articles");
  });

  it("puts the /news listing in the static sitemap", async () => {
    expect((await getStaticSitemapUrls()).map((u) => u.loc)).toContain("https://www.worldattractionnews.com/news");
  });
});

describe("NewsArticle structured data", () => {
  const base = { title: "T", description: "D", image: "https://img/x.webp", path: "/news/t", authorName: "World Attraction News", publishedAt: "2026-10-01", updatedAt: "2026-10-02" };

  it("describes the newsroom byline as an Organization", () => {
    const j: any = newsArticleJsonLd({ ...base, authorSlug: NEWSROOM_AUTHOR_SLUG, section: "Aviation", keywords: ["airlines", "new routes"] });
    expect(j.author["@type"]).toBe("Organization");
    expect(j.articleSection).toBe("Aviation");
    expect(j.keywords).toBe("airlines, new routes");
    expect(j.publisher.logo.url).toMatch(/\/logo\.png$/);
  });

  it("keeps a human contributor as a Person", () => {
    const j: any = newsArticleJsonLd({ ...base, authorName: "Ana", authorSlug: "ana" });
    expect(j.author["@type"]).toBe("Person");
  });
});

describe("news slugs", () => {
  it("drops filler words and the publisher suffix, max 8 words", () => {
    expect(newsSlugBase("Japan Announces New Tourism Rules for International Travelers - Reuters")).toBe(
      "japan-announces-new-tourism-rules-international-travelers"
    );
    expect(newsSlugBase("One two three four five six seven eight nine ten").split("-")).toHaveLength(8);
  });

  it("keeps accented letters as plain letters", () => {
    expect(newsSlugBase("Café de Flore reopens in Saint-Germain")).toBe("cafe-de-flore-reopens-saint-germain");
  });

  it("falls back to the full title when it is mostly filler", () => {
    expect(newsSlugBase("Is it on?")).toBe("is-it-on");
  });
});
