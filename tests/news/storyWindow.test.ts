import { describe, it, expect, vi } from "vitest";

// Records every SQL text the story list runs.
const queries: string[] = [];
vi.mock("@/lib/db", () => ({
  sql: Object.assign(
    async (strings: any) => {
      queries.push(Array.isArray(strings) ? strings.join("?") : String(strings));
      return [];
    },
    {}
  ),
}));

import { listStories } from "@/lib/news/stories";

describe("Trending News window", () => {
  it("lists stories by when they were first reported, not by their newest article", async () => {
    await listStories({}).catch(() => {});
    const list = queries.find((q) => q.includes("FROM story_clusters c") && q.includes("ORDER BY trend_score"));
    expect(list).toBeTruthy();
    expect(list).toMatch(/COALESCE\(c\.published_first_at, c\.first_seen_at\) > now\(\)/);
    expect(list).not.toMatch(/c\.last_seen_at > now\(\)/);
  });
});
