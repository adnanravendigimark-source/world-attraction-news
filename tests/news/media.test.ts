import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/db", () => ({ sql: Object.assign(async () => [], {}) }));

import { samePhotoSubject, scorePhoto as scorePhoto2, altForPhoto as alt2 } from "@/lib/news/media";
describe("guide photos", () => {
  it("rejects military and official photos for a travel guide", () => {
    expect(scorePhoto2({ title: "Official & Unofficial Travel to Europe EXEMPT TRAVELERS United States", description: "U.S. Army USAG-V", query: "Travel United States" }, { place: "United States" })).toBeNull();
    expect(scorePhoto2({ title: "The child of a U.S. Navy sailor in Japan", description: "", query: "Transportation Japan" }, { place: "Japan" })).toBeNull();
  });
  it("sees two photos of the same landmark", () => {
    expect(samePhotoSubject("Eiffel Tower at Paris, France", "Eiffel Tower, Paris France", ["paris", "france"])).toBe(true);
    expect(samePhotoSubject("Eiffel Tower at Paris, France", "Louvre pyramid at night", ["paris", "france"])).toBe(false);
  });
  it("cleans file numbers and uploader notes out of alt text", () => {
    expect(alt2({ provider: "wikimedia", title: "File:Togetsukyo bridge in Arashiyama I did not walk to the other side 48743686522.jpg", description: "", query: "" })).toBe("Togetsukyo bridge in Arashiyama");
  });
});

describe("archive scans are not travel photos", () => {
  it("rejects a stereo photo from an archive", () => {
    expect(scorePhoto2({ title: "Stereofoto van het Colosseum te Rome, Italië, SFA003000359", description: "", query: "Colosseum Rome" }, { place: "Rome" })).toBeNull();
  });
});
