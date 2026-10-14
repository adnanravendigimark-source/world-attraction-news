import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/db", () => ({ sql: vi.fn(async () => []) }));
import { normalizeCluster, supportFor } from "@/lib/blogs/clusters";

const t = (role: string, need: string, title: string, kw: string, extra: any = {}) => ({ role, need, title, primary_keyword: kw, intent: "planning", priority: "medium", ...extra });

describe("topic cluster", () => {
  it("keeps one main guide first and one article per visitor need", () => {
    const out = normalizeCluster(
      {
        topics: [
          t("supporting", "booking", "How to Choose an Arno River Boat Tour in Florence", "choose arno boat tour"),
          t("pillar", "overview", "Arno River Boat Tour in Florence: A Visitor's Guide", "arno river boat tour"),
          t("supporting", "booking", "How to Book an Arno Boat Tour Online", "book arno boat tour"), // second booking: dropped
          t("supporting", "seasonality", "Are Arno River Boat Tours Available Year-Round?", "arno boat tour winter"),
          t("pillar", "overview", "The Complete Arno Boat Tour Guide", "arno boat tour guide"), // second pillar: dropped
        ],
      },
      "arno boat tour"
    );
    expect(out.map((o) => o.plan.role)).toEqual(["pillar", "supporting", "supporting"]);
    expect(out[0].plan.need).toBe("overview");
    expect(out[0].plan.priority).toBe("high");
    expect(out.map((o) => o.plan.need)).toEqual(["overview", "booking", "seasonality"]);
    expect(out.find((o) => o.plan.need === "seasonality")?.topicType).toBe("best_time");
  });

  it("drops an article chasing the same keyword as another", () => {
    const out = normalizeCluster(
      {
        topics: [
          t("pillar", "overview", "Arno River Boat Tour in Florence", "arno river boat tour"),
          t("supporting", "experience", "What You See on the Arno by Boat", "Arno River Boat Tour"),
        ],
      },
      "arno boat tour"
    );
    expect(out).toHaveLength(1);
  });

  it("never stores invented search volumes in the reason", () => {
    const out = normalizeCluster({ topics: [t("pillar", "overview", "Arno River Boat Tour Guide", "arno boat tour", { reason: "Gets 5,400 monthly searches and helps first-time visitors." })] }, "arno boat tour");
    expect(out[0].plan.reason).not.toMatch(/5,400|monthly searches/);
  });

  it("caps length and fills defaults", () => {
    const out = normalizeCluster({ topics: [t("pillar", "overview", "Arno River Boat Tour Guide", "", { words: 9000, intent: "nonsense" })] }, "arno boat tour");
    expect(out[0].words).toBe(2500);
    expect(out[0].plan.intent).toBe("informational");
    expect(out[0].plan.primaryKeyword).toBe("arno river boat tour guide");
  });
});

describe("do free sources support an idea?", () => {
  const text = [
    "The Arno flows through Florence and is crossed by the Ponte Vecchio.",
    "Arno boats leave from a landing near Ponte alle Grazie and the trip takes about 50 minutes.",
    "In summer the Arno can run low; boat trips may stop after heavy rain.",
    "Arno boat trips are calmer in spring and autumn, when the river is higher.",
    "Arno boats depart every hour from the landing by the Uffizi.",
    "The Medici family ruled Florence, and the Arno flooded the city in 1966.",
    "The city has many museums.",
  ].join("\n");
  it("finds passages for practical and seasonal needs", () => {
    expect(supportFor(text, "arno boat tour", "practical").support).toBe("found");
    expect(supportFor(text, "arno boat tour", "seasonality").support).toBe("found");
  });
  it("reports thin sources for a need nobody mentions", () => {
    expect(supportFor(text, "arno boat tour", "accessibility").support).toBe("thin");
  });
  it("a passage about the river alone doesn't count for a boat tour", () => {
    // "famil" appears, but only in a passage about the Arno without boats.
    expect(supportFor("The Medici family lived by the Arno.\nBoats are common in Venice.", "arno boat tour", "accessibility").support).toBe("thin");
  });
  it("a topic with no subject words is thin", () => {
    expect(supportFor(text, "boat tour", "practical").support).toBe("found"); // "boat" is the subject
    expect(supportFor(text, "tour", "practical").support).toBe("thin");
  });
});

import { seriesBrief } from "@/lib/blogs/writer";
describe("writer brief for a cluster article", () => {
  const plan = { role: "supporting", need: "seasonality", primaryKeyword: "arno boat tour winter", secondaryKeywords: ["are arno boat tours year round"], intent: "planning", audience: "winter visitors", priority: "medium", reason: "", support: "found", supportNote: "", links: [] } as any;
  it("gives the keyword, need and the other articles", () => {
    const b = seriesBrief({ plan }, [{ title: "Arno River Boat Tour in Florence", need: "overview", role: "pillar" }]);
    expect(b).toContain("PLANNED KEYWORD: arno boat tour winter");
    expect(b).toContain("NEED: seasonality");
    expect(b).toContain("- Arno River Boat Tour in Florence (main guide)");
  });
  it("is empty for a hand-added topic", () => {
    expect(seriesBrief({ plan: null }, [])).toBe("");
  });
});

describe("skipped needs", () => {
  it("drops a need the model marked as not useful", () => {
    const out = normalizeCluster(
      { topics: [
        { role: "pillar", need: "overview", title: "Arno River Boat Tour in Florence", primary_keyword: "arno river boat tour" },
        { role: "supporting", need: "accessibility", title: "Arno Boat Tours for Wheelchair Users", primary_keyword: "arno boat tour wheelchair", skip: true, skip_reason: "no information" },
        { role: "supporting", need: "practical", title: "Where Arno River Boat Tours Depart", primary_keyword: "arno boat tour departure point" },
      ] },
      "arno boat tour"
    );
    expect(out.map((o) => o.plan.need)).toEqual(["overview", "practical"]);
  });
});

import { clusterKey } from "@/lib/blogs/clusters";
describe("asking twice for one topic", () => {
  it("the cluster remembers its topic, so a new run replaces the old ideas", () => {
    const out = normalizeCluster({ topics: [{ role: "pillar", need: "overview", title: "Arno River Boat Tour Guide", primary_keyword: "arno boat tour" }] }, "Arno  Boat Tour");
    expect(out[0].plan.topic).toBe("arno boat tour");
    expect(clusterKey("  ARNO boat   tour ")).toBe(clusterKey("arno boat tour"));
  });
});
