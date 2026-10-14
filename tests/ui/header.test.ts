import { describe, it, expect } from "vitest";
import { activeSection } from "@/components/PublicHeader";

describe("header active section", () => {
  it("marks the right menu item", () => {
    expect(activeSection("/news")).toBe("news");
    expect(activeSection("/news/visa-rules")).toBe("news");
    expect(activeSection("/newsletter")).toBe("");
    expect(activeSection("/latest-news")).toBe("guides");
    expect(activeSection("/destinations")).toBe("destinations");
    expect(activeSection("/categories/theme-parks")).toBe("topics");
    expect(activeSection("/about")).toBe("about");
    expect(activeSection("/")).toBe("");
  });
});
