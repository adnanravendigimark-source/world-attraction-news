// Picks the site category for a news draft. Pure: no database access.
//
// The headline decides first, because it is more specific than the feed's
// topic ("Hollywood Burbank Airport's new terminal" came from an Aviation
// feed but belongs under Airports). Otherwise the story's topic from the
// collector is used. Only a category that exists on the site is returned;
// anything unclear returns null and the editor picks one.

const TITLE_RULES: { slug: string; re: RegExp }[] = [
  { slug: "airports", re: /\b(airports?|terminals?|runways?|security checkpoints?|TSA|baggage claim)\b/i },
  { slug: "travel-rules", re: /\b(visas?|passports?|entry (rules|requirements|fee|tax)|departure tax|tourist tax|travel ban|border|ETIAS|ESTA|eVisa|e-visa|customs|quarantine|travel advisory|(visitor|tourist) rules|rules for (tourists|visitors))\b/i },
  { slug: "cruises", re: /\b(cruises?|cruise ships?|ocean liners?|set sail|sailings?|polar vessels?|expedition ships?)\b/i },
  { slug: "aviation", re: /\b(airlines?|airways|flights?|routes?|aircraft|planes?|nonstop|non-stop|carriers?|gateway)\b/i },
  { slug: "attractions", re: /\b(theme parks?|water ?parks?|museums?|landmarks?|attractions?|zoos?|aquariums?)\b/i },
];

// The collector's topics (lib/news/sources.ts NEWS_CATEGORIES) to site slugs.
const TOPIC_TO_SLUG: Record<string, string> = {
  aviation: "aviation",
  "travel rules": "travel-rules",
  cruises: "cruises",
  attractions: "attractions",
  destinations: "destinations",
};

export function pickNewsCategorySlug(
  title: string,
  topic: string,
  siteSlugs: string[]
): string | null {
  const has = new Set(siteSlugs);
  for (const rule of TITLE_RULES) {
    if (has.has(rule.slug) && rule.re.test(title || "")) return rule.slug;
  }
  const fromTopic = TOPIC_TO_SLUG[String(topic || "").trim().toLowerCase()];
  return fromTopic && has.has(fromTopic) ? fromTopic : null;
}
