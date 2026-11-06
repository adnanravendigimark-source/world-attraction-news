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
    // "Thin" cited only an invalid fact; it now gets the unused facts 7 and 8 instead of being dropped.
    expect(o.sections.map((s) => s.heading)).toEqual(["Weather by Season", "Festivals", "Crowds and Prices", "Thin"]);
    expect(o.sections[2].facts).toEqual([5, 6]);
    expect(o.sections[3].facts).toEqual([7, 8]);
    const total = o.sections.reduce((n, s) => n + s.words, 0);
    // 9 facts carry about 270 words; the guide is still the 500-word minimum
    // (body 400), shared by each section's facts.
    expect(o.recommendedWords).toBe(500);
    expect(total).toBeGreaterThanOrEqual(395);
    expect(total).toBeLessThanOrEqual(405);
    expect(o.sections[0].words).toBeGreaterThan(o.sections[1].words); // 3 facts vs 2
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

import { replaceSection } from "@/lib/blogs/writer";
describe("rewriting one section", () => {
  const html = '<p>Intro.</p><h2>A</h2><p>a1</p><figure class="news-figure"><img src="x"></figure><p>a2</p><h2>B</h2><p>b1</p><p>The end.</p>';
  it("replaces only that section and keeps its photo", () => {
    const out = replaceSection(html, 0, "<p>new a</p><p>more</p>");
    expect(out).toContain('<h2>A</h2>\n<p>new a</p><figure class="news-figure"><img src="x"></figure><p>more</p>\n<h2>B</h2>');
    expect(out).not.toContain("a2");
  });
  it("keeps the conclusion when the last section is rewritten", () => {
    const out = replaceSection(html, 1, "<p>new b</p>", "<p>The end.</p>");
    expect(out.endsWith("<p>new b</p>\n<p>The end.</p>")).toBe(true);
  });
});

import { keywordPlacement, readability } from "@/lib/blogs/quality";
describe("on-page SEO checks", () => {
  it("finds the keyword in title, opening, heading, meta and URL", () => {
    const r = keywordPlacement({
      keyword: "best time to visit Barcelona",
      title: "Best Time to Visit Barcelona: Weather and Crowds",
      html: "<p>The best time to visit Barcelona is May to June.</p><h2>Best Time to Visit Barcelona by Season</h2><p>x</p>",
      metaDescription: "Find the best time to visit Barcelona by month.",
      slug: "best-time-to-visit-barcelona",
    });
    expect(r.missing).toEqual([]);
  });
  it("flags keyword stuffing and long sentences", () => {
    const k = "barcelona beaches";
    const r = keywordPlacement({ keyword: k, title: "", html: `<p>${(k + " ").repeat(20)}</p>`, metaDescription: "", slug: "" });
    expect(r.density).toBeGreaterThan(2.5);
    expect(readability(`<p>${"word ".repeat(40)}end.</p>`).avgSentence).toBeGreaterThan(22);
  });
});

describe("outline length follows the facts", () => {
  it("never asks for more words than the facts can carry", () => {
    // 3 sections of 10 facts: 30 facts x 30 words = 900 body words, 1125 in all.
    const sections = [0, 1, 2].map((i) => ({ heading: `S${i}`, words: 300, facts: Array.from({ length: 10 }, (_, k) => i * 10 + k) }));
    const o = normalizeOutline({ title: "t", recommended_words: 2000, sections }, 30, 1800);
    expect(o.recommendedWords).toBe(1125);
    expect(o.sections.map((s) => s.words)).toEqual([300, 300, 300]);
  });
  it("a section's words follow its facts, not the model's guess", () => {
    const o = normalizeOutline({ title: "t", recommended_words: 3000, sections: [
      { heading: "Transport", words: 200, facts: Array.from({ length: 15 }, (_, k) => k) },
      { heading: "Food", words: 400, facts: [15, 16] },
      { heading: "Tips", words: 400, facts: [17, 18] },
      { heading: "Regions", words: 400, facts: [19, 20, 21, 22, 23, 24, 25] },
    ] }, 34, 1900);
    const byName = Object.fromEntries(o.sections.map((s) => [s.heading, s.words]));
    expect(byName.Transport).toBeGreaterThan(byName.Regions);
    expect(byName.Food).toBeLessThan(100); // 2 facts: ~60-80 words, not 170
  });
});

import { normalizeOutline as no2 } from "@/lib/blogs/writer";
describe("outline repair", () => {
  it("sections the model under-cited get unused facts instead of being dropped", () => {
    const raw = { title: "T", sections: [
      { heading: "What Siam Park Is", facts: [0, 1] },
      { heading: "Rides and Waves", facts: [2] },
      { heading: "Getting There", facts: [] },
      { heading: "Tickets", facts: [3, 4] },
    ] };
    const o = no2(raw, 12, 1000);
    expect(o.sections.map((s) => s.heading)).toEqual(["What Siam Park Is", "Rides and Waves", "Getting There", "Tickets"]);
    expect(o.sections.every((s) => s.facts.length >= 2)).toBe(true);
    const all = o.sections.flatMap((s) => s.facts);
    expect(new Set(all).size).toBe(all.length); // still no fact used twice
  });
  it("too few facts gives a clear research message", () => {
    expect(() => no2({ sections: [{ heading: "A", facts: [0, 1] }] }, 4, 1000)).toThrow(/too few facts/);
  });
});

import { tidyStyle as tidyStyle2 } from "@/lib/blogs/writer";
describe("tidyStyle: must-see", () => {
  it("keeps the sentence grammatical", () => {
    expect(tidyStyle2("The porticoes are a must-see for any visitor.")).toBe("The porticoes are a highlight for any visitor.");
    expect(tidyStyle2("The towers are a must-see.")).toBe("The towers are a highlight.");
    expect(tidyStyle2("Visit this must-see museum.")).toBe("Visit this top museum.");
    expect(tidyStyle2("Must-see sights include the towers.")).toBe("Top sights include the towers.");
  });
});

describe("outline uses the facts the model skipped", () => {
  it("adds each skipped fact to the section with the same subtopic", () => {
    const sub = ["seasons", "seasons", "transport", "transport", "food", "food", "seasons", "transport", "history"];
    const o = normalizeOutline({ title: "t", sections: [
      { heading: "Weather", facts: [0, 1] },
      { heading: "Getting Around", facts: [2, 3] },
      { heading: "Food", facts: [4, 5] },
    ] }, 9, 1500, sub);
    const by = Object.fromEntries(o.sections.map((s) => [s.heading, s.facts]));
    expect(by.Weather).toEqual([0, 1, 6]);
    expect(by["Getting Around"]).toEqual([2, 3, 7]);
    expect(o.sections.flatMap((s) => s.facts)).not.toContain(8); // no history section: left out
  });
});

import { dropPlanningOpeners, joinShortParagraphs, sectionKeyword } from "@/lib/blogs/writer";
describe("guide text clean-up", () => {
  it("drops the 'When planning a trip to X,' opener", () => {
    expect(dropPlanningOpeners("<p>When planning a trip to Paris, consider the seasonal weather.</p>")).toBe("<p>Consider the seasonal weather.</p>");
    expect(dropPlanningOpeners("<p>If you are planning a visit, book early.</p>")).toBe("<p>Book early.</p>");
    expect(dropPlanningOpeners("<p>Paris has 20 arrondissements.</p>")).toBe("<p>Paris has 20 arrondissements.</p>");
  });
  it("joins a one-sentence paragraph to the one before it", () => {
    const html = "<p>Summer in Paris is typically warm, averaging 22°C, with around eight hours of sunshine on most days in July.</p><p>Winter brings cooler temperatures.</p><h2>Next</h2><p>Short one.</p>";
    expect(joinShortParagraphs(html)).toBe(
      "<p>Summer in Paris is typically warm, averaging 22°C, with around eight hours of sunshine on most days in July. Winter brings cooler temperatures.</p><h2>Next</h2><p>Short one.</p>"
    );
  });
  it("keeps the closing guide link and long paragraphs apart", () => {
    const long = `<p>${"word ".repeat(20)}end.</p>`;
    const html = `${long}${long}<p class="guide-cta">Planning a trip? See all our guides.</p>`;
    expect(joinShortParagraphs(html)).toBe(html);
  });
  it("one keyword per section: primary first, then the secondary ones", () => {
    const o = { primaryKeyword: "paris trip planning", secondaryKeywords: ["book paris attractions", "paris train tickets"] };
    expect([0, 1, 2, 3].map((i) => sectionKeyword(o, i))).toEqual(["paris trip planning", "book paris attractions", "paris train tickets", "book paris attractions"]);
  });
});
