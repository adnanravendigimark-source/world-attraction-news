// News API adapters. These are DISCOVERY inputs only — headlines, links and
// short teasers. Nothing from an API is treated as verified fact.
import type { ParsedFeedItem } from "./rss";
import { stripHtml } from "./rss";

export class MissingKeyError extends Error {}

function parseDate(raw: unknown): string | null {
  if (!raw) return null;
  const t = Date.parse(String(raw));
  if (!Number.isFinite(t) || t > Date.now() + 24 * 3600 * 1000) return null;
  return new Date(t).toISOString();
}

async function getJson(url: string, headers: Record<string, string>): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal, cache: "no-store" });
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* fall through */
    }
    if (!res.ok) {
      throw new Error(json?.message || json?.error || `HTTP ${res.status}`);
    }
    if (!json) throw new Error("Invalid JSON from API.");
    return json;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchNewsApi(query: string): Promise<ParsedFeedItem[]> {
  const key = process.env.NEWSAPI_KEY;
  if (!key) throw new MissingKeyError("NEWSAPI_KEY is not set.");
  const from = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
  const url =
    "https://newsapi.org/v2/everything?" +
    new URLSearchParams({ q: query, language: "en", sortBy: "publishedAt", pageSize: "50", from }).toString();
  const json = await getJson(url, { "X-Api-Key": key });
  if (json.status && json.status !== "ok") throw new Error(json.message || "NewsAPI error.");
  return (json.articles || [])
    .filter((a: any) => a?.title && a?.url && a.title !== "[Removed]")
    .map((a: any) => ({
      externalId: String(a.url).slice(0, 500),
      title: stripHtml(String(a.title)).slice(0, 500),
      description: stripHtml(String(a.description || "")).slice(0, 600),
      url: String(a.url),
      imageUrl: a.urlToImage ? String(a.urlToImage) : "",
      author: String(a.source?.name || a.author || "").slice(0, 200),
      publishedAt: parseDate(a.publishedAt),
      categories: [],
    }));
}

export async function fetchCurrents(query: string): Promise<ParsedFeedItem[]> {
  const key = process.env.CURRENTS_API_KEY;
  if (!key) throw new MissingKeyError("CURRENTS_API_KEY is not set.");
  const url =
    "https://api.currentsapi.services/v1/search?" +
    new URLSearchParams({ keywords: query, language: "en", page_size: "50" }).toString();
  const json = await getJson(url, { Authorization: key });
  if (json.status && json.status !== "ok") throw new Error(json.msg || "Currents API error.");
  return (json.news || [])
    .filter((a: any) => a?.title && a?.url)
    .map((a: any) => ({
      externalId: String(a.id || a.url).slice(0, 500),
      title: stripHtml(String(a.title)).slice(0, 500),
      description: stripHtml(String(a.description || "")).slice(0, 600),
      url: String(a.url),
      imageUrl: a.image && a.image !== "None" ? String(a.image) : "",
      author: String(a.author || "").slice(0, 200),
      publishedAt: parseDate(a.published),
      categories: Array.isArray(a.category) ? a.category.map(String) : [],
    }));
}
