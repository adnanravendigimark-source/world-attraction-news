import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { prepareTitle, sameStoryPrepared, leadName } from "@/lib/news/similarity";
import { scoreRelevance, DEFAULT_FILTER_CONFIG, normalizeFilterConfig } from "@/lib/news/filter";

const set = JSON.parse(readFileSync(path.join(__dirname, "fixtures/headlines.json"), "utf8")) as {
  items: { title: string; description?: string; event: string }[];
};

// Groups the set the way clustering does (a headline joins a story when it
// matches any member), then compares with the labels pair by pair: a false
// merge puts two different events in one story, a missed merge leaves two
// reports of one event in separate stories.
function measure() {
  const p = set.items.map((i) => prepareTitle(i.title, i.description || ""));
  const parent = set.items.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < set.items.length; i++) for (let j = i + 1; j < set.items.length; j++) if (sameStoryPrepared(p[i], p[j])) parent[find(j)] = find(i);
  const falseMerges: string[] = [];
  const missed: string[] = [];
  for (let i = 0; i < set.items.length; i++) {
    for (let j = i + 1; j < set.items.length; j++) {
      const same = find(i) === find(j);
      const truth = set.items[i].event === set.items[j].event;
      if (same && !truth) falseMerges.push(`${set.items[i].title} <> ${set.items[j].title}`);
      if (!same && truth) missed.push(`${set.items[i].title} <> ${set.items[j].title}`);
    }
  }
  return { falseMerges, missed };
}

describe("labelled headline set", () => {
  it("has enough headlines to mean something", () => {
    expect(set.items.length).toBeGreaterThanOrEqual(150);
  });

  it("makes no false merges", () => {
    expect(measure().falseMerges).toEqual([]);
  });

  it("misses no more pairs than the known baseline", () => {
    // Known misses: the YouGov tourist-tax poll reported as "Do Britons
    // support a tourist tax?" and "Edinburgh and Cornwall support a tourist
    // tax". Lower this number when the matcher improves; never raise it.
    expect(measure().missed.length).toBeLessThanOrEqual(1);
  });
});

describe("matcher edge cases", () => {
  const same = (a: string, b: string, da = "", db = "") => sameStoryPrepared(prepareTitle(a, da), prepareTitle(b, db));

  it("tells one-word advisory headlines apart by their teasers", () => {
    expect(same("Chile", "Chile", "Heavy rain and severe mudslides in eastern Santiago", "New entry requirements for visitors arriving from Peru")).toBe(false);
    expect(same("Chile", "Chile")).toBe(false);
  });

  it("keeps different companies' news apart", () => {
    expect(same("Air Canada Cancels All Flights To 6 International Destinations", "WestJet Cancels All Flights To 13 International Destinations")).toBe(false);
    expect(same("American Airlines cuts 6 routes, adds 2 in New York airport swap", "Porter Airlines launches five new Canadian routes from London airport")).toBe(false);
  });

  it("does not merge opposite actions at the same place", () => {
    expect(same("PAL cancels Riyadh flights after Saudi airport attacks", "Saudi airline Flyadeal launches Mumbai-Riyadh flights")).toBe(false);
  });

  it("joins reports of one event that name the same place", () => {
    expect(same("Airlines Suspend Flights To Riyadh After Terrorist Attack", "Air India cancels Riyadh flights after attack on airport")).toBe(true);
    expect(same("PAL cancels Oct. 8 Manila-Riyadh flights amid regional tensions", "PAL cancels Riyadh flights after Saudi airport attacks")).toBe(true);
  });

  it("reads the name a headline leads with", () => {
    expect(leadName("Air Canada cancels flights")).toBe("canada");
    expect(leadName("American Airlines cuts routes")).toBe("american");
    expect(leadName("The best time to cruise Alaska")).toBe("");
  });
});

describe("travel filter", () => {
  const score = (title: string, opts: Partial<Parameters<typeof scoreRelevance>[0]> = {}) => scoreRelevance({ title, ...opts }, DEFAULT_FILTER_CONFIG);

  it("counts official items that name a travel term as travel news", () => {
    const opts = { sourceIsOfficial: true, sourceCategory: "Aviation" };
    expect(score("Another First for United: Mobile App Lets Customers Join Standby for Earlier Flights", opts).status).toBe("relevant");
    expect(score("Another First for United: Mobile App Lets Customers Join Standby for Earlier Flights").status).not.toBe("relevant");
    expect(score("Amtrak Expands Pennsylvanian Service with Second Daily Round Trip", { sourceIsOfficial: true, sourceCategory: "Travel Industry" }).status).toBe("relevant");
  });

  it("treats every entry of an official travel-advice feed as travel news", () => {
    const r = score("Chile", { description: "Information on heavy rain and severe mudslides in eastern Santiago", sourceIsOfficial: true, sourceCategory: "Travel Rules" });
    expect(r.status).toBe("relevant");
    expect(r.reason).toMatch(/official source/);
    expect(score("Level 2 - Yellow Fever in Colombia", { sourceIsOfficial: true, sourceCategory: "Travel Rules" }).status).toBe("relevant");
  });

  it("lifts official items without letting every brand mention through", () => {
    const opts = { sourceIsOfficial: true, sourceCategory: "Travel Industry" };
    expect(score("Amtrak Awards First Round of Community Grants, Investing More Than $4.1 Million", opts).status).not.toBe("relevant");
    expect(score("Cooking with Chris: Recreating a Culinary Icon", { ...opts, description: "A recipe from the hotel's kitchen at Waldorf Astoria hotels" }).status).not.toBe("relevant");
    expect(score("Tempo by Hilton Lifestyle Brand to Debut in Germany with Hotel at Munich Arena", { ...opts, description: "Near the airport" }).status).toBe("relevant");
  });

  it("still drops corporate news from official sources", () => {
    expect(score("United to Hold Webcast of Third-Quarter 2026 Financial Results", { sourceIsOfficial: true, sourceCategory: "Aviation" }).status).toBe("irrelevant");
    expect(score("Lead one of Ireland's most significant organisations", { sourceIsOfficial: true, sourceCategory: "Aviation" }).status).toBe("irrelevant");
  });

  it("recognises advisory and rail vocabulary from any source", () => {
    expect(score("FCDO advises against all but essential travel to Aseer province").status).toBe("relevant");
    expect(score("New sleeper train links Paris and Berlin with a daily round trip").status).toBe("relevant");
  });
});

describe("filter settings", () => {
  it("accepts the defaults", () => {
    expect(normalizeFilterConfig(DEFAULT_FILTER_CONFIG).error).toBeUndefined();
  });
  it("rejects bad thresholds and weights", () => {
    expect(normalizeFilterConfig({ ...DEFAULT_FILTER_CONFIG, borderlineMin: 70, relevantMin: 60 }).error).toMatch(/below/);
    expect(normalizeFilterConfig({ ...DEFAULT_FILTER_CONFIG, negatives: [{ term: "x", weight: 500 }] }).error).toMatch(/1–100/);
  });
  it("cleans terms: lower-case, trimmed, de-duplicated, empty dropped", () => {
    const r = normalizeFilterConfig({ ...DEFAULT_FILTER_CONFIG, categories: { Aviation: [{ term: " Airline ", weight: 20 }, { term: "airline", weight: 5 }, { term: "", weight: 3 }] } });
    expect(r.config?.categories).toEqual({ Aviation: [{ term: "airline", weight: 20 }] });
  });
});

describe("automatic merge respects editor splits", () => {
  it("never merges stories an editor split apart", async () => {
    const { planMerges } = await import("@/lib/news/cluster");
    const base = { hasArticle: false, itemCount: 1, firstSeen: 0 };
    const a = { ...base, id: "a", titles: ["Belgrade increases visitor fee – Tourist tax set at 240 dinars per day starting October 15"] };
    const b = { ...base, id: "b", titles: ["Belgrade introduces new tourist tax: From October 15th, stays will be more expensive"] };
    expect(planMerges([a, b])).toHaveLength(1);
    expect(planMerges([{ ...a, keptApart: ["b"] }, b])).toEqual([]);
    expect(planMerges([a, { ...b, keptApart: ["a"] }])).toEqual([]);
  });
});
