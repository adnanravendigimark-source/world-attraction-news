import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/db", () => ({ sql: Object.assign(async () => [], {}) }));
import { headlineCore, nonAmpUrl, relatedSearchUrl } from "@/lib/news/readability";

describe("more coverage search", () => {
  it("drops the publisher from a headline", () => {
    expect(headlineCore("Transavia adds two routes from Florence - The Flight Club")).toBe("Transavia adds two routes from Florence");
  });
  it("searches the last 24 hours only", () => {
    expect(decodeURIComponent(relatedSearchUrl("Transavia adds routes - Travel Times"))).toContain("Transavia adds routes when:1d");
  });
  it("tries the normal page instead of AMP", () => {
    expect(nonAmpUrl("https://site.it/en/2026/10/story/amp/")).toBe("https://site.it/en/2026/10/story/");
    expect(nonAmpUrl("https://site.it/story?amp=1")).toBe("https://site.it/story");
  });
});
