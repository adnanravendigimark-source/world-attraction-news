import { describe, it, expect, vi, beforeEach } from "vitest";

// Records every query and its parameters so the tests can see which story
// types a public listing asks for.
const calls: { query: string; params: any[] }[] = [];
vi.mock("@/lib/db", () => ({
  sql: async (q: any, params?: any[]) => {
    calls.push({ query: Array.isArray(q) ? q.join("?") : String(q), params: params || [] });
    return [];
  },
}));

import { getPublishedArticles, getPublishedArticlesPage } from "@/lib/articles";

function listingCall() {
  return calls.find((c) => c.query.includes("a.type = ANY("))!;
}

describe("public listings: story types", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it("lists guides only by default (Travel Guides page, sitemaps)", async () => {
    await getPublishedArticles({ citySlug: "rome" });
    expect(listingCall().params[0]).toEqual(["guide"]);
  });

  it("lists news and guides when asked (city, country and category pages)", async () => {
    await getPublishedArticles({ citySlug: "rome", types: ["news", "guide"] });
    expect(listingCall().params[0]).toEqual(["news", "guide"]);
    calls.length = 0;
    await getPublishedArticlesPage({ categorySlug: "airports", types: ["news", "guide"] });
    expect(listingCall().params[0]).toEqual(["news", "guide"]);
  });

  it("ignores unknown types instead of passing them to the query", async () => {
    await getPublishedArticles({ types: ["draft" as any] });
    expect(listingCall().params[0]).toEqual(["guide"]);
  });
});
