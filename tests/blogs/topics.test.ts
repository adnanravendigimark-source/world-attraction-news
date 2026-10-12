import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/db", () => ({ sql: Object.assign(async () => [], {}) }));
import { findSimilar, defaultWords } from "@/lib/blogs/topics";

describe("blog topic duplicates", () => {
  const existing = ["Best Time to Visit Florence: Weather and Crowds", "Sagrada Família Construction Enters New Phase in 2026"];
  it("flags a close rephrase of an existing title", () => {
    expect(findSimilar("When to Visit Florence: Weather, Crowds and Prices", existing)).toBe(existing[0]);
  });
  it("does not flag a different topic for the same city", () => {
    expect(findSimilar("Florence Food Guide: What to Eat and Where", existing)).toBe("");
  });
  it("sets a sensible default length per type", () => {
    expect(defaultWords("travel_guide")).toBe(1800);
    expect(defaultWords("best_time")).toBe(1000);
  });
});

describe("same intent, different words", () => {
  it("treats 'when to visit' and 'best time to visit' as the same topic", () => {
    expect(findSimilar("When to Visit Barcelona: Weather and Prices", ["Best Time to Visit Barcelona"])).toBe("Best Time to Visit Barcelona");
    expect(findSimilar("Where to Eat in Rome", ["Rome Food Guide"])).toBe("Rome Food Guide");
  });
});

describe("different intents for one place are not duplicates", () => {
  it("keeps core guides apart", () => {
    const existing = ["Bali Travel Guide"];
    for (const x of ["Things to Do in Bali", "Best Time to Visit Bali", "Food in Bali: What to Eat and Where", "Bali Itinerary: How to Spend 3 Days"])
      expect(findSimilar(x, existing)).toBe("");
    expect(findSimilar("When to Visit Bali", ["Best Time to Visit Bali"])).toBe("Best Time to Visit Bali");
  });
});
