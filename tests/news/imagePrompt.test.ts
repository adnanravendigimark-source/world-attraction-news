import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/db", () => ({ sql: vi.fn(async () => []) }));
import { composeImagePrompt, photoQueries } from "@/lib/news/imagegen";

describe("AI cover prompts are built from the story", () => {
  it("a security story shows the calm place, never the incident", () => {
    const { prompt, scene } = composeImagePrompt({
      title: "Missile Strikes Disrupt Flights at Riyadh's King Khalid Airport",
      place: "Riyadh, Saudi Arabia",
      where: "King Khalid International Airport, Riyadh",
      subject: "King Khalid International Airport",
      type: "news",
    });
    expect(scene).toMatch(/calm, wide establishing view of Riyadh, Saudi Arabia/);
    expect(prompt).toMatch(/No sign of conflict, damage/);
    expect(prompt).toMatch(/Do not depict the news event itself/);
    expect(prompt).toContain("Location: Riyadh, Saudi Arabia (King Khalid International Airport, Riyadh)");
    expect(scene).not.toMatch(/No sign/); // instructions stay out of the alt text
  });
  it("an aviation story shows the airport, unbranded", () => {
    const { prompt, scene } = composeImagePrompt({ title: "Emirates adds a third daily flight to Manchester", place: "Dubai, United Arab Emirates", subject: "Dubai International Airport", type: "news" });
    expect(scene).toMatch(/^Dubai International Airport: an airport terminal exterior/);
    expect(prompt).toMatch(/unbranded/);
  });
  it("an opening uses the venue", () => {
    const { scene } = composeImagePrompt({ title: "Artemisia Gentileschi Exhibition Opens in Florence", place: "Florence, Italy", subject: "Palazzo Strozzi", type: "news" });
    expect(scene).toMatch(/Palazzo Strozzi: the exterior of the attraction or venue in Florence, Italy/);
  });
  it("a guide without a special keyword shows the subject in its place", () => {
    const { scene, prompt } = composeImagePrompt({ title: "Florence Travel Guide for First-Time Visitors", place: "Florence, Italy", subject: "Duomo", type: "guide" });
    expect(scene).toBe("Duomo in Florence, Italy, as a visitor would see it");
    expect(prompt).toMatch(/travel guide/);
  });
  it("always asks for realistic editorial photography framed for 16:9, with no text or logos", () => {
    const { prompt } = composeImagePrompt({ title: "Bali tourist levy rises", place: "Bali, Indonesia" });
    expect(prompt).toMatch(/Premium editorial travel photograph/);
    expect(prompt).toMatch(/16:9/);
    expect(prompt).toMatch(/No text, lettering, signage/);
    expect(prompt).toMatch(/watermarks/);
  });
});

describe("photo search order", () => {
  it("specific subjects first, then the place, then the headline", () => {
    expect(photoQueries(["King Khalid International Airport"], "Riyadh", "Missile strikes disrupt flights")).toEqual([
      "King Khalid International Airport",
      "Riyadh skyline",
      "Riyadh city view",
      "Missile strikes disrupt flights",
    ]);
  });
});

describe("scene choice", () => {
  it("a sights guide is not a food scene because the standfirst mentions dining", () => {
    const { scene } = composeImagePrompt({ title: "Comprehensive Guide to Must-See Attractions in Italy", excerpt: "UNESCO sites, coastal destinations and dining etiquette.", place: "Italy", subject: "Colosseum Rome" });
    expect(scene).toMatch(/exterior of the attraction or venue/);
  });
  it("doesn't repeat the place when the subject names it", () => {
    const { scene } = composeImagePrompt({ title: "Barcelona Launches Algorithmic Tourism Strategy", place: "Barcelona, Spain", subject: "Barcelona cityscape" });
    expect(scene).toBe("Barcelona cityscape, as a visitor would see it");
  });
});

describe("boat tours", () => {
  it("a river boat guide asks for a sightseeing boat on the water", () => {
    const { scene } = composeImagePrompt({ title: "Arno Boat Tour: Your Ultimate Guide in Florence", place: "Florence, Italy", subject: "Arno Boat Tour", type: "guide" });
    expect(scene).toBe("Arno Boat Tour: a small sightseeing boat on the water in Florence, Italy, with the city's real waterfront behind it");
  });
});
