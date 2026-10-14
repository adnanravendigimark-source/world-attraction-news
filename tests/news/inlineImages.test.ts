import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/db", () => ({ sql: vi.fn(async () => []) }));
import { listSlots, setSlotFigure } from "@/lib/news/inlineImages";
import { composeImagePrompt } from "@/lib/news/imagegen";

const fig = (url: string, caption: string) => `<figure class="news-figure"><img src="${url}" alt="x"><figcaption>${caption}</figcaption></figure>`;

describe("image spots in a guide", () => {
  const html = `<p>Intro.</p><h2>Weather by Season</h2><p>A.</p><p>B.</p>${""}<h2>Food in Bali</h2><p>C.</p>${fig("https://img/old.jpg", "Photo: Someone / Wikimedia Commons")}<p>D.</p>`;
  it("one spot per section, showing the photo already there", () => {
    const s = listSlots(html, true);
    expect(s.map((x) => x.label)).toEqual(["Weather by Season", "Food in Bali"]);
    expect(s[0].image).toBeNull();
    expect(s[1].image?.url).toBe("https://img/old.jpg");
    expect(s[1].image?.ai).toBe(false);
  });
  it("adds an image after the section's first paragraph", () => {
    const out = setSlotFigure(html, true, 0, fig("https://img/ai.png", "AI-generated image"));
    expect(out).toContain(`<p>A.</p>${fig("https://img/ai.png", "AI-generated image")}<p>B.</p>`);
    expect(listSlots(out, true)[0].image?.ai).toBe(true);
  });
  it("replaces the photo already in a spot instead of stacking", () => {
    const out = setSlotFigure(html, true, 1, fig("https://img/ai.png", "AI-generated image"));
    expect(out).not.toContain("old.jpg");
    expect(out.match(/<figure/g)).toHaveLength(1);
  });
  it("removes an image and keeps the text", () => {
    const out = setSlotFigure(html, true, 1, null);
    expect(out).toBe(`<p>Intro.</p><h2>Weather by Season</h2><p>A.</p><p>B.</p><h2>Food in Bali</h2><p>C.</p><p>D.</p>`);
  });
});

describe("image spots in a news story", () => {
  const html = `<p>First paragraph about flights.</p><p>Second.</p>${fig("https://img/p.jpg", "Photo: X")}<p>Last.</p>`;
  it("one spot after each paragraph except the last", () => {
    const s = listSlots(html, false);
    expect(s).toHaveLength(2);
    expect(s[0].label).toBe("First paragraph about flights.");
    expect(s[1].image?.url).toBe("https://img/p.jpg");
  });
  it("a spot that no longer exists is reported, not guessed", () => {
    expect(() => setSlotFigure(html, false, 5, null)).toThrow(/isn't in the article/);
  });
});

describe("prompt for an image inside a guide", () => {
  it("the section heading decides the scene", () => {
    const { prompt, scene } = composeImagePrompt({ title: "Best Time to Visit Bali", place: "Bali, Indonesia", subject: "Balinese food", sceneFrom: "Food in Bali", inline: true, type: "guide" });
    expect(scene).toMatch(/^Balinese food: a local dish or restaurant setting typical of Bali, Indonesia/);
    expect(prompt).toMatch(/^Photograph placed inside a travel guide/);
  });
});
