import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/db", () => ({ sql: Object.assign(async () => [], {}) }));
import { normalizeOutline, stripTopHeading, assembleHtml } from "@/lib/blogs/writer";

describe("blog outline", () => {
  it("keeps supported sections, drops intro/FAQ and reused facts, and spreads the length", () => {
    const o = normalizeOutline({ title: "Best Time to Visit Barcelona", sections: [
      { heading: "Introduction", facts: [0, 1] },
      { heading: "Weather by Season", intent: "x", words: 400, facts: [0, 1, 2] },
      { heading: "Festivals", words: 300, facts: [3, 4] },
      { heading: "Crowds and Prices", words: 300, facts: [2, 5, 6] },
      { heading: "Thin", facts: [9] },
      { heading: "FAQ", facts: [7, 8] },
    ] }, 9, 1000);
    expect(o.sections.map((s) => s.heading)).toEqual(["Weather by Season", "Festivals", "Crowds and Prices"]);
    expect(o.sections[2].facts).toEqual([5, 6]);
    const total = o.sections.reduce((n, s) => n + s.words, 0);
    expect(total).toBeGreaterThan(700);
    expect(total).toBeLessThan(900);
  });
  it("refuses an outline with too little support", () => {
    expect(() => normalizeOutline({ sections: [{ heading: "A", facts: [0, 1] }] }, 2, 1000)).toThrow();
  });
});

describe("assembling", () => {
  it("removes a repeated heading and builds H2 sections between intro and conclusion", () => {
    expect(stripTopHeading("<h2>Weather</h2><p>Hot in July.</p>", "Weather")).toBe("<p>Hot in July.</p>");
    const html = assembleHtml({ title: "t", intro: "<p>Intro.</p>", conclusion: "<p>End.</p>", sections: [{ heading: "Weather & Seasons", intent: "", words: 200, facts: [], html: "<p>Hot.</p>" }] });
    expect(html).toBe("<p>Intro.</p>\n<h2>Weather &amp; Seasons</h2>\n<p>Hot.</p>\n<p>End.</p>");
  });
});

import { tidyStyle } from "@/lib/blogs/writer";
describe("style clean-up", () => {
  it("swaps stock travel words for plain ones, keeping capitals", () => {
    expect(tidyStyle("<p>Vibrant streets in this bustling city.</p>")).toBe("<p>Lively streets in this busy city.</p>");
    expect(tidyStyle("<p>This guide covers the seasons.</p>")).toBe("<p>Below we cover the seasons.</p>");
  });
});
