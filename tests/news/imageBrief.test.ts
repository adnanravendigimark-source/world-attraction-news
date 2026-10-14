import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/db", () => ({ sql: vi.fn(async () => []) }));
import { briefIsGrounded, namesIn } from "@/lib/news/imageBrief";
import { composeImagePrompt, modelUnavailable } from "@/lib/news/imagegen";

const passage =
  "Park Güell Itinerary: Fitting It Into Your Barcelona Day Barcelona, Spain Exploring Nearby Attractions. After enjoying your visit to Park Güell, consider exploring the nearby Gràcia district. Known for its bohemian atmosphere, Gràcia offers a delightful array of attractions.";

describe("an image brief may only show places the article names", () => {
  it("rejects the Sagrada Família for a section about Gràcia", () => {
    expect(briefIsGrounded("The Sagrada Família seen from a leafy avenue in Barcelona at midday, a traveller in the foreground.", passage)).toBe(false);
  });
  it("accepts a brief about Gràcia near Park Güell", () => {
    expect(briefIsGrounded("A narrow street in the Gràcia district of Barcelona in warm late-afternoon light, colourful balconies, a café terrace, Park Güell's hill in the distance.", passage)).toBe(true);
  });
  it("accents and case don't matter", () => {
    expect(briefIsGrounded("Morning view over GRACIA rooftops toward Park Guell.", passage)).toBe(true);
  });
  it("a brief that names no place is not enough", () => {
    expect(briefIsGrounded("a lovely street in soft light with cafés", passage)).toBe(false);
  });
  it("finds multi-word names", () => {
    expect(namesIn("Plaça del Sol in Gràcia at dusk")).toEqual(expect.arrayContaining(["Plaça del Sol", "Gràcia"]));
  });
});

describe("the brief becomes the scene", () => {
  it("replaces the template scene but keeps the safety line", () => {
    const { scene, prompt } = composeImagePrompt({
      title: "Missile Strikes Disrupt Flights at Riyadh's King Khalid Airport",
      place: "Riyadh, Saudi Arabia",
      brief: "King Khalid International Airport's terminal in Riyadh at dawn, seen from the empty forecourt.",
    });
    expect(scene).toBe("King Khalid International Airport's terminal in Riyadh at dawn, seen from the empty forecourt");
    expect(prompt).toMatch(/No sign of conflict, damage/);
  });
});

describe("model fallback", () => {
  it("moves to an older model only when the model isn't available", () => {
    expect(modelUnavailable({ status: 404, message: "The model gpt-image-2 does not exist" })).toBe(true);
    expect(modelUnavailable({ status: 403, message: "Your organization must be verified" })).toBe(true);
    expect(modelUnavailable({ status: 400, message: "Your request was rejected by the safety system" })).toBe(false);
    expect(modelUnavailable({ status: 429, message: "Rate limit reached" })).toBe(false);
  });
});
