import crypto from "crypto";

// Password-reset tokens: the raw token goes out in the email link, only its
// SHA-256 hash is ever stored in the database. Even a full read of the
// users table (a DB leak) never exposes a usable token — matches the same
// "never store the secret in plain text" principle as password hashing.
export function generateResetToken(): { raw: string; hash: string; expiresAt: Date } {
  const raw = crypto.randomBytes(32).toString("hex");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  return { raw, hash, expiresAt };
}

export function hashResetToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

// Random, unguessable value used as the Google OAuth `state` parameter —
// stored in a short-lived cookie and compared to what Google echoes back
// on the callback, so a callback request that didn't originate from our
// own redirect (CSRF) is rejected.
export function generateOAuthState(): string {
  return crypto.randomBytes(24).toString("hex");
}
