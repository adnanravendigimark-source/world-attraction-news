// Inserts and removes links to this site's own pages in article HTML. Pure
// functions, no database access (lib/news/internalLinks.ts stores them).
//
// Rules for news (Phase 10): at most MAX_IN_TEXT links in the text, one per
// page, never in the lede (the first paragraph), never inside a heading, a
// figure or caption, or an existing link.

export const MAX_IN_TEXT = 3;

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const BLOCKED = /^(a|h[1-6]|figure|figcaption|code|pre)$/i;

// Wraps the first allowed plain-text mention of `name` in a link to `url`.
// Returns the HTML unchanged when there is no allowed mention.
export function applyLink(html: string, name: string, url: string, opts: { skipLede?: boolean } = {}): string {
  const parts = html.split(/(<[^>]+>)/);
  const stack: string[] = []; // open blocked elements
  let paragraphs = 0; // <p> elements opened so far
  let inFirstPara = false;
  let done = false;
  const re = new RegExp(`(^|[^\\p{L}\\p{N}])(${escapeRe(name)})(?![\\p{L}\\p{N}])`, "iu");
  const safeUrl = url.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  return parts
    .map((p) => {
      if (p.startsWith("<")) {
        const m = p.match(/^<(\/?)([a-z0-9]+)/i);
        if (m) {
          const [, closing, tag] = m;
          if (/^p$/i.test(tag)) {
            if (!closing) {
              paragraphs++;
              inFirstPara = paragraphs === 1;
            } else inFirstPara = false;
          }
          if (BLOCKED.test(tag) && !/\/>$/.test(p)) {
            if (closing) {
              const i = stack.lastIndexOf(tag.toLowerCase());
              if (i >= 0) stack.splice(i, 1);
            } else stack.push(tag.toLowerCase());
          }
        }
        return p;
      }
      if (done || stack.length > 0 || (opts.skipLede && inFirstPara)) return p;
      return p.replace(re, (_m, pre, hit) => {
        done = true;
        return `${pre}<a href="${safeUrl}">${hit}</a>`;
      });
    })
    .join("");
}

// Removes every link to `url`, keeping its text.
export function removeLink(html: string, url: string): string {
  const variants = new Set([url, url.replace(/&/g, "&amp;")]);
  return html.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (whole, attrs: string, text: string) => {
    const href = attrs.match(/href="([^"]*)"/i)?.[1] ?? "";
    return variants.has(href) ? text : whole;
  });
}

// True when the HTML links to `url`.
export function hasLink(html: string, url: string): boolean {
  const safe = url.replace(/&/g, "&amp;");
  return html.includes(`href="${url}"`) || html.includes(`href="${safe}"`);
}

export interface LinkCandidate {
  name: string; // the words to link
  url: string; // a path on this site
  type: "site_country" | "site_city" | "site_article";
}

export interface LinkPlan {
  html: string;
  inText: LinkCandidate[]; // linked in the text
  related: LinkCandidate[]; // mentioned but not linked (cap, lede-only, blocked): Related box
}

// Plans links for an article: cities before countries (more specific), one
// link per page, at most MAX_IN_TEXT in the text, never in the lede. Pages
// in `skipUrls` (an editor removed them) are left out entirely.
export function planLinks(html: string, mentions: LinkCandidate[], skipUrls: Set<string> = new Set(), max = MAX_IN_TEXT): LinkPlan {
  const order = { site_city: 0, site_country: 1, site_article: 2 } as const;
  const seen = new Set<string>();
  const list = [...mentions]
    .filter((m) => !skipUrls.has(m.url) && !seen.has(m.url) && (seen.add(m.url), true))
    .sort((a, b) => order[a.type] - order[b.type]);
  let out = html;
  const inText: LinkCandidate[] = [];
  const related: LinkCandidate[] = [];
  for (const m of list) {
    if (m.type !== "site_article" && inText.length < max && !hasLink(out, m.url)) {
      const next = applyLink(out, m.name, m.url, { skipLede: true });
      if (next !== out) {
        out = next;
        inText.push(m);
        continue;
      }
    }
    related.push(m);
  }
  return { html: out, inText, related };
}
