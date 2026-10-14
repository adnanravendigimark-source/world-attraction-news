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

import { suggestRequest } from "@/lib/blogs/topics";
describe("suggest with AI", () => {
  it("a typed topic asks for ideas about that topic", () => {
    const r = suggestRequest("arno boat tour", "");
    expect(r.user).toContain("TOPIC: arno boat tour");
    expect(r.system).toContain("about that topic");
    expect(r.needsPlace).toBe(true);
  });
  it("topic with a destination uses the destination given", () => {
    const r = suggestRequest("arno boat tour", "Florence");
    expect(r.needsPlace).toBe(false);
    expect(r.user).toContain("DESTINATION: Florence");
  });
  it("destination only works as before", () => {
    const r = suggestRequest("", "Bali");
    expect(r.system).not.toContain("TOPIC");
    expect(r.user).toBe("DESTINATION: Bali");
  });
  it("trims very long input", () => {
    expect(suggestRequest("x".repeat(500), "").user.length).toBeLessThan(260);
  });
});

import { siblingDuplicate } from "@/lib/blogs/topics";
describe("ideas from one topic", () => {
  const batch = ["Romantic Arno Boat Tours: Perfect for Couples", "Best Time for an Arno Boat Tour: Weather and Experience"];
  it("sharing the topic's words is not a duplicate", () => {
    expect(siblingDuplicate("Tips for Your Arno Boat Tour", batch, "arno boat tour")).toBe("");
    expect(siblingDuplicate("What to See on an Arno Boat Tour", batch, "arno boat tour")).toBe("");
  });
  it("the same angle twice still is", () => {
    expect(siblingDuplicate("Arno Boat Tours for Couples: Romantic Evenings", batch, "arno boat tour")).toBe(batch[0]);
  });
});
