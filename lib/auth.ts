// Session token signing/verification — uses Web Crypto (not Node's
// `crypto` module) because this file is imported by both API routes AND
// `middleware.ts`, which runs on the Edge runtime and doesn't have Node's
// crypto module available.
//
// The dev-only fallback below exists purely so `npm run dev` works before a
// developer has copied .env.example to .env — it must never be what a real
// deployment runs on. This value is public (it's sitting right here in the
// repo), so any session signed with it is forgeable by anyone who's ever
// seen this file: they can mint themselves a valid admin session token
// without ever touching the database or a password. Refusing to boot
// without a real SESSION_SECRET in production is the only way to guarantee
// that never happens silently.
const SECRET = process.env.SESSION_SECRET || "attraction-travel-news-dev-secret-change-me";
if (!process.env.SESSION_SECRET && process.env.NODE_ENV === "production") {
  throw new Error(
    "SESSION_SECRET is not set. Refusing to start in production with the public fallback secret — every session " +
      "would be forgeable. Set a long, random SESSION_SECRET in your environment (see .env.example)."
  );
}
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

// Plain `===` on two strings short-circuits at the first differing
// character, which leaks (via response timing) how many leading characters
// of a guessed signature were correct — a textbook timing side-channel.
// Comparing every character regardless of an early mismatch, and folding
// the whole thing through XOR, means the time this takes doesn't depend on
// where (or whether) the strings differ.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function verifySessionToken(token: string | undefined | null): Promise<Session | null> {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = await sign(payload);
  if (!timingSafeEqual(expected, sig)) return null;
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

export interface MagicTokenPayload {
  userId: string;
  email: string;
  action: string;
  next?: string;
  exp: number;
}

// Single-use or direct onboarding/magic-link token used in transactional
// emails (e.g. account approved notifications). Cryptographically signed with
// HMAC SHA-256 and expires automatically.
export async function createMagicToken(
  data: { userId: string; email: string; action?: string; next?: string },
  maxAgeSeconds = 60 * 60 * 24 * 7 // 7 days
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + maxAgeSeconds;
  const payload = toBase64Url(
    JSON.stringify({
      userId: data.userId,
      email: data.email,
      action: data.action || "magic_login",
      next: data.next || "/contributor/profile",
      exp,
    })
  );
  const sig = await sign(payload);
  return `${payload}.${sig}`;
}

export async function verifyMagicToken(token: string | undefined | null): Promise<MagicTokenPayload | null> {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = await sign(payload);
  if (!timingSafeEqual(expected, sig)) return null;
  try {
    const parsed = JSON.parse(fromBase64Url(payload));
    if (!parsed?.userId || !parsed?.email) {
      return null;
    }
    if (typeof parsed.exp === "number" && Math.floor(Date.now() / 1000) >= parsed.exp) {
      return null;
    }
    return {
      userId: parsed.userId,
      email: parsed.email,
      action: parsed.action || "magic_login",
      next: parsed.next || "/contributor/profile",
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}

