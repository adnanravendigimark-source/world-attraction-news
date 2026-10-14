import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";

// ensureImages reads the article and writes results; nothing else is needed.
const writes: string[] = [];
vi.mock("@/lib/db", () => ({
  sql: (strings: TemplateStringsArray) => {
    const q = strings.join("?");
    if (/^\s*(UPDATE|INSERT)/.test(q)) writes.push(q.trim().split(/\s+/).slice(0, 3).join(" "));
    if (/SELECT a\.title, a\.content_html/.test(q)) return Promise.resolve([{ title: "Hollywood Burbank Airport opens new terminal", content_html: "<p>One.</p><p>Two.</p><p>Three.</p>", city: "Burbank", country: "United States" }]);
    if (/SELECT image FROM articles/.test(q)) return Promise.resolve([{ image: null }]);
    if (/SELECT value FROM news_settings/.test(q)) return Promise.resolve([]);
    return Promise.resolve([]);
  },
}));

const { isAllowedLicense, altForPhoto, findPhoto } = await import("@/lib/news/media");
const { cropToNewsCover, NEWS_COVER } = await import("@/lib/blob");
const { isNewsCoverSize, PROVENANCE_LABELS } = await import("@/lib/news/images");
const { ensureImages } = await import("@/lib/news/imagegen");

describe("licence filter", () => {
  it("accepts licences we can use commercially with a credit", () => {
    for (const l of ["CC0", "Public domain", "CC BY 4.0", "CC BY-SA 3.0", "CC BY-SA 2.0 de"]) expect(isAllowedLicense(l), l).toBe(true);
  });
  it("rejects non-commercial, no-derivatives, fair use and unknown licences", () => {
    for (const l of ["CC BY-NC 2.0", "CC BY-NC-SA 4.0", "CC BY-ND 4.0", "Fair use", "GFDL only", "All rights reserved", ""]) expect(isAllowedLicense(l), l).toBe(false);
  });
});

describe("alt text", () => {
  it("uses Unsplash's description of the picture", () => {
    expect(altForPhoto({ provider: "unsplash", title: "a large jetliner sitting on top of an airport tarmac", query: "airport" })).toBe(
      "A large jetliner sitting on top of an airport tarmac"
    );
  });
  it("prefers a Wikimedia caption, else a cleaned file name, else the search subject", () => {
    expect(altForPhoto({ provider: "wikimedia", title: "Burbank_T1.jpg x", description: "The new terminal at Hollywood Burbank Airport. Photo taken in 2026.", query: "q" })).toBe(
      "The new terminal at Hollywood Burbank Airport"
    );
    expect(altForPhoto({ provider: "wikimedia", title: "Heathrow_Terminal_5_(2019).jpg Some text", description: "", query: "q" })).toBe("Heathrow Terminal 5");
    expect(altForPhoto({ provider: "wikimedia", title: "IMG_1234.jpg", description: "", query: "belgrade old town" })).toBe("Belgrade old town");
  });
});

describe("cover crop", () => {
  it("crops portrait, wide and small images to exactly 1200×675", async () => {
    for (const [w, h] of [[800, 1200], [3000, 1000], [400, 300]]) {
      const input = await sharp({ create: { width: w, height: h, channels: 3, background: { r: 40, g: 120, b: 200 } } }).png().toBuffer();
      const out = await cropToNewsCover(input);
      expect([out.width, out.height]).toEqual([NEWS_COVER.width, NEWS_COVER.height]);
      const meta = await sharp(out.data).metadata();
      expect([meta.width, meta.height, meta.format]).toEqual([1200, 675, "webp"]);
    }
  });

  it("only counts the size when it was recorded for the current cover", () => {
    const m = { coverUrl: "https://blob/a.webp", width: 1200, height: 675 };
    expect(isNewsCoverSize(m, "https://blob/a.webp")).toBe(true);
    expect(isNewsCoverSize(m, "https://blob/b.webp")).toBe(false); // a newer, unsaved upload
    expect(isNewsCoverSize({ ...m, width: 1600 }, "https://blob/a.webp")).toBe(false);
  });

  it("maps stored provenance to the vision's labels", () => {
    expect(PROVENANCE_LABELS.licensed.code).toBe("LICENSED");
    expect(PROVENANCE_LABELS.ai.code).toBe("AI_GENERATED");
    expect(PROVENANCE_LABELS.own.code).toBe("EDITORIAL");
    expect(PROVENANCE_LABELS.permission.code).toBe("EDITORIAL");
    expect(PROVENANCE_LABELS.unverified.code).toBe("OTHER");
  });
});

describe("no photo found", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns no photo when every provider fails, without throwing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    await expect(findPhoto(["Hollywood Burbank Airport terminal"])).resolves.toBeNull();
  });

  it("leaves the cover empty when AI is not allowed", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ query: { pages: {} } }), { status: 200 })));
    await expect(ensureImages("a1", { allowAi: false, inline: false })).resolves.toEqual({ cover: "none", inline: 0 });
  });
});

describe("structured data", () => {
  it("describes a cropped cover as a 1200×675 ImageObject", async () => {
    const { newsArticleJsonLd } = await import("@/lib/seo");
    const base = { title: "t", description: "d", image: "https://blob/a.webp", path: "/news/t", authorName: "World Attraction News", publishedAt: null, updatedAt: "2026-10-09T00:00:00Z" };
    const sized: any = newsArticleJsonLd({ ...base, imageSize: { width: 1200, height: 675 } });
    expect(sized.image).toEqual([{ "@type": "ImageObject", url: "https://blob/a.webp", width: 1200, height: 675 }]);
    expect((newsArticleJsonLd(base) as any).image).toEqual(["https://blob/a.webp"]);
  });
});
