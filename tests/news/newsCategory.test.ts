import { describe, it, expect } from "vitest";
import { pickNewsCategorySlug } from "@/lib/news/newsCategory";

const ALL = ["aviation", "airports", "travel-rules", "destinations", "attractions", "travel-tips", "cruises"];

describe("pickNewsCategorySlug", () => {
  it("uses the headline before the feed topic", () => {
    expect(pickNewsCategorySlug("Step inside Hollywood Burbank Airport's stunning new terminal", "Aviation", ALL)).toBe("airports");
    expect(pickNewsCategorySlug("Thailand's new entry fee and departure tax could raise travel costs", "General", ALL)).toBe("travel-rules");
    expect(pickNewsCategorySlug("Qatar simplifies travel for Indian visitors with A1 Tourist Visa", "Travel Rules", ALL)).toBe("travel-rules");
    expect(pickNewsCategorySlug("Disney Imagination named first Disney Cruise ship sailing from Japan", "Cruises", ALL)).toBe("cruises");
    expect(pickNewsCategorySlug("Delta to delay planned flight from Atlanta to Riyadh", "Aviation", ALL)).toBe("aviation");
  });

  it("falls back to the story topic", () => {
    expect(pickNewsCategorySlug("Norwegian Aura will now debut 19 days earlier", "Cruises", ALL)).toBe("cruises");
  });

  it("returns null when unclear or the category is not on the site", () => {
    expect(pickNewsCategorySlug("LXR Hotels & Resorts debuts in India", "Hotels", ALL)).toBeNull();
    expect(pickNewsCategorySlug("New cruise ship launched", "Cruises", ["airports", "travel-rules"])).toBeNull();
    expect(pickNewsCategorySlug("Airline adds route", "Aviation", ["airports"])).toBeNull();
  });
});

describe("pickNewsCategorySlug: wider headline words", () => {
  it("catches cruise, airline and visitor-rule headlines without topic words", () => {
    expect(pickNewsCategorySlug("Disney Believe to Set Sail from Port Everglades in 2027", "", ALL)).toBe("cruises");
    expect(pickNewsCategorySlug("Ponant to Expand Arctic Expeditions with Four Polar Vessels", "", ALL)).toBe("cruises");
    expect(pickNewsCategorySlug("Icelandair Adds St. Louis as New U.S. Gateway for 2027", "", ALL)).toBe("aviation");
    expect(pickNewsCategorySlug("Amsterdam Tightens Visitor Rules to Manage Tourism Growth", "Attractions", ALL)).toBe("travel-rules");
  });
});
