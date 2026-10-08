// Fetch a public web page and reduce it to readable text for research.
// The text is held in memory for one LLM call and never stored.

const UA = "WorldAttractionNewsBot/1.0 (+research; contact via site)";
const MAX_BYTES = 1_500_000;
const MAX_CHARS = 14000;

// Block obviously private/internal targets. Feed URLs are untrusted input, so
// never let research follow a link into the host's own network. (Hostname
// check only; it doesn't defend against DNS rebinding.)
export function isPublicUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".lan")) return false;
  if (h === "::1" || h.startsWith("[")) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    const [a, b] = h.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return false;
  }
  return true;
}

// Google News RSS links are JS-driven redirects; the real article can't be
// fetched without a browser, so research uses the feed's headline instead.
export function isGoogleNewsRedirect(raw: string): boolean {
  try {
    return new URL(raw).hostname === "news.google.com";
  } catch {
    return false;
  }
}

function decode(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&rsquo;|&#8217;/g, "’")
    .replace(/&ndash;|&#8211;/g, "–")
    .replace(/&mdash;|&#8212;/g, "—")
    .replace(/&#(\d+);/g, (_, n) => {
      try {
        return String.fromCodePoint(Number(n));
      } catch {
        return " ";
      }
    });
}

export function htmlToText(html: string): { title: string; text: string } {
  const title = decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").replace(/\s+/g, " ").trim());
  let body = html.replace(/<(script|style|noscript|svg|iframe|form|header|footer|nav|aside)\b[\s\S]*?<\/\1>/gi, " ");
  // Prefer the article element when present.
  const article = body.match(/<article\b[\s\S]*?<\/article>/i)?.[0];
  if (article && article.length > 800) body = article;
  const paras = [...body.matchAll(/<(p|h1|h2|h3|li)\b[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map((m) => decode(m[2].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim())
    .filter((t) => t.length > 40)
    .filter((t) => !/^(cookie|accept|subscribe|sign up|advertisement|follow us|share this)/i.test(t));
  const text = paras.join("\n").slice(0, MAX_CHARS);
  return { title, text };
}

export interface FetchedPage {
  ok: boolean;
  finalUrl: string;
  title: string;
  text: string;
  error?: string;
}

export async function fetchPageText(url: string): Promise<FetchedPage> {
  let current = url;
  try {
    for (let hop = 0; hop < 4; hop++) {
      if (!isPublicUrl(current)) return { ok: false, finalUrl: current, title: "", text: "", error: "Blocked or invalid URL." };
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12_000);
      let res: Response;
      try {
        res = await fetch(current, {
          headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
          redirect: "manual",
          signal: ctrl.signal,
          cache: "no-store",
        });
      } finally {
        clearTimeout(timer);
      }
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) return { ok: false, finalUrl: current, title: "", text: "", error: "Redirect without location." };
        current = new URL(loc, current).toString();
        continue;
      }
      if (!res.ok) return { ok: false, finalUrl: current, title: "", text: "", error: `HTTP ${res.status}` };
      const type = res.headers.get("content-type") || "";
      if (!/html|xml|text/i.test(type)) return { ok: false, finalUrl: current, title: "", text: "", error: "Not an HTML page." };
      const buf = await res.arrayBuffer();
      if (buf.byteLength > MAX_BYTES) return { ok: false, finalUrl: current, title: "", text: "", error: "Page too large." };
      const { title, text } = htmlToText(new TextDecoder("utf-8").decode(buf));
      if (text.length < 200) return { ok: false, finalUrl: current, title, text: "", error: "No readable article text (may be paywalled or script-rendered)." };
      return { ok: true, finalUrl: current, title, text };
    }
    return { ok: false, finalUrl: current, title: "", text: "", error: "Too many redirects." };
  } catch (err: any) {
    return { ok: false, finalUrl: current, title: "", text: "", error: err?.name === "AbortError" ? "Timed out." : String(err?.message || err).slice(0, 120) };
  }
}
