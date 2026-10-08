import { describe, expect, it } from "vitest";
import { DEFAULT_TREND_CONFIG, freshnessScore, scoreCluster, sourceCountScore } from "@/lib/news/trend";

const base = {
  newestAt: new Date("2026-10-08T10:00:00Z"),
  sourceCount: 4,
  category: "Travel Rules",
  maxRelevance: 90,
  maxReliability: 80,
  avgReliability: 70,
  matchesCoverage: true,
  duplicatesPublished: false,
};
const now = Date.parse("2026-10-08T11:00:00Z");

describe("trend score", () => {
  it("uses freshness bands", () => {
    expect(freshnessScore(1, DEFAULT_TREND_CONFIG)).toBe(100);
    expect(freshnessScore(30, DEFAULT_TREND_CONFIG)).toBe(25);
    expect(freshnessScore(500, DEFAULT_TREND_CONFIG)).toBe(DEFAULT_TREND_CONFIG.staleScore);
  });

  it("caps the source curve", () => {
    expect(sourceCountScore(1, DEFAULT_TREND_CONFIG)).toBe(20);
    expect(sourceCountScore(12, DEFAULT_TREND_CONFIG)).toBe(100);
  });

  it("ranks a fresh multi-source travel-rule story high", () => {
    const b = scoreCluster(base, DEFAULT_TREND_CONFIG, now);
    expect(b.tier).toBe("high");
  });

  it("never recommends a story already published", () => {
    const b = scoreCluster({ ...base, duplicatesPublished: true }, DEFAULT_TREND_CONFIG, now);
    expect(b.total).toBeLessThan(DEFAULT_TREND_CONFIG.thresholds.review);
  });

  it("scales down loosely travel-related stories", () => {
    const strong = scoreCluster(base, DEFAULT_TREND_CONFIG, now).total;
    const weak = scoreCluster({ ...base, maxRelevance: 30 }, DEFAULT_TREND_CONFIG, now).total;
    expect(weak).toBeLessThan(strong / 2);
  });
});
