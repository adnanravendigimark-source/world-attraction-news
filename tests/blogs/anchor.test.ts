import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/db", () => ({ sql: Object.assign(async () => [], {}) }));
import { canonicalCountry, correctedDestination, distanceKm, parseEntity } from "@/lib/blogs/anchor";
import { commonsPhotos, provenPlace, unsplashPlace } from "@/lib/news/media";
import { dropStaleVolatile, isTimeSensitive, sourceHeader } from "@/lib/blogs/research";
import { proofRadiusKm } from "@/lib/blogs/images";

// Trimmed from Wikidata Q48435 (Sagrada Família), 2026-11-11.
const SAGRADA = {
  id: "Q48435",
  labels: { en: { value: "Sagrada Família" } },
  claims: {
    P17: [{ rank: "normal", mainsnak: { datavalue: { value: { id: "Q29" } } } }],
    P131: [{ rank: "normal", mainsnak: { datavalue: { value: { id: "Q2470217" } } } }],
    P625: [{ rank: "normal", mainsnak: { datavalue: { value: { latitude: 41.40369, longitude: 2.17433 } } } }],
    P18: [{ rank: "normal", mainsnak: { datavalue: { value: "SF maig 2026.jpg" } } }],
    P373: [{ rank: "normal", mainsnak: { datavalue: { value: "Sagrada Família" } } }],
    P856: [
      { rank: "deprecated", mainsnak: { datavalue: { value: "http://old.example" } } },
      { rank: "normal", mainsnak: { datavalue: { value: "https://sagradafamilia.org/" } } },
    ],
  },
};
const BARCELONA = { lat: 41.3874, lon: 2.1686 };

describe("Wikidata anchor", () => {
  it("reads place, photo and official site from the entity", () => {
    const a = parseEntity(SAGRADA);
    expect(a.label).toBe("Sagrada Família");
    expect(a.lat).toBeCloseTo(41.4, 1);
    expect(a.image).toBe("SF maig 2026.jpg");
    expect(a.commonsCategory).toBe("Sagrada Família");
    expect(a.officialSite).toBe("https://sagradafamilia.org/"); // deprecated value skipped
    expect(a.countryId).toBe("Q29");
    expect(a.locatedIn).toBe("Q2470217");
  });
  it("compares country names by their canonical form", () => {
    expect(canonicalCountry("United States of America")).toBe(canonicalCountry("USA"));
    expect(canonicalCountry("Czechia")).toBe(canonicalCountry("Czech Republic"));
    expect(canonicalCountry("Spain")).not.toBe(canonicalCountry("United States"));
  });
  it("moves a topic filed under the wrong country to the subject's city", () => {
    const anchor = { country: "Spain", places: ["Sagrada Família", "Eixample", "Barcelona", "Barcelonès", "Catalonia"] };
    const isCity = (n: string, c: string) => n === "Barcelona" && c === "Spain";
    expect(correctedDestination(anchor, "United States", isCity)).toEqual({ city: "Barcelona", country: "Spain" });
    expect(correctedDestination(anchor, "Spain", isCity)).toBeNull();
    expect(correctedDestination({ country: "Spain", places: ["Nowhere"] }, "Italy", () => false)).toEqual({ city: "", country: "Spain" });
  });
  it("measures distance", () => {
    expect(distanceKm(BARCELONA, { lat: 41.40369, lon: 2.17433 })).toBeLessThan(3);
    expect(distanceKm(BARCELONA, { lat: 34.21, lon: -106.92 })).toBeGreaterThan(8000);
  });
});

describe("proven photos", () => {
  const near = { ...BARCELONA, km: 30 };
  it("rejects a namesake photographed far away (Sagrada Familia church, Lemitar, New Mexico)", () => {
    expect(provenPlace({ provider: "wikimedia", lat: 34.16, lon: -106.91 }, { place: "Barcelona", near })).toBe(false);
  });
  it("rejects a photo with no position and no location", () => {
    expect(provenPlace({ provider: "wikimedia" }, { place: "Barcelona", near })).toBe(false);
    expect(provenPlace({ provider: "unsplash", location: "Seattle, United States" }, { place: "Barcelona", near })).toBe(false);
  });
  it("accepts photos taken at the place, in its category or located there", () => {
    expect(provenPlace({ provider: "wikimedia", lat: 41.4, lon: 2.17 }, { place: "Barcelona", near })).toBe(true);
    expect(provenPlace({ provider: "wikimedia", proof: "Commons category" }, { place: "Barcelona", near })).toBe(true);
    expect(provenPlace({ provider: "unsplash", location: "Park Güell, Barcelona, Spain" }, { place: "Barcelona", near })).toBe(true);
  });
  it("keeps old behaviour when no anchor is known", () => {
    expect(provenPlace({ provider: "wikimedia" }, { place: "Barcelona" })).toBe(true);
  });
  it("reads where an Unsplash photo was taken", () => {
    expect(unsplashPlace({ location: { name: "Sagrada Familia", city: "Barcelona", country: "Spain", position: { latitude: 41.4, longitude: 2.17 } } })).toEqual({
      location: "Sagrada Familia, Barcelona, Spain",
      lat: 41.4,
      lon: 2.17,
    });
    expect(unsplashPlace({ location: { position: { latitude: 0, longitude: 0 } } })).toEqual({});
  });
  it("keeps Commons camera positions", () => {
    const [p] = commonsPhotos(
      [{ title: "File:Sagrada.jpg", coordinates: [{ lat: 41.4, lon: 2.17 }], imageinfo: [{ mime: "image/jpeg", width: 2000, height: 1300, url: "https://upload.wikimedia.org/x.jpg", extmetadata: { LicenseShortName: { value: "CC BY-SA 4.0" } } }] }],
      "Sagrada"
    );
    expect(p.lat).toBe(41.4);
    expect(p.height).toBe(1300);
  });
  it("uses a wide radius only for whole countries", () => {
    expect(proofRadiusKm("subject")).toBeLessThan(proofRadiusKm("city"));
    expect(proofRadiusKm("city")).toBeLessThan(proofRadiusKm("country"));
  });
});

describe("fresh sources", () => {
  it("knows which topics need recent news", () => {
    expect(isTimeSensitive("Sagrada Familia 2027: What's New")).toBe(true);
    expect(isTimeSensitive("Biggest New Theme Park Attractions")).toBe(true);
    expect(isTimeSensitive("History of Florence")).toBe(false);
    expect(isTimeSensitive("Uffizi Gallery", "tickets")).toBe(true);
  });
  it("dates news sources and flags encyclopedias", () => {
    expect(sourceHeader(3, "elpais.com", "Tower finished", { kind: "news", date: "2026-10-02" })).toContain("published 2026-10-02");
    expect(sourceHeader(1, "Wikipedia", "Sagrada Família", { kind: "encyclopedia" })).toContain("may be years old");
  });
  it("leaves out prices read only from an encyclopedia", () => {
    const facts = [
      { subtopic: "tickets", claim: "Tickets cost €15–20.", sources: [1], volatile: true },
      { subtopic: "tickets", claim: "General admission costs €26 as of 2026.", sources: [1, 4], volatile: true },
      { subtopic: "tickets", claim: "Tickets must be booked online.", sources: [1], volatile: true },
      { subtopic: "history", claim: "Construction began in 1882.", sources: [1], volatile: false },
    ];
    const sources = [
      { n: 1, kind: "encyclopedia" as const, publisher: "Wikipedia" },
      { n: 4, kind: "official" as const, publisher: "sagradafamilia.org" },
    ];
    expect(dropStaleVolatile(facts, sources).map((f) => f.claim)).toEqual([
      "General admission costs €26 as of 2026.",
      "Tickets must be booked online.",
      "Construction began in 1882.",
    ]);
  });
});
