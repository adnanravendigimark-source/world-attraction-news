// Inserts links to this site's own pages (country and city pages) into
// article HTML. Used by the SEO step (lib/news/seo.ts).

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
