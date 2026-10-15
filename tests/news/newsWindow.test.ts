import { describe, it, expect } from "vitest";
import { clampCollectDays, validateTrendPatch, DEFAULT_TREND_CONFIG } from "@/lib/news/trend";
import { keepHours } from "@/lib/news/collector";

describe("news window (how far back news is collected and listed)", () => {
  it("defaults to 3 days and only accepts the offered choices", () => {
    expect(DEFAULT_TREND_CONFIG.collectDays).toBe(3);
    expect(clampCollectDays(7)).toBe(7);
    expect(clampCollectDays("2")).toBe(2);
    expect(clampCollectDays(5)).toBe(3);
    expect(clampCollectDays(undefined)).toBe(3);
  });
  it("rejects other values from the settings form", () => {
    expect(validateTrendPatch({ collectDays: 14 })).toBeNull();
    expect(validateTrendPatch({ collectDays: 30 })).toMatch(/1, 2, 3, 7, 14/);
  });
  it("keeps items a day past the window (never less than 48 hours) before cleaning up", () => {
    expect(keepHours(1)).toBe(48);
    expect(keepHours(3)).toBe(96);
    expect(keepHours(14)).toBe(360);
  });
});
