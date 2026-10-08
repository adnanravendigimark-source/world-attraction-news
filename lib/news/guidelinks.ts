// Suggests links from a news article to World Attraction Guide pages
// (cities and attractions) by matching names in the article text. Suggestions
// only: an editor applies them. Reads the Guide's public read-only endpoint.

export interface GuideItem {
  type: "city" | "attraction";
  name: string;
  place: string;
  path: string;
}

export interface LinkSuggestion {
  name: string;
  type: "city" | "attraction";
  place: string;
  url: string;
  mentions: number;
}

let cache: { at: number; items: GuideItem[] } | null = null;
const TTL = 15 * 60 * 1000;

export function guideBaseUrl(): string {
  return (process.env.WORLD_GUIDE_URL || "").replace(/\/+$/, "");
}

export async function loadGuideItems(): Promise<GuideItem[]> {
  const base = guideBaseUrl();
  if (!base) throw new Error("WORLD_GUIDE_URL is not set (the World Attraction Guide site address).");
  if (cache && Date.now() - cache.at < TTL) return cache.items;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`${base}/api/public/linkable`, { signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`World Attraction Guide returned HTTP ${res.status}.`);
    const json: any = await res.json();
    const items: GuideItem[] = Array.isArray(json?.items) ? json.items : [];
    cache = { at: Date.now(), items };
    return items;
  } catch (err: any) {
    if (cache) return cache.items;
    throw new Error(err?.name === "AbortError" ? "World Attraction Guide timed out." : err?.message || "Couldn't reach World Attraction Guide.");
  } finally {
    clearTimeout(timer);
  }
}

function stripTags(html: string): string {
  return html.replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ");
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function suggestLinks(html: string, items: GuideItem[], max = 5): LinkSuggestion[] {
  const text = stripTags(html);
  const base = guideBaseUrl();
  const found: LinkSuggestion[] = [];
  for (const it of items) {
    if (!it.name || it.name.length < 4) continue;
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(it.name)}(?![\\p{L}\\p{N}])`, "giu");
    const mentions = (text.match(re) || []).length;
    if (mentions > 0) found.push({ name: it.name, type: it.type, place: it.place, url: base + it.path, mentions });
  }
  // Attractions are more specific than cities; then most-mentioned first.
  found.sort((a, b) => (a.type === b.type ? b.mentions - a.mentions : a.type === "attraction" ? -1 : 1));
  // Drop a city if an attraction in it is already suggested only when the name is contained (e.g. "Rome" inside "Colosseum, Rome") — keep both otherwise.
  return found.slice(0, max);
}

// Wraps the first plain-text mention of `name` in a link. Skips text already
// inside a link or tag attribute.
export function applyLink(html: string, name: string, url: string): string {
  const parts = html.split(/(<[^>]+>)/);
  let inAnchor = false;
  let done = false;
  const re = new RegExp(`(^|[^\\p{L}\\p{N}])(${escapeRe(name)})(?![\\p{L}\\p{N}])`, "iu");
  const safeUrl = url.replace(/"/g, "&quot;");
  return parts
    .map((p) => {
      if (p.startsWith("<")) {
        if (/^<a\b/i.test(p)) inAnchor = true;
        else if (/^<\/a>/i.test(p)) inAnchor = false;
        return p;
      }
      if (done || inAnchor) return p;
      return p.replace(re, (_m, pre, hit) => {
        done = true;
        return `${pre}<a href="${safeUrl}">${hit}</a>`;
      });
    })
    .join("");
}
