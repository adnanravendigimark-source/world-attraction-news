// Tidies the sources listed under a news story. Pure, no database access.
//
// - A publisher stored as a web address ("https://www.briefasia.com/") is
//   shown as its site ("briefasia.com").
// - The same article reached at two addresses (/article/x and /en/article/x,
//   with or without www, query strings or a trailing slash) counts once.
// - One source per site: two links from the same publisher add nothing.

import { hostOf, siteOf } from "./official";

const LOCALE_SEGMENT = /^\/[a-z]{2}(?:[-_][a-z]{2})?(?=\/)/i;

export function looksLikeAddress(s: string): boolean {
  const t = s.trim();
  return /^https?:\/\//i.test(t) || /^www\./i.test(t) || /^[a-z0-9-]+(\.[a-z0-9-]+)+\/?$/i.test(t);
}

export function cleanPublisher(publisher: string, url = ""): string {
  const p = String(publisher || "").trim();
  if (p && !looksLikeAddress(p)) return p;
  const fromName = p ? hostOf(/^https?:\/\//i.test(p) ? p : `https://${p}`) : "";
  const host = fromName || hostOf(url);
  return host ? siteOf(host) : p;
}

// The same article, whatever address it was reached at.
export function canonicalArticleUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(LOCALE_SEGMENT, "").replace(/\/+$/, "") || "/";
    return `${u.hostname.toLowerCase().replace(/^www\./, "")}${path.toLowerCase()}`;
  } catch {
    return String(url || "").trim().toLowerCase();
  }
}

// Key used to keep one source per publisher. Google News links all share one
// host, so those fall back to the publisher's name.
export function sourceKey(s: { publisher?: string; url?: string }): string {
  const host = hostOf(String(s.url || ""));
  if (host && !/(^|\.)news\.google\.com$/.test(host)) return siteOf(host);
  const name = cleanPublisher(String(s.publisher || ""), "");
  return looksLikeAddress(name) || name.includes(".") ? siteOf(name.toLowerCase()) : name.toLowerCase();
}

// sameSite: also keep only one source per website (news); off for guides,
// which can cite several pages of one reference site.
export function dedupeSources<T extends { publisher: string; url: string }>(list: T[], opts: { sameSite?: boolean } = {}): T[] {
  const sameSite = opts.sameSite !== false;
  const seenUrl = new Set<string>();
  const seenSite = new Set<string>();
  const out: T[] = [];
  for (const s of list) {
    const u = canonicalArticleUrl(s.url);
    const k = sourceKey(s);
    if ((u && seenUrl.has(u)) || (sameSite && k && seenSite.has(k))) continue;
    if (u) seenUrl.add(u);
    if (k) seenSite.add(k);
    out.push({ ...s, publisher: cleanPublisher(s.publisher, s.url) });
  }
  return out;
}

// Years in the text that are well before the story's date; the writer is told
// to present those as background, and the quality checklist flags them.
export function staleYears(text: string, now: Date = new Date()): number[] {
  const year = now.getUTCFullYear();
  const found = new Set<number>();
  for (const m of String(text || "").replace(/<[^>]+>/g, " ").matchAll(/\b(19[5-9]\d|20\d\d)\b/g)) {
    const y = Number(m[1]);
    if (y < year - 1) found.add(y);
  }
  return [...found].sort();
}
