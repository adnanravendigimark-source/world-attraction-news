import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/db", () => ({ sql: Object.assign(async () => [], {}) }));
import { sectionSubject, photoSections, insertAfterSection } from "@/lib/blogs/images";

describe("blog photos", () => {
  it("takes the photographable subject from a heading", () => {
    expect(sectionSubject("Weather in Barcelona by Season", "Barcelona, Spain")).toBe("Weather");
    expect(sectionSubject("Visiting the Sagrada Família", "Barcelona")).toBe("Sagrada Família");
  });
  it("puts a photo in every second section, at most four", () => {
    expect(photoSections(5)).toEqual([1, 3]);
    expect(photoSections(10)).toEqual([1, 3, 5, 7]);
  });
  it("places the photo after the section's first paragraph", () => {
    const html = "<p>i</p><h2>A</h2><p>a1</p><p>a2</p><h2>B</h2><p>b1</p>";
    expect(insertAfterSection(html, 1, "<figure>F</figure>")).toBe("<p>i</p><h2>A</h2><p>a1</p><p>a2</p><h2>B</h2><p>b1</p><figure>F</figure>");
    expect(insertAfterSection(html, 0, "<figure>F</figure>")).toBe("<p>i</p><h2>A</h2><p>a1</p><figure>F</figure><p>a2</p><h2>B</h2><p>b1</p>");
  });
});

import { sectionFigures, restoreFigures } from "@/lib/blogs/images";
describe("keeping photos through a rewrite", () => {
  it("puts each photo back in its section", () => {
    const before = '<p>i</p><h2>A</h2><p>a</p><h2>B</h2><p>b1</p><figure class="news-figure"><img src="1"></figure><p>b2</p>';
    const rewritten = "<p>i</p><h2>A</h2><p>a!</p><h2>B</h2><p>b1!</p><p>b2!</p>";
    const out = restoreFigures(rewritten, sectionFigures(before));
    expect(out).toBe('<p>i</p><h2>A</h2><p>a!</p><h2>B</h2><p>b1!</p><figure class="news-figure"><img src="1"></figure><p>b2!</p>');
  });
});

import { blogCoverQueries } from "@/lib/blogs/images";
describe("guide cover searches", () => {
  it("a guide with no subject beyond the place starts with the skyline", () => {
    expect(blogCoverQueries("Best Time to Visit Barcelona: A Seasonal Guide", "Barcelona")).toEqual(["Barcelona skyline", "Barcelona city view", "Barcelona"]);
  });
  it("a guide with a subject searches for it first", () => {
    expect(blogCoverQueries("Arno Boat Tour: Your Ultimate Guide in Florence", "Florence")[0]).toBe("Florence Arno Boat Tour");
  });
});
