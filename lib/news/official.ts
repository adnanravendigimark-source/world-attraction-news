// Decides whether a research source counts as official (a government body,
// an airline, airport, operator or tourism board speaking about itself).
// Pure, no database access.
//
// The editor's flag on the news source is the main signal. For links that
// arrive through an aggregator (Google News, NewsAPI), the publisher's host
// is compared with the websites of sources flagged official, and with
// government domains. Words like "airport" or "tourism" in a host name are
// no longer enough: plenty of blogs use them.

const GOV_HOST = [/(^|\.)gov$/i, /(^|\.)(gov|gob|gouv|go|govt)\.[a-z]{2}$/i, /(^|\.)europa\.eu$/i, /\.int$/i];

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

// Registrable-ish domain: the last two labels, or three for "co.uk"-style
// endings, so news.delta.com and www.delta.com compare equal.
export function siteOf(host: string): string {
  const parts = host.split(".").filter(Boolean);
  if (parts.length <= 2) return parts.join(".");
  const sld = parts[parts.length - 2];
  const take = sld.length <= 3 && /^(co|com|gov|org|ac|net|go|gob|gouv|govt|edu)$/.test(sld) ? 3 : 2;
  return parts.slice(-take).join(".");
}

export function isGovernmentHost(host: string): boolean {
  return !!host && GOV_HOST.some((re) => re.test(host));
}

// Sites of every source the editor marked official: the whole site of its
// website ("delta.com" covers news.delta.com) and the exact host of its feed
// (a feed on a shared press-release platform must not vouch for the whole
// platform).
export function officialSites(sources: { url?: string; rssUrl?: string; isOfficial: boolean }[]): Set<string> {
  const out = new Set<string>();
  for (const s of sources) {
    if (!s.isOfficial) continue;
    const site = hostOf(s.url || "");
    if (site) out.add(siteOf(site));
    const feed = hostOf(s.rssUrl || "");
    if (feed) out.add(feed);
  }
  return out;
}

export function isOfficialSource(opts: { flagged: boolean; url: string; sites: Set<string> }): boolean {
  if (opts.flagged) return true;
  const host = hostOf(opts.url);
  if (!host) return false;
  return isGovernmentHost(host) || opts.sites.has(host) || opts.sites.has(siteOf(host));
}
