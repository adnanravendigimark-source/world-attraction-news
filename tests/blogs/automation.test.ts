import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/db", () => ({ sql: Object.assign(async () => [], {}) }));
import { compareVolatile, coreGuideTitles } from "@/lib/blogs/automation";

const f = (claim: string, volatile = true) => ({ subtopic: "tickets", claim, sources: [1], volatile });

describe("refresh check", () => {
  it("flags a price that changed and a fact no source confirms any more", () => {
    const flags = compareVolatile(
      [f("Uffizi Gallery tickets cost 25 euros in high season."), f("The Accademia Gallery opens at 8:15 on weekdays."), f("Florence has mild winters.", false)],
      [f("Uffizi Gallery tickets cost 29 euros in high season."), f("The Duomo is free to enter.")]
    );
    expect(flags).toEqual([
      { fact: "Uffizi Gallery tickets cost 25 euros in high season.", status: "changed", now: "Uffizi Gallery tickets cost 29 euros in high season." },
      { fact: "The Accademia Gallery opens at 8:15 on weekdays.", status: "not_confirmed" },
    ]);
  });
  it("leaves unchanged facts alone", () => {
    expect(compareVolatile([f("Metro tickets cost 2.20 euros.")], [f("A single metro ticket costs 2.20 euros.")])).toEqual([]);
  });
});

describe("core guides", () => {
  it("plans the five standard guides for a destination", () => {
    expect(coreGuideTitles("Florence").map((g) => g.type)).toEqual(["travel_guide", "things_to_do", "best_time", "food", "itinerary"]);
  });
});

import { findSimilar as fs2 } from "@/lib/blogs/topics";
describe("core guides are not duplicates of each other", () => {
  it("different intents for one place are kept apart", () => {
    const existing = ["Bali Travel Guide"];
    for (const t of ["Things to Do in Bali", "Best Time to Visit Bali", "Food in Bali: What to Eat and Where", "Bali Itinerary: How to Spend 3 Days"])
      expect(fs2(t, existing)).toBe("");
    expect(fs2("Bali Travel Guide", existing)).toBe("Bali Travel Guide");
    expect(fs2("When to Visit Bali", ["Best Time to Visit Bali"])).toBe("Best Time to Visit Bali");
  });
});

import { compareVolatile as cv2 } from "@/lib/blogs/automation";
describe("refresh labels", () => {
  it("a price matched to a sentence without figures is not confirmed, not changed", () => {
    const old = [{ claim: "Train prices from Paris to Barcelona start at €39.", volatile: true }] as any;
    const now = [{ claim: "Direct high-speed train services connect Barcelona to Paris, Lyon, and Marseille.", volatile: true }] as any;
    expect(cv2(old, now)[0].status).toBe("not_confirmed");
  });
});
