import { describe, it, expect } from "vitest";
import { cleanList, cleanHighlights, dropFlagged, highlightLines, highlightsCheckHtml, highlightsFromRow, issueMatches } from "@/lib/news/highlights";
import { contentHash } from "@/lib/news/contentHash";

describe("news boxes: cleaning", () => {
  it("takes lists or one-per-line text, strips markers and tags, drops blanks and duplicates, caps the count", () => {
    expect(cleanList("- Check your flight\n\n• <b>Allow</b> extra time\n2) Check your flight\nOne\nTwo\nThree", 4)).toEqual([
      "Check your flight",
      "Allow extra time",
      "One",
      "Two",
    ]);
    expect(cleanList(["  a  b ", 5, null, ""], 4)).toEqual(["a b"]);
    expect(cleanList(undefined, 4)).toEqual([]);
  });
  it("reads the database columns, which are missing before the migration", () => {
    expect(highlightsFromRow({})).toEqual({ keyUpdates: [], travelerSteps: [] });
    expect(highlightsFromRow({ key_updates: ["x"], traveler_steps: null }).keyUpdates).toEqual(["x"]);
  });
  it("escapes the bullets for the fact checker", () => {
    expect(highlightsCheckHtml({ keyUpdates: ["A < B & C"], travelerSteps: [] })).toBe("<p>A &lt; B &amp; C</p>");
  });
});

describe("news boxes: fact check", () => {
  const h = cleanHighlights({
    keyUpdates: ["12 people reported dead and 300+ injured after the strikes.", "Multiple airlines have cancelled flights to Riyadh."],
    travelerSteps: ["Check flight status directly with your airline.", "Claim a full refund from your airline."],
  });
  it("matches an issue that quotes the bullet, fully or mostly", () => {
    expect(issueMatches(h.keyUpdates[0], "12 people reported dead and 300+ injured")).toBe(true);
    expect(issueMatches(h.travelerSteps[1], "Claim a full refund from your airline")).toBe(true);
    expect(issueMatches(h.keyUpdates[1], "Operations at the airport remain suspended")).toBe(false);
  });
  it("drops only bullets flagged with high severity and reports which issues were about the boxes", () => {
    const issues = [
      { text: "Claim a full refund from your airline.", severity: "high" },
      { text: "Multiple airlines have cancelled flights to Riyadh.", severity: "low" },
      { text: "A sentence in the story body.", severity: "high" },
    ];
    const r = dropFlagged(h, issues);
    expect(r.kept.travelerSteps).toEqual(["Check flight status directly with your airline."]);
    expect(r.kept.keyUpdates).toHaveLength(2);
    expect(r.removed).toEqual(["Claim a full refund from your airline."]);
    expect([...r.boxIssues]).toEqual(["Claim a full refund from your airline."]);
  });
});

describe("fact-check fingerprint", () => {
  const html = "<p>Flights were cancelled.</p>";
  it("is unchanged for a story without boxes, so older checks stay current", () => {
    expect(contentHash(html, [])).toBe(contentHash(html));
    expect(contentHash(html, highlightLines({ keyUpdates: [], travelerSteps: [] }))).toBe(contentHash(html));
  });
  it("changes when a bullet changes, so the check goes stale", () => {
    const a = contentHash(html, ["Airlines cancelled flights."]);
    expect(a).not.toBe(contentHash(html));
    expect(a).not.toBe(contentHash(html, ["Airlines cancelled some flights."]));
  });
});
