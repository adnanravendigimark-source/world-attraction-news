import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/db", () => ({ sql: vi.fn(async () => []) }));
import { scorePhoto } from "@/lib/news/media";

const photo = (title: string, query: string, description = "", width = 2000) => ({ title, description, query, width });

describe("photos that were wrongly used on the site are now rejected", () => {
  it("Berlin Cathedral for an Italy guide", () => {
    expect(scorePhoto(photo("Berlin Cathedral, Berliner Dom + Boat Tour, Schiffstour", "Italy must-see attractions"), { place: "Italy" })).toBeNull();
  });
  it("a painting for 'best time to visit Barcelona'", () => {
    expect(scorePhoto(photo("The Seasonal Stream at Argentona.jpg", "Barcelona seasonal", "Oil on canvas painting by Ramon Martí Alsina"), { place: "Barcelona" })).toBeNull();
  });
  it("a butterfly close-up for Bali", () => {
    expect(scorePhoto(photo("Indonésia Bali Island Catopsilia Pomona butterfly", "Bali skyline"), { place: "Bali" })).toBeNull();
  });
  it("a generic dock for a cruise itinerary story", () => {
    expect(scorePhoto(photo("white and brown wooden dock on lake under cloudy sky during daytime", "Nicko Cruises world cruise ship"), { place: "" })).toBeNull();
  });
  it("a map or a logo", () => {
    expect(scorePhoto(photo("Map of Florence 1850", "Florence skyline"), { place: "Florence" })).toBeNull();
    expect(scorePhoto(photo("Emirates logo", "Emirates Airbus A380"), { place: "Dubai" })).toBeNull();
  });
});

describe("relevant photos are accepted", () => {
  it("the place and the subject", () => {
    expect(scorePhoto(photo("Ponte Vecchio and the Arno river, Florence", "Arno river Florence boat"), { place: "Florence" })).not.toBeNull();
  });
  it("a named subject in full without the city name", () => {
    expect(scorePhoto(photo("King Khalid International Airport terminal 2", "King Khalid International Airport"), { place: "Riyadh" })).not.toBeNull();
  });
  it("accents don't matter", () => {
    expect(scorePhoto(photo("Sagrada Família, Barcelona", "Sagrada Familia Barcelona"), { place: "Barcelona" })).not.toBeNull();
  });
  it("a food photo for a food story", () => {
    expect(scorePhoto(photo("Babi guling, Balinese dish served in Ubud, Bali", "Bali dish babi guling"), { place: "Bali" })).not.toBeNull();
  });
  it("a wide view of the place scores higher than a plain match", () => {
    const wide = scorePhoto(photo("Panoramic view of Riyadh skyline at dusk", "Riyadh"), { place: "Riyadh" })!;
    const plain = scorePhoto(photo("Riyadh office building", "Riyadh"), { place: "Riyadh" })!;
    expect(wide).toBeGreaterThan(plain);
  });
  it("Unsplash tags count as the place", () => {
    expect(scorePhoto(photo("canal with boats at sunset", "Amsterdam canal", "canal boats amsterdam netherlands"), { place: "Amsterdam" })).not.toBeNull();
  });
});

describe("same-name places and country-only searches", () => {
  it("Florence, Alabama is not Florence, Italy", () => {
    expect(scorePhoto(photo("Florence-skyline-al.jpg Downtown Florence, Alabama, United States", "Florence skyline"), { place: "Florence", country: "Italy" })).toBeNull();
  });
  it("Bali District in Taiwan is not Bali, Indonesia", () => {
    expect(scorePhoto(photo("Bali, New Taipei Skyline. Skyline of Bali District, New Taipei, Taiwan", "Bali skyline"), { place: "Bali", country: "Indonesia" })).toBeNull();
  });
  it("a country-only search can't stand in for the city (Giethoorn for Amsterdam)", () => {
    expect(scorePhoto(photo("Netherlands, Giethoorn (02), tourism.jpg Mass tourism in Giethoorn, Netherlands.", "Netherlands tourism"), { place: "Amsterdam", country: "Netherlands" })).toBeNull();
  });
  it("naming the right country is fine", () => {
    expect(scorePhoto(photo("Rome, Italy Skyline", "Italy skyline"), { place: "Italy", country: "Italy" })).not.toBeNull();
    expect(scorePhoto(photo("Ponte Vecchio, Florence, Italy", "Florence skyline"), { place: "Florence", country: "Italy" })).not.toBeNull();
  });
  it("the word 'us' is not the United States", () => {
    expect(scorePhoto(photo("Join us on the Arno in Florence: view of Ponte Vecchio", "Florence Arno"), { place: "Florence", country: "Italy" })).not.toBeNull();
  });
});

describe("ranking", () => {
  it("for a skyline search, a skyline photo beats a stadium", () => {
    const ctx = { place: "Barcelona", country: "Spain" };
    const skyline = scorePhoto(photo("Barcelona skyline. View over the city towards the coast, Spain", "Barcelona skyline"), ctx)!;
    const stadium = scorePhoto(photo("Estadi Olímpic Lluís Companys - Barcelona, Spain. A four segment panorama", "Barcelona skyline"), ctx)!;
    expect(skyline).toBeGreaterThan(stadium);
  });
});

import { altForPhoto } from "@/lib/news/media";
describe("alt text from photo captions", () => {
  it("drops upload boilerplate, hashtags and doubled words", () => {
    expect(altForPhoto({ provider: "wikimedia", title: "x.jpg", description: "500px provided description: Barcelona Tourist Bus View [#tourist bus ,#Barcelona]", query: "Barcelona" })).toBe("Barcelona Tourist Bus View");
    expect(altForPhoto({ provider: "wikimedia", title: "x.jpg", description: "An aerial view from the the Columbus Monument across Port Vell in Barcelona , Spain", query: "Barcelona" })).toBe("An aerial view from the Columbus Monument across Port Vell in Barcelona, Spain");
  });
});
