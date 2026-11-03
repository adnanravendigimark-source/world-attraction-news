import { describe, it, expect } from "vitest";
import { storyAge } from "@/components/admin/NewsDesk";

const now = Date.parse("2026-11-03T05:00:00Z");
describe("story age in Trending News", () => {
  it("shows when the story was first reported, and when it was last updated", () => {
    expect(storyAge({ publishedFirstAt: "2026-10-31T09:00:00Z", firstSeenAt: "2026-11-01T00:00:00Z", lastSeenAt: "2026-11-03T03:00:00Z" }, now)).toBe(
      "first reported 3 d ago · updated 2 h ago"
    );
  });
  it("one time when everything came in close together", () => {
    expect(storyAge({ publishedFirstAt: "2026-11-03T01:00:00Z", firstSeenAt: "2026-11-03T02:00:00Z", lastSeenAt: "2026-11-03T03:00:00Z" }, now)).toBe("first reported 4 h ago");
  });
  it("falls back to when the collector first saw it", () => {
    expect(storyAge({ publishedFirstAt: null, firstSeenAt: "2026-11-02T05:00:00Z", lastSeenAt: "2026-11-02T06:00:00Z" }, now)).toBe("first reported 1 d ago");
  });
});
