import { describe, it, expect } from "vitest";
import { buildGazetteer, findPlaces, resolvePlace } from "@/lib/news/places";
import { placeSearchUrl } from "@/lib/news/placeSearch";

const g = buildGazetteer([{ name: "Sagrada Familia Town", country: "Spain" }]);

describe("place tagging", () => {
  it("tags a city and its country", () => {
    expect(findPlaces("Barcelona caps cruise passengers at the port", g)).toEqual(["barcelona", "spain"]);
    expect(findPlaces("New tourist levy for Bali visitors", g)).toEqual(["bali", "indonesia"]);
    expect(findPlaces("Delhi airport adds flights", g)).toEqual(["india", "new delhi"]);
    expect(findPlaces("Venice day-tripper fee returns", g)).toEqual(["italy", "venice"]);
  });
  it("ignores ordinary words and lower case", () => {
    expect(findPlaces("A turkey dinner and a nice view in reading room", g)).toEqual([]);
    expect(findPlaces("Turkey eases visas", g)).toEqual(["turkey"]);
  });
  it("knows destinations added on the site", () => {
    expect(findPlaces("Crowds at Sagrada Familia Town", g)).toContain("sagrada familia town");
  });
  it("resolves what an editor types", () => {
    expect(resolvePlace("barcelona", g)).toMatchObject({ key: "barcelona", known: true });
    expect(resolvePlace("Delhi", g)).toMatchObject({ key: "new delhi", known: true });
    expect(resolvePlace("Türkiye", g)).toMatchObject({ key: "turkey" });
    expect(resolvePlace("Kodaikanal", g)).toMatchObject({ key: "kodaikanal", known: false });
  });
  it("builds a fresh-only Google News search", () => {
    const u = decodeURIComponent(placeSearchUrl(["New Delhi", "Delhi"]));
    expect(u).toContain('("New Delhi" OR "Delhi")');
    expect(u).toContain("when:1d");
  });
});
