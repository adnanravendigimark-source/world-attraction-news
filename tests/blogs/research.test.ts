import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/db", () => ({ sql: Object.assign(async () => [], {}) }));
import { pickPassages, normalizeBlogFacts } from "@/lib/blogs/research";

const para = (s: string) => s + " ".repeat(0) + " filler text to pass the minimum paragraph length for this test case.";

describe("blog research passages", () => {
  it("keeps the opening paragraphs and the ones about the topic", () => {
    const text = [para("Florence is the capital of Tuscany."), para("It has 360,000 people."), para("It sits on the Arno."),
      para("The football club plays in Serie A."), para("Summer weather is hot, July averages 31 C, crowds peak in August.")].join("\n");
    const out = pickPassages(text, ["weather", "summer", "crowd"], 2000);
    expect(out).toContain("capital of Tuscany");
    expect(out).toContain("July averages");
    expect(out).not.toContain("football");
  });
});

describe("blog facts", () => {
  it("drops uncited facts and keeps volatile flags", () => {
    const f = normalizeBlogFacts({ facts: [
      { subtopic: "tickets", claim: "Uffizi tickets cost 25 euros in high season.", sources: [1], volatile: true },
      { subtopic: "places", claim: "The Ponte Vecchio crosses the Arno river.", sources: [9] },
      { subtopic: "weird", claim: "Florence has a mild winter climate overall.", sources: [2] },
    ] }, [1, 2]);
    expect(f.map((x) => x.subtopic)).toEqual(["tickets", "other"]);
    expect(f[0].volatile).toBe(true);
  });
});

import { isOffTopicTitle, topicQueries } from "@/lib/blogs/research";
describe("research source choice", () => {
  it("skips pages that only share the name", () => {
    expect(isOffTopicTitle("FC Barcelona")).toBe(true);
    expect(isOffTopicTitle("Vicky Cristina Barcelona (film)")).toBe(true);
    expect(isOffTopicTitle("Climate of Barcelona")).toBe(false);
  });
  it("searches for the right background page per type", () => {
    expect(topicQueries("best_time", "Barcelona", "x")[0]).toBe("Climate of Barcelona");
    expect(topicQueries("history", "Florence", "x")[0]).toBe("History of Florence");
  });
  it("never marks weather as check-before-visiting", () => {
    const f = normalizeBlogFacts({ facts: [{ subtopic: "seasons", claim: "August is the hottest month in Barcelona.", sources: [1], volatile: true }] }, [1]);
    expect(f[0].volatile).toBe(false);
  });
});

describe("list pages", () => {
  it("skips Wikipedia list pages", () => {
    expect(isOffTopicTitle("List of Historic Civil Engineering Landmarks")).toBe(true);
    expect(isOffTopicTitle("Tourism in Italy")).toBe(false);
  });
});

import { factsAboutSubject, topicSubject } from "@/lib/blogs/research";
describe("the topic's own subject", () => {
  it("is found in the headline without the destination or filler", () => {
    expect(topicSubject("Is Siam Park Worth Visiting? What to Expect", "Tenerife, Spain")).toBe("Siam Park");
    expect(topicSubject("How to Fit Siam Park into Your Tenerife Itinerary", "Tenerife, Spain")).toBe("Siam Park");
    expect(topicSubject("Best Time to Visit Bali: A Seasonal Guide", "Bali, Indonesia")).toBe("");
  });
  it("counts facts about the subject, not the destination", () => {
    const facts = [
      { claim: "Siam Park is a water park in Tenerife." },
      { claim: "Siam Park opened in 2008." },
      { claim: "Tenerife is the largest of the Canary Islands." },
      { claim: "The Carnival of Santa Cruz is one of the largest in the world." },
    ];
    expect(factsAboutSubject(facts, "Siam Park")).toBe(2);
    expect(factsAboutSubject(facts, "")).toBe(4); // a destination topic: every fact counts
  });
});
