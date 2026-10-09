// Turns a Google News RSS link (news.google.com/rss/articles/<id>) into the
// publisher's own article URL, so research can read the real page instead
// of only the headline.
//
// Older IDs embed the URL in base64 and decode offline. Newer IDs
// ("AU_yqL…") need two requests: the article page gives a timestamp and
// signature, and Google's own decode endpoint (the one its "open article"
// button calls) returns the URL. Results are cached on news_items, so each
// link is resolved at most once.
import { sql } from "../db";
import { isPublicUrl } from "./extract";

const UA = "Mozilla/5.0 (compatible; WorldAttractionNewsBot/1.0; +research)";

export function googleNewsArticleId(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.hostname !== "news.google.com") return null;
    const m = u.pathname.match(/\/(?:rss\/)?articles\/([A-Za-z0-9_-]+)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

// Old-style IDs carry the URL inside the protobuf; newer ones carry an
// opaque token that starts with "AU_yqL" and must be resolved online.
export function decodeOffline(id: string): string | null {
  let bytes: Buffer;
  try {
    bytes = Buffer.from(id.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  } catch {
    return null;
  }
  const text = bytes.toString("latin1");
  if (text.includes("AU_yqL")) return null;
  const m = text.match(/https?:\/\/[\x21-\x7e]+/);
  if (!m) return null;
  // The URL is followed by protobuf bytes; cut at the first non-URL byte run.
  const url = m[0].replace(/[\x00-\x1f\x7f-\xff][\s\S]*$/, "");
  return isPublisherUrl(url) ? url : null;
}

export function readSignature(html: string): { ts: number; sg: string } | null {
  const ts = html.match(/data-n-a-ts="(\d+)"/)?.[1];
  const sg = html.match(/data-n-a-sg="([^"]+)"/)?.[1];
  return ts && sg ? { ts: Number(ts), sg } : null;
}

export function buildDecodeRequest(id: string, sig: { ts: number; sg: string }): string {
  const inner = [
    "garturlreq",
    [["X", "X", ["X", "X"], null, null, 1, 1, "US:en", null, 1, null, null, null, null, null, 0, 1], "X", "X", 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0],
    id,
    sig.ts,
    sig.sg,
  ];
  return new URLSearchParams({ "f.req": JSON.stringify([[["Fbv4je", JSON.stringify(inner), null, "generic"]]]) }).toString();
}

// The endpoint answers with ")]}'" and then JSON lines; the URL sits in the
// "garturlres" payload.
export function parseDecodeResponse(body: string): string | null {
  for (const line of body.split("\n")) {
    if (!line.startsWith("[")) continue;
    let rows: any;
    try {
      rows = JSON.parse(line);
    } catch {
      continue;
    }
    for (const row of Array.isArray(rows) ? rows : []) {
      if (Array.isArray(row) && row[0] === "wrb.fr" && row[1] === "Fbv4je" && typeof row[2] === "string") {
        try {
          const payload = JSON.parse(row[2]);
          if (payload?.[0] === "garturlres" && typeof payload[1] === "string") return payload[1];
        } catch {
          /* not this row */
        }
      }
    }
  }
  return null;
}

function isPublisherUrl(url: string): boolean {
  try {
    const h = new URL(url).hostname;
    return isPublicUrl(url) && !/(^|\.)google\.[a-z.]+$/.test(h);
  } catch {
    return false;
  }
}

async function decodeOnline(id: string, fetchImpl: typeof fetch): Promise<string | null> {
  const page = await fetchImpl(`https://news.google.com/rss/articles/${id}?hl=en-US&gl=US&ceid=US:en`, {
    headers: { "User-Agent": UA },
    redirect: "follow",
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!page.ok) return null;
  const sig = readSignature(await page.text());
  if (!sig) return null;
  const res = await fetchImpl("https://news.google.com/_/DotsSplashUi/data/batchexecute", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8", "User-Agent": UA },
    body: buildDecodeRequest(id, sig),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const url = parseDecodeResponse(await res.text());
  return url && isPublisherUrl(url) ? url : null;
}

// Publisher URL for a Google News link, or null if it can't be resolved.
export async function resolveGoogleNewsUrl(raw: string, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  const id = googleNewsArticleId(raw);
  if (!id) return null;
  const offline = decodeOffline(id);
  if (offline) return offline;
  try {
    return await decodeOnline(id, fetchImpl);
  } catch {
    return null;
  }
}

// Resolves and caches the publisher URL for one news item. Returns the
// publisher URL, or "" when the item isn't a Google News link or can't be
// resolved. Only successes are cached; a failure is retried next time.
export async function publisherUrlForItem(item: { id: string; url: string; resolved_url?: string | null }): Promise<string> {
  if (!googleNewsArticleId(item.url)) return "";
  if (item.resolved_url) return item.resolved_url;
  const url = await resolveGoogleNewsUrl(item.url);
  if (url) await sql`UPDATE news_items SET resolved_url = ${url} WHERE id = ${item.id}`.catch(() => {});
  return url || "";
}
