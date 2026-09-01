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

export async function createSessionToken(session: Session): Promise<string> {
  const payload = toBase64Url(JSON.stringify(session));
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
