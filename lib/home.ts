// Which stories the home page shows where. Pure, so it can be tested.
//
// Top: a lead story (an admin-featured one first, otherwise the newest) and
// up to two more, mixing news and guides when both exist. The sections below
// only show stories that are not already at the top, so nothing repeats.

import type { ArticleWithRelations } from "./articles";
import { articlePath } from "./destinations";

type Story = ArticleWithRelations;

const time = (a: Story) => (a.publishedAt ? Date.parse(a.publishedAt) || 0 : 0);
const newestFirst = (a: Story, b: Story) => time(b) - time(a);

function unique(list: Story[]): Story[] {
  const seen = new Set<string>();
  return list.filter((a) => (a && !seen.has(a.id) ? (seen.add(a.id), true) : false));
}

export interface HomeStories {
  lead: Story | null;
  secondary: Story[];
  news: Story[];
  guides: Story[];
}

export function pickHomeStories(input: {
  featured: Story[];
  editorsPicks: Story[];
  guides: Story[];
  news: Story[];
  perSection?: number;
}): HomeStories {
  const per = input.perSection ?? 4;
  const news = unique(input.news).sort(newestFirst);
  const guides = unique(input.guides).sort(newestFirst);
  const all = unique([...news, ...guides]).sort(newestFirst);

  const lead = input.featured[0] ?? all[0] ?? null;
  const used = new Set<string>(lead ? [lead.id] : []);
  const unused = (list: Story[]) => list.filter((a) => !used.has(a.id));

  // Prefer one news story and one guide beside the lead.
  const secondary = unique([unused(news)[0], unused(guides)[0]].filter(Boolean) as Story[]);
  for (const a of unused(all)) {
    if (secondary.length >= 2) break;
    if (!secondary.some((s) => s.id === a.id)) secondary.push(a);
  }
  secondary.splice(2);
  secondary.sort(newestFirst).forEach((a) => used.add(a.id));

  return {
    lead,
    secondary,
    news: unused(news).slice(0, per),
    // Editor's picks lead the guides row.
    guides: unique([...unused(input.editorsPicks.filter((a) => a.type !== "news")), ...unused(guides)]).slice(0, per),
  };
}

export function storyHref(a: Story): string {
  return a.type === "news" ? `/news/${a.slug}` : articlePath(a.countrySlug, a.citySlug, a.slug);
}

// "Breaking", "News · Riyadh", "Guide · Florence".
export function storyKicker(a: Story): { label: string; place: string; breaking: boolean } {
  const place = a.cityName && !/^(global|world)$/i.test(a.cityName) ? a.cityName : "";
  return { label: a.type === "news" ? "News" : "Guide", place, breaking: Boolean(a.breaking) };
}

export function storyDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
