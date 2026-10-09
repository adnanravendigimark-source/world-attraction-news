import { describe, expect, it } from "vitest";
import { summarizeDecisions, type DecisionRow } from "@/lib/news/decisions";
import { DEFAULT_TREND_CONFIG, scoreCluster, validateTrendPatch, type ClusterFacts } from "@/lib/news/trend";
import { scoreRelevance } from "@/lib/news/filter";

const at = (h: number) => new Date(Date.UTC(2026, 9, 9, h)).toISOString();
const row = (clusterId: string, decision: DecisionRow["decision"], score: number | null, rank: number | null, h = 0): DecisionRow => ({ clusterId, decision, score, rank, decidedAt: at(h) });

describe("calibration summary", () => {
  it("counts each story once, as a pick if it was ever picked", () => {
    const c = summarizeDecisions(
      [row("a", "ignored", 40, 30, 1), row("a", "shortlisted", 55, 9, 2), row("a", "published", 58, 4, 5), row("b", "ignored", 35, 40), row("c", "auto_drafted", 70, 1)],
      14
    );
    expect(c.picks).toBe(1);
    expect(c.ignored).toBe(1);
    expect(c.autoDrafted).toBe(1);
    expect(c.picksInTop).toBe(1); // scored at the first pick: rank 9
    expect(c.pickScore?.median).toBe(55);
  });

  it("waits for enough picks before suggesting thresholds", () => {
    const c = summarizeDecisions([row("a", "shortlisted", 60, 2)], 14);
    expect(c.suggested).toBeNull();
    expect(c.note).toMatch(/1 of 10/);
  });

  it("suggests thresholds from the picks' scores", () => {
    const scores = [42, 45, 48, 50, 52, 55, 58, 60, 63, 70];
    const c = summarizeDecisions(scores.map((s, i) => row(`s${i}`, "drafted", s, i < 7 ? i + 1 : 20)), 14);
    expect(c.topShare).toBeCloseTo(0.7);
    expect(c.suggested).toEqual({ high: 55, review: 48 });
  });
});

describe("trend settings validation", () => {
  it("accepts the defaults", () => {
    expect(validateTrendPatch({ freshnessBands: DEFAULT_TREND_CONFIG.freshnessBands, staleScore: DEFAULT_TREND_CONFIG.staleScore, sourceCurve: DEFAULT_TREND_CONFIG.sourceCurve })).toBeNull();
  });
  it("rejects bands that don't age properly", () => {
    expect(validateTrendPatch({ freshnessBands: [[6, 80], [2, 100]] })).toMatch(/increase/);
    expect(validateTrendPatch({ freshnessBands: [[2, 50], [6, 80]] })).toMatch(/must not rise/);
    expect(validateTrendPatch({ freshnessBands: [[2, 50]], staleScore: 60 })).toMatch(/older stories/);
  });
  it("rejects a source curve that falls or has the wrong length", () => {
    expect(validateTrendPatch({ sourceCurve: [20, 50, 75, 90] })).toMatch(/5 values/);
    expect(validateTrendPatch({ sourceCurve: [20, 50, 40, 90, 100] })).toMatch(/must not fall/);
  });
});

describe("ranking (phase 6 weights)", () => {
  const now = Date.UTC(2026, 9, 9, 12);
  const facts = (f: Partial<ClusterFacts>): ClusterFacts => ({
    newestAt: new Date(now - 3600_000),
    sourceCount: 1,
    category: "Aviation",
    maxRelevance: 70,
    maxReliability: 60,
    avgReliability: 60,
    matchesCoverage: false,
    duplicatesPublished: false,
    ...f,
  });

  it("puts a story eight outlets cover above a brand's own fresh post", () => {
    const big = scoreCluster(facts({ newestAt: new Date(now - 20 * 3600_000), sourceCount: 8, maxRelevance: 65, maxReliability: 80, avgReliability: 55 }), DEFAULT_TREND_CONFIG, now);
    // Official CSR post: travel score 66 after the official bonus, 41 before it.
    const brand = scoreCluster(facts({ sourceCount: 1, category: "Cruises", maxRelevance: 41, maxReliability: 85, avgReliability: 85, official: true }), DEFAULT_TREND_CONFIG, now);
    expect(big.total).toBeGreaterThan(brand.total);
  });

  it("keeps the score before the official bonus for travel impact", () => {
    const r = scoreRelevance(
      { title: "Carnival Cruise Line Helps Keep Thousands of Shoes on Feet and Out of Landfills", sourceIsOfficial: true, sourceCategory: "Cruises" },
    );
    expect(r.score - r.base).toBe(25);
    const advisory = scoreRelevance({ title: "Chile", sourceIsOfficial: true, sourceCategory: "Travel Rules" });
    expect(advisory.base).toBe(advisory.score);
  });
});
