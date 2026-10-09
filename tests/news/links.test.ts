import { describe, expect, it } from "vitest";
import { applyLink, removeLink, planLinks, MAX_IN_TEXT, type LinkCandidate } from "@/lib/news/links";
import { relatedBoxItems, findMentions, type InternalLink } from "@/lib/news/internalLinks";

const city = (name: string, url = `/italy/${name.toLowerCase()}`): LinkCandidate => ({ name, url, type: "site_city" });
const country = (name: string, url = `/${name.toLowerCase()}`): LinkCandidate => ({ name, url, type: "site_country" });

describe("applyLink", () => {
  it("never links inside a heading, a figure, its caption or an existing link", () => {
    const html = '<h2>Rome</h2><figure><img src="x"><figcaption>Rome at night</figcaption></figure><p><a href="/x">Rome</a> and Rome</p>';
    expect(applyLink(html, "Rome", "/italy/rome")).toBe(
      '<h2>Rome</h2><figure><img src="x"><figcaption>Rome at night</figcaption></figure><p><a href="/x">Rome</a> and <a href="/italy/rome">Rome</a></p>'
    );
  });

  it("skips the lede when asked", () => {
    const html = "<p>Rome opens a museum.</p><p>Visitors to Rome need tickets.</p>";
    expect(applyLink(html, "Rome", "/italy/rome", { skipLede: true })).toBe('<p>Rome opens a museum.</p><p>Visitors to <a href="/italy/rome">Rome</a> need tickets.</p>');
    expect(applyLink("<p>Only in Rome.</p>", "Rome", "/r", { skipLede: true })).toBe("<p>Only in Rome.</p>");
  });

  it("removes a link and keeps its words", () => {
    expect(removeLink('<p>See <a href="/italy/rome">Rome</a> and <a href="/x">X</a>.</p>', "/italy/rome")).toBe('<p>See Rome and <a href="/x">X</a>.</p>');
  });
});

describe("planLinks", () => {
  const html = "<p>Lede about Rome, Milan and Italy.</p><p>Rome, Milan, Florence, Venice and Italy all change rules.</p>";

  it("links at most 3 pages in the text, cities before countries, one link per page", () => {
    const plan = planLinks(html, [country("Italy"), city("Rome"), city("Milan"), city("Florence"), city("Venice"), city("Rome")]);
    expect(plan.inText.map((l) => l.name)).toEqual(["Rome", "Milan", "Florence"]);
    expect(plan.inText).toHaveLength(MAX_IN_TEXT);
    expect(plan.related.map((l) => l.name)).toEqual(["Venice", "Italy"]);
    expect(plan.html.match(/<a /g)).toHaveLength(3);
    expect(plan.html.startsWith("<p>Lede about Rome, Milan and Italy.</p>")).toBe(true); // lede untouched
  });

  it("leaves out pages an editor removed", () => {
    const plan = planLinks(html, [city("Rome"), city("Milan")], new Set(["/italy/rome"]));
    expect(plan.inText.map((l) => l.name)).toEqual(["Milan"]);
    expect(plan.related).toEqual([]);
  });

  it("puts a page mentioned only in the lede in the Related box", () => {
    const plan = planLinks("<p>Lede about Naples.</p><p>Nothing else.</p>", [city("Naples")]);
    expect(plan.inText).toEqual([]);
    expect(plan.related.map((l) => l.name)).toEqual(["Naples"]);
  });
});

describe("Related box", () => {
  const link = (id: number, over: Partial<InternalLink>): InternalLink => ({
    id, targetUrl: `/p${id}`, targetType: "site_city", entityName: `P${id}`, placement: "in_text", status: "applied", createdBy: "system", createdAt: "", ...over,
  });

  it("renders only applied links, destinations before articles, no duplicates", () => {
    expect(relatedBoxItems([])).toEqual([]);
    expect(relatedBoxItems([link(1, { status: "removed" })])).toEqual([]);
    const items = relatedBoxItems([
      link(1, { targetType: "site_article", placement: "related_box" }),
      link(2, { targetType: "site_country" }),
      link(3, {}),
      link(4, { targetUrl: "/p3" }),
    ]);
    expect(items.map((i) => i.name)).toEqual(["P3", "P2", "P1"]);
  });

  it("finds mentions outside existing links and figures", () => {
    const html = '<p><a href="/x">Paris</a></p><figure><figcaption>Lyon</figcaption></figure><p>Nice is busy.</p>';
    expect(findMentions(html, [{ name: "Paris" }, { name: "Lyon" }, { name: "Nice" }]).map((m) => m.name)).toEqual(["Nice"]);
  });
});
