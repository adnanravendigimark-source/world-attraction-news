import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/db", () => ({ sql: vi.fn(async () => []) }));
import { keepAllowedLinks, officialLinks, headlineIssues, factsBlock } from "@/lib/news/factcheck";
import { newsKeywordPlacement } from "@/lib/news/quality";
import { normalizeFacts } from "@/lib/news/research";

describe("official links", () => {
  const research = { sources: [
    { n: 1, publisher: "Bali Tourism Board", url: "https://bali.go.id/tax", official: true },
    { n: 2, publisher: "Reuters", url: "https://reuters.com/x", official: false },
  ] } as any;
  it("only official sources are offered", () => {
    expect(officialLinks(research)).toEqual([{ name: "Bali Tourism Board", url: "https://bali.go.id/tax" }]);
  });
  it("drops links the model invented, keeps the text", () => {
    const html = '<p>Check <a href="https://bali.go.id/tax">the board</a> or <a href="https://made-up.com">here</a>.</p>';
    const out = keepAllowedLinks(html, ["https://bali.go.id/tax"]);
    expect(out).toContain('href="https://bali.go.id/tax"');
    expect(out).not.toContain("made-up.com");
    expect(out).toContain("or here.");
  });
  it("facts block lists status, start date, previous rule and links", () => {
    const f = normalizeFacts({ what_happened: "Bali raised its levy", status: "upcoming", effective_from: "1 January", previous_situation: "The levy was lower", important_facts: [{ claim: "x", sources: [1] }] }, 2);
    const block = factsBlock(f, research);
    expect(block).toContain("Status: confirmed, takes effect later");
    expect(block).toContain("Takes effect: 1 January");
    expect(block).toContain("Before this change: The levy was lower");
    expect(block).toContain("OFFICIAL LINKS");
  });
  it("unknown status becomes unclear", () => {
    expect(normalizeFacts({ status: "maybe" }, 1).status).toBe("unclear");
  });
});

describe("headline agrees with the facts", () => {
  it("flags a number the facts don't have", () => {
    const issues = headlineIssues({ title: "Bali levy rises to 500,000 rupiah" }, "F1 Number: 150,000 rupiah");
    expect(issues.some((i) => i.severity === "high" && i.text.startsWith("headline:"))).toBe(true);
  });
  it("passes when it matches", () => {
    expect(headlineIssues({ title: "Bali levy rises to 150,000 rupiah" }, "F1 Number: 150,000 rupiah").filter((i) => i.severity === "high")).toEqual([]);
  });
});

describe("keyword placement", () => {
  it("finds the keyword in each place", () => {
    const r = newsKeywordPlacement({
      focus_keyword: "Bali tourist tax",
      title: "Bali raises tourist tax for foreign visitors",
      meta_title: "Bali tourist tax rises",
      meta_description: "The tourist tax for Bali visitors rises in January.",
      slug: "bali-raises-tourist-tax",
      content_html: "<p>Bali will raise its tourist tax.</p>",
    });
    expect(r.missing).toEqual([]);
  });
  it("reports what is missing", () => {
    const r = newsKeywordPlacement({ focus_keyword: "Bali tourist tax", title: "Levy rises", slug: "levy-rises" });
    expect(r.missing).toContain("headline");
  });
});
