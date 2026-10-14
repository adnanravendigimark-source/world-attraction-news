// What the home page shows in each section. Pure functions over data the
// page has already loaded, so they can be tested without a database.

import type { ArticleWithRelations } from "./articles";
import type { City } from "./cities";
import type { Category } from "./categories";
import { articlePath, cityPath } from "./destinations";

type Story = ArticleWithRelations;

export function storyHref(a: Pick<Story, "type" | "slug" | "countrySlug" | "citySlug">): string {
  return a.type === "news" ? `/news/${a.slug}` : articlePath(a.countrySlug, a.citySlug, a.slug);
}

export function storyDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function readTime(a: Pick<Story, "readingTimeMinutes">): string {
  return a.readingTimeMinutes ? `${a.readingTimeMinutes} min read` : "";
}

// The red label on a card: the article's category, else what kind it is.
export function storyLabel(a: Pick<Story, "type" | "categoryName">): string {
  return a.categoryName || (a.type === "news" ? "Travel News" : "Travel Guide");
}

const unique = (list: Story[]) => {
  const seen = new Set<string>();
  return list.filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)));
};

// Hero carousel: what editors marked Featured; if nothing is, the newest
// guides. Only stories with a photo (the hero is a full-width photo).
export function pickHeroStories(featured: Story[], guides: Story[], max = 4): Story[] {
  const withPhoto = (l: Story[]) => l.filter((a) => a.image);
  const picked = withPhoto(featured).length ? withPhoto(featured) : withPhoto(guides);
  return unique(picked).slice(0, max);
}

export interface DestinationCard {
  slug: string;
  name: string;
  country: string;
  href: string;
  image: string;
  imageAlt: string;
  description: string;
  stories: number;
}

// Featured destinations: the places with the most published stories. A
// place without its own photo uses the cover of its newest story (which is
// a photo of that place); a place with neither is left out.
export function pickDestinations(cities: (City & { articleCount: number })[], stories: Story[], max = 4): DestinationCard[] {
  const newestPhoto = new Map<string, Story>();
  for (const a of [...stories].sort((x, y) => Date.parse(y.publishedAt || "") - Date.parse(x.publishedAt || ""))) {
    if (a.image && a.citySlug && !newestPhoto.has(a.citySlug)) newestPhoto.set(a.citySlug, a);
  }
  return cities
    .map((c) => {
      const cover = newestPhoto.get(c.slug);
      const image = c.heroImage || cover?.image || "";
      const count = c.articleCount || 0;
      return {
        slug: c.slug,
        name: c.name,
        country: c.country,
        href: cityPath(c.countrySlug, c.slug),
        image,
        imageAlt: c.heroImage ? c.heroImageAlt || c.name : cover?.imageAlt || c.name,
        description: (c.intro || "").replace(/\s+/g, " ").trim() || (count ? `${count} ${count === 1 ? "story" : "stories"} from ${c.name}.` : ""),
        stories: count,
      };
    })
    .filter((d) => d.image)
    .sort((a, b) => b.stories - a.stories || (a.name < b.name ? -1 : 1))
    .slice(0, max);
}

// Categories, busiest first (ties keep the admin's order).
export function popularCategories(categories: Category[], counts: Record<string, number>, max = 6): Category[] {
  return categories
    .map((c, i) => ({ c, i, n: counts[c.id] || 0 }))
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .slice(0, max)
    .map((x) => x.c);
}
