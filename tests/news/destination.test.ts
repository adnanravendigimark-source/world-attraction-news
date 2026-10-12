import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/db", () => ({ sql: Object.assign(async () => [], {}) }));
import { buildGazetteer } from "@/lib/news/places";
import { pickCity } from "@/lib/news/destination";

const g = buildGazetteer([]);
describe("article destination", () => {
  it("uses the city in the headline", () => {
    const c = pickCity(g, { title: "Missile Strikes Disrupt Flights at Riyadh's King Khalid Airport", excerpt: "", body: "<p>Etihad cancelled Abu Dhabi flights. Kuwait Airways too.</p>" });
    expect(c?.name).toBe("Riyadh");
  });
  it("falls back to the summary, then the body's main city", () => {
    expect(pickCity(g, { title: "Airline cuts winter routes", excerpt: "Flights to Bali are reduced.", body: "" })?.name).toBe("Bali");
    expect(pickCity(g, { title: "New rules", excerpt: "", body: "<p>Venice fee. Venice limits. Rome too.</p>" })?.name).toBe("Venice");
  });
  it("gives none for a round-up or a country-only story", () => {
    expect(pickCity(g, { title: "Europe strikes", excerpt: "", body: "<p>Paris and Rome and Madrid.</p>" })).toBeNull();
    expect(pickCity(g, { title: "Italy changes visa rules", excerpt: "", body: "" })).toBeNull();
  });
});
