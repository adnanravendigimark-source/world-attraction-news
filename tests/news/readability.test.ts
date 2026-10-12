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

import { pickRepresentative, stripPublisher } from "@/lib/news/cluster";
describe("story headline", () => {
  it("prefers a real headline over a bare country name", () => {
    const r = pickRepresentative([
      { title: "Saudi Arabia", reliability: 95, publisher: "uk fcdo", published_at: "2026-10-08T18:00:00Z" },
      { title: "Riyadh Airport Closed: Flights Suspended After Blast", reliability: 70, publisher: "travel and tour world", published_at: "2026-10-10T17:00:00Z" },
    ]);
    expect(r.title).toBe("Riyadh Airport Closed: Flights Suspended After Blast");
  });
  it("drops the Google News publisher suffix", () => {
    expect(stripPublisher("New Barcelona route and JetBlue's return - The Business Journals", "the business journals")).toBe("New Barcelona route and JetBlue's return");
    expect(stripPublisher("Paris - Lyon trains restart", "sncf")).toBe("Paris - Lyon trains restart");
  });
});
