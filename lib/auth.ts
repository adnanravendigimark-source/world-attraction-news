// Session token signing/verification — uses Web Crypto (not Node's
// `crypto` module) because this file is imported by both API routes AND
// `middleware.ts`, which runs on the Edge runtime and doesn't have Node's
// crypto module available.
const SECRET = process.env.SESSION_SECRET || "attraction-travel-news-dev-secret-change-me";
export const SESSION_COOKIE_NAME = "atn_session";

export type SessionRole = "admin" | "contributor";

export interface Session {
  userId: string;
  email: string;
  role: SessionRole;
  displayName: string;
  cityId: string | null;
}

async function getKey() {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

function toBase64Url(input: string | ArrayBuffer) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(input: string) {
  const bin = atob(input.replace(/-/g, "+").replace(/_/g, "/"));
  return bin;
}

async function sign(payload: string) {
  const key = await getKey();
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return toBase64Url(sigBuf);
}

// `maxAgeSeconds` bakes an expiry into the signed payload itself, matching
// the cookie's own `maxAge` at each call site (7 days for contributor/Google
// login, 8 hours for admin login). Without this, the cookie's browser-
// enforced expiry was the *only* thing limiting a token's lifetime — a raw
// token string copied out of the cookie (e.g. via an XSS bug, a leaked log
// line, or a shared machine) would verify successfully forever if replayed
// directly against the API, since verifySessionToken() never checked time.
// Baking `exp` into the signed payload closes that: the signature covers
// the expiry too, so it can't be stripped or extended without invalidating
// the signature.
export async function createSessionToken(session: Session, maxAgeSeconds: number): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + maxAgeSeconds;
  const payload = toBase64Url(JSON.stringify({ ...session, exp }));
  const sig = await sign(payload);
  return `${payload}.${sig}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<Session | null> {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = await sign(payload);
  if (expected !== sig) return null;
  try {
    const parsed = JSON.parse(fromBase64Url(payload));
    if (!parsed?.userId || !parsed?.email || (parsed.role !== "admin" && parsed.role !== "contributor")) {
      return null;
    }
    if (typeof parsed.exp === "number" && Math.floor(Date.now() / 1000) >= parsed.exp) {
      return null;
    }
    return {
      userId: parsed.userId,
      email: parsed.email,
      role: parsed.role,
      displayName: parsed.displayName || "",
      cityId: parsed.cityId ?? null,
    };
  } catch {
    return null;
  }
}
