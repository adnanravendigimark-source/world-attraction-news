import { describe, expect, it } from "vitest";
import { applyLink, suggestLinks } from "@/lib/news/guidelinks";
import { insertFigures, stripOurFigures, figureHtml } from "@/lib/news/media";
import { normalizeFacts } from "@/lib/news/research";

describe("internal links", () => {
  it("links the first plain mention only", () => {
    const out = applyLink("<p>Paris is busy. Paris again.</p>", "Paris", "/destinations/france/paris");
    expect(out).toBe('<p><a href="/destinations/france/paris">Paris</a> is busy. Paris again.</p>');
  });

  it("never links inside an existing link", () => {
    const html = '<p><a href="/x">Paris</a> and Paris</p>';
    expect(applyLink(html, "Paris", "/p")).toBe('<p><a href="/x">Paris</a> and <a href="/p">Paris</a></p>');
  });

  it("does not match inside longer words", () => {
    expect(applyLink("<p>Romeo visited.</p>", "Rome", "/r")).toBe("<p>Romeo visited.</p>");
  });

  it("suggests attractions before cities", () => {
    const s = suggestLinks("<p>The Eiffel Tower in Paris.</p>", [
      { type: "city", name: "Paris", place: "France", path: "/paris" },
      { type: "attraction", name: "Eiffel Tower", place: "Paris", path: "/eiffel" },
    ]);
    expect(s.map((x) => x.name)).toEqual(["Eiffel Tower", "Paris"]);
  });
});

describe("inline figures", () => {
  const paras = Array.from({ length: 6 }, (_, i) => `<p>Paragraph ${i}.</p>`).join("");
  it("places figures between paragraphs and can strip them again", () => {
    const fig = figureHtml("https://blob/x.webp", "Alt", "Photo: A / Unsplash");
    const out = insertFigures(paras, [fig]);
    expect(out).toContain('<figure class="news-figure">');
    expect(out.startsWith("<p>Paragraph 0.</p>")).toBe(true);
    expect(stripOurFigures(out)).toBe(paras);
  });

  it("appends to very short articles", () => {
    expect(insertFigures("<p>One.</p>", ["<figure class=\"news-figure\"></figure>"])).toBe('<p>One.</p><figure class="news-figure"></figure>');
  });
});

describe("research output normalisation", () => {
  it("drops facts without a valid citation and caps sources", () => {
    const f = normalizeFacts(
      {
        important_facts: [
          { claim: "A", sources: [1, 2], confidence: "confirmed" },
          { claim: "B", sources: [9], confidence: "confirmed" },
          { claim: "C", sources: [], confidence: "single_source" },
        ],
      },
      2
    );
    expect(f.important_facts.map((x) => x.claim)).toEqual(["A"]);
  });

  it("downgrades a confirmed fact with one ordinary source", () => {
    const f = normalizeFacts({ important_facts: [{ claim: "A", sources: [1], confidence: "confirmed" }] }, 2);
    expect(f.important_facts[0].confidence).toBe("single_source");
  });

  it("fills missing text fields", () => {
    expect(normalizeFacts({}, 1).when).toBe("Not stated in sources");
  });
});
