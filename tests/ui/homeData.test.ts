import { describe, it, expect } from "vitest";
import { pickHeroStories, pickDestinations, popularCategories, storyHref, storyLabel, storyDate } from "@/lib/home";

const story = (id: string, extra: any = {}) =>
  ({ id, slug: id, type: "guide", title: id, image: `/img/${id}.jpg`, imageAlt: "", publishedAt: "2026-10-10T10:00:00Z", countrySlug: "italy", citySlug: "florence", categoryName: null, ...extra }) as any;
const city = (slug: string, extra: any = {}) =>
  ({ id: slug, slug, name: slug[0].toUpperCase() + slug.slice(1), country: "Italy", countrySlug: "italy", heroImage: "", heroImageAlt: "", intro: "", articleCount: 0, ...extra }) as any;

describe("home page: hero", () => {
  it("uses featured stories when an editor picked some", () => {
    const r = pickHeroStories([story("f1", { featured: true })], [story("g1"), story("g2")]);
    expect(r.map((a) => a.id)).toEqual(["f1"]);
  });
  it("falls back to the newest guides, photo-only, at most four", () => {
    const guides = [story("g1"), story("g2", { image: "" }), story("g3"), story("g4"), story("g5"), story("g6")];
    expect(pickHeroStories([], guides).map((a) => a.id)).toEqual(["g1", "g3", "g4", "g5"]);
  });
  it("is empty when there is nothing to show (the carousel then hides)", () => {
    expect(pickHeroStories([], [])).toEqual([]);
  });
});

describe("home page: destinations", () => {
  it("ranks by stories, uses the newest story photo when the place has none, drops places with no photo", () => {
    const cities = [
      city("bali", { heroImage: "/bali.jpg", intro: "Island of the gods.", articleCount: 0, country: "Indonesia", countrySlug: "indonesia" }),
      city("florence", { articleCount: 2 }),
      city("dubai", { articleCount: 0 }),
    ];
    const stories = [
      story("old", { citySlug: "florence", image: "/old.jpg", publishedAt: "2026-09-01T00:00:00Z" }),
      story("new", { citySlug: "florence", image: "/new.jpg", imageAlt: "Arno at dusk", publishedAt: "2026-10-01T00:00:00Z" }),
    ];
    const r = pickDestinations(cities, stories);
    expect(r.map((d) => d.slug)).toEqual(["florence", "bali"]);
    expect(r[0]).toMatchObject({ image: "/new.jpg", imageAlt: "Arno at dusk", href: "/italy/florence", description: "2 stories from Florence." });
    expect(r[1]).toMatchObject({ image: "/bali.jpg", description: "Island of the gods.", href: "/indonesia/bali" });
  });
});

describe("home page: categories and labels", () => {
  it("puts the busiest categories first, keeping admin order for ties", () => {
    const cats = ["aviation", "airports", "attractions"].map((slug, i) => ({ id: slug, slug, name: slug, sortOrder: i })) as any;
    expect(popularCategories(cats, { attractions: 3, airports: 1 }).map((c) => c.slug)).toEqual(["attractions", "airports", "aviation"]);
  });
  it("links and labels news and guides correctly", () => {
    expect(storyHref(story("n", { type: "news" }))).toBe("/news/n");
    expect(storyHref(story("g"))).toBe("/italy/florence/g");
    expect(storyLabel(story("n", { type: "news" }))).toBe("Travel News");
    expect(storyLabel(story("g", { categoryName: "Attractions" }))).toBe("Attractions");
    expect(storyDate("2026-10-12T23:30:00Z")).toBe("Oct 12, 2026");
  });
});
