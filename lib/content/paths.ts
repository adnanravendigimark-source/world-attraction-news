// Public URL for any article: news at /news/[slug], guides at
// /[country]/[city]/[slug], country-level guides at /[country]/[slug].

import { articlePath } from "../destinations";

export function publicPath(a: { type: string; slug: string; countrySlug?: string; citySlug?: string }): string {
  if (a.type === "news") return `/news/${a.slug}`;
  return articlePath(a.countrySlug || "", a.citySlug || "", a.slug);
}
