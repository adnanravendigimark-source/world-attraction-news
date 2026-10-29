import { describe, it, expect, vi, afterEach } from "vitest";
vi.mock("@/lib/db", () => ({ sql: vi.fn(async () => []) }));
import { estimateCost } from "@/lib/news/aiRuns";
import { imageQuality } from "@/lib/news/imagegen";

describe("image calls are costed, so the daily cost cap sees them", () => {
  it("gpt-image-2 by quality", () => {
    expect(estimateCost("gpt-image-2", null, null, 1, "high")).toBe(0.165);
    expect(estimateCost("gpt-image-2", null, null, 1, "medium")).toBe(0.041);
    expect(estimateCost("gpt-image-2-2026-04-21", null, null, 1, "low")).toBe(0.005);
  });
  it("older models and dall-e-3 hd", () => {
    expect(estimateCost("gpt-image-1", null, null, 1, "high")).toBe(0.25);
    expect(estimateCost("dall-e-3", null, null, 1, "high")).toBe(0.12);
  });
  it("text models are unchanged", () => {
    expect(estimateCost("gpt-4o-mini", 1_000_000, 0)).toBe(0.15);
  });
});

describe("quality: editors' clicks vs automation", () => {
  afterEach(() => {
    delete process.env.OPENAI_IMAGE_QUALITY;
    delete process.env.OPENAI_IMAGE_QUALITY_AUTO;
  });
  it("defaults: medium for editors' clicks and the automation (cost)", () => {
    expect(imageQuality("manual")).toBe("medium");
    expect(imageQuality("auto")).toBe("medium");
  });
  it("each can be set; nonsense falls back to the default", () => {
    process.env.OPENAI_IMAGE_QUALITY = "medium";
    process.env.OPENAI_IMAGE_QUALITY_AUTO = "low";
    expect(imageQuality("manual")).toBe("medium");
    expect(imageQuality("auto")).toBe("low");
    process.env.OPENAI_IMAGE_QUALITY = "ultra";
    expect(imageQuality("manual")).toBe("medium");
    process.env.OPENAI_IMAGE_QUALITY = "high";
    expect(imageQuality("manual")).toBe("high");
  });
});
