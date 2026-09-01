import { sql } from "./db";
import { hashPassword, verifyPassword } from "./passwords";
import { hashResetToken } from "./tokens";

export type UserRole = "admin" | "contributor";
// "suspended" is distinct from "rejected": rejected means a registration
// was never approved in the first place; suspended means a previously
// approved contributor has since been blocked. Both block login the same
// way (see verifyUserCredentials callers), but the Admin Panel shows a
// different action set and message for each.
export type UserStatus = "pending" | "approved" | "rejected" | "suspended";
export type AuthProvider = "password" | "google";

export interface User {
  id: string;
  email: string;
  passwordHash: string | null;
  role: UserRole;
  status: UserStatus;
  displayName: string;
  bio: string;
  cityId: string | null;
  authProvider: AuthProvider;
  googleId: string | null;
  avatarUrl: string;
  lastLoginAt: string | null;
  createdAt: string;
  approvedAt: string | null;
}

// Public shape (no password hash, no reset-token internals) — safe to send
// to the browser.
export interface SafeUser {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  displayName: string;
  bio: string;
  cityId: string | null;
  authProvider: AuthProvider;
  googleId: string | null;
  avatarUrl: string;
  lastLoginAt: string | null;
  createdAt: string;
  approvedAt: string | null;
}

function toSafe({ passwordHash, ...rest }: User): SafeUser {
  return rest;
}

// Exported so pages that already fetched a full User (e.g. the admin user
// detail page, via findUserById) can hand a browser-safe shape down to a
// client component without a second query.
export function toSafeUser(user: User): SafeUser {
  return toSafe(user);
}

function rowToUser(row: any): User {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    status: row.status,
    displayName: row.display_name,
    bio: row.bio,
    cityId: row.city_id,
    authProvider: (row.auth_provider as AuthProvider) || "password",
    googleId: row.google_id,
    avatarUrl: row.avatar_url || "",
    lastLoginAt: row.last_login_at
      ? row.last_login_at instanceof Date
        ? row.last_login_at.toISOString()
        : String(row.last_login_at)
      : null,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    approvedAt: row.approved_at
      ? row.approved_at instanceof Date
        ? row.approved_at.toISOString()
        : String(row.approved_at)
      : null,
  };
}

export async function getUsers(): Promise<User[]> {
  try {
    const rows = await sql`SELECT * FROM users ORDER BY created_at DESC`;
    return rows.map(rowToUser);
  } catch {
    return [];
  }
}

export async function getContributors(): Promise<User[]> {
  const rows = await sql`SELECT * FROM users WHERE role = 'contributor' ORDER BY created_at DESC`;
  return rows.map(rowToUser);
}

export async function findUserByEmail(email: string): Promise<User | undefined> {
  const rows = await sql`SELECT * FROM users WHERE lower(email) = lower(${email}) LIMIT 1`;
  return rows.length ? rowToUser(rows[0]) : undefined;
}

export async function findUserById(id: string): Promise<User | undefined> {
  const rows = await sql`SELECT * FROM users WHERE id = ${id} LIMIT 1`;
  return rows.length ? rowToUser(rows[0]) : undefined;
}

export async function findUserByGoogleId(googleId: string): Promise<User | undefined> {
  const rows = await sql`SELECT * FROM users WHERE google_id = ${googleId} LIMIT 1`;
  return rows.length ? rowToUser(rows[0]) : undefined;
}

// Public signup — always creates a "contributor" with status "pending".
// Role escalation to "admin" is never available through this path; only an
// existing admin can promote a user, and only from the Admin Panel.
//
// No city is collected or assigned at signup — a contributor isn't tied to
// one city. They choose which city each article belongs to at submission
// time (see lib/articles.ts createArticle), so one approved contributor can
// write about any city on the site.
export async function registerContributor(input: {
  email: string;
  password: string;
  displayName: string;
  bio: string;
}): Promise<SafeUser> {
  const existing = await findUserByEmail(input.email);
  if (existing) throw new Error("An account with this email already exists.");
  const passwordHash = hashPassword(input.password);
  const rows = await sql`
    INSERT INTO users (email, password_hash, role, status, display_name, bio, auth_provider)
    VALUES (${input.email}, ${passwordHash}, 'contributor', 'pending', ${input.displayName}, ${input.bio}, 'password')
    RETURNING *
  `;
  return toSafe(rowToUser(rows[0]));
}

// Google one-click sign up / login — a single entry point for both cases:
//   - No account with this Google ID or email exists yet -> create a new
//     "pending" contributor (auth_provider 'google', no password). Same
//     approval gate as password signup: this does NOT log the person in.
//   - An account already exists with this Google ID -> return it as-is.
//   - An account already exists with this *email* (e.g. they originally
//     signed up with a password) -> link the Google ID to that existing
//     account (safe because Google's email_verified claim was checked by
//     the caller) rather than creating a duplicate account.
// The route handler is responsible for checking the returned user's status
// before issuing a session — this function never logs anyone in itself.
export async function findOrCreateGoogleUser(profile: {
  googleId: string;
  email: string;
  name: string;
  avatarUrl: string;
}): Promise<{ user: User; isNewAccount: boolean }> {
  const byGoogleId = await findUserByGoogleId(profile.googleId);
  if (byGoogleId) return { user: byGoogleId, isNewAccount: false };

  const byEmail = await findUserByEmail(profile.email);
  if (byEmail) {
    const rows = await sql`
      UPDATE users
      SET google_id = ${profile.googleId},
          avatar_url = CASE WHEN avatar_url = '' THEN ${profile.avatarUrl} ELSE avatar_url END
      WHERE id = ${byEmail.id}
      RETURNING *
    `;
    return { user: rowToUser(rows[0]), isNewAccount: false };
  }

  const rows = await sql`
    INSERT INTO users (email, password_hash, role, status, display_name, bio, auth_provider, google_id, avatar_url)
    VALUES (${profile.email}, NULL, 'contributor', 'pending', ${profile.name || profile.email}, '', 'google', ${profile.googleId}, ${profile.avatarUrl})
    RETURNING *
  `;
  return { user: rowToUser(rows[0]), isNewAccount: true };
}

export async function updateUser(
  id: string,
  updates: {
    status?: UserStatus;
    cityId?: string | null;
    role?: UserRole;
    displayName?: string;
    bio?: string;
    password?: string;
  }
): Promise<SafeUser> {
  const current = await findUserById(id);
  if (!current) throw new Error("User not found.");

  const nextStatus = updates.status ?? current.status;
  const nextCityId = updates.cityId !== undefined ? updates.cityId : current.cityId;
  const nextRole = updates.role ?? current.role;
  const nextDisplayName = updates.displayName ?? current.displayName;
  const nextBio = updates.bio ?? current.bio;
  const nextPasswordHash = updates.password ? hashPassword(updates.password) : current.passwordHash;
  // approved_at is set the first time status transitions into "approved",
  // and left alone on any later edit (so re-saving an already-approved
  // user's city assignment doesn't bump the timestamp).
  const shouldStampApproval = nextStatus === "approved" && current.approvedAt === null;

  const rows = await sql`
    UPDATE users
    SET status = ${nextStatus},
        city_id = ${nextCityId},
        role = ${nextRole},
        display_name = ${nextDisplayName},
        bio = ${nextBio},
        password_hash = ${nextPasswordHash},
        approved_at = CASE WHEN ${shouldStampApproval} THEN now() ELSE approved_at END
    WHERE id = ${id}
    RETURNING *
  `;
  return toSafe(rowToUser(rows[0]));
}

// Self-service profile update (display name + bio only) — a contributor
// editing their own account from /dashboard/profile. Never touches role,
// status, or email — those stay admin/signup-only.
export async function updateOwnProfile(
  id: string,
  updates: { displayName?: string; bio?: string }
): Promise<SafeUser> {
  const current = await findUserById(id);
  if (!current) throw new Error("User not found.");
  const rows = await sql`
    UPDATE users
    SET display_name = ${updates.displayName ?? current.displayName},
        bio = ${updates.bio ?? current.bio}
    WHERE id = ${id}
    RETURNING *
  `;
  return toSafe(rowToUser(rows[0]));
}

// Self-service password change — requires the current password to already
// match (checked by the caller via verifyPassword before calling this).
// Google-only accounts (no password_hash yet) can use this to *set* their
// first password, which is why there's no "must already have one" guard
// here — that decision lives in the route handler.
export async function setOwnPassword(id: string, newPassword: string): Promise<void> {
  const passwordHash = hashPassword(newPassword);
  await sql`UPDATE users SET password_hash = ${passwordHash} WHERE id = ${id}`;
}

export async function deleteUser(id: string): Promise<void> {
  await sql`DELETE FROM users WHERE id = ${id}`;
}

// Used by both the Admin Panel login (role must be "admin") and the
// contributor login (role must be "contributor" AND status "approved") —
// the route handlers enforce which is which; this just checks the password.
// A Google-only account has no password_hash, so this correctly fails
// closed (never a match) rather than throwing.
export async function verifyUserCredentials(email: string, password: string): Promise<SafeUser | null> {
  const user = await findUserByEmail(email);
  if (!user || !user.passwordHash) return null;
  if (!verifyPassword(password, user.passwordHash)) return null;
  return toSafe(user);
}

// Called on every successful login (password, Google, or admin) — used by
// /admin/users/[id] to show "last login" and by the Admin Overview's
// activity picture. Best-effort: a failure here should never block an
// otherwise-successful login.
export async function touchLastLogin(id: string): Promise<void> {
  try {
    await sql`UPDATE users SET last_login_at = now() WHERE id = ${id}`;
  } catch {
    // non-critical
  }
}

// --- Password reset ------------------------------------------------------

// Always call this for any submitted email, whether or not an account
// exists — the route handler responds identically either way, so a caller
// can't use "was a reset token issued" to enumerate registered emails.
export async function setPasswordResetToken(
  email: string,
  tokenHash: string,
  expiresAt: Date
): Promise<User | undefined> {
  const user = await findUserByEmail(email);
  if (!user) return undefined;
  await sql`
    UPDATE users SET reset_token = ${tokenHash}, reset_token_expires = ${expiresAt.toISOString()}
    WHERE id = ${user.id}
  `;
  return user;
}

export async function consumePasswordResetToken(rawToken: string, newPassword: string): Promise<boolean> {
  const tokenHash = hashResetToken(rawToken);
  const rows = await sql`
    SELECT * FROM users
    WHERE reset_token = ${tokenHash} AND reset_token_expires > now()
    LIMIT 1
  `;
  if (!rows.length) return false;
  const passwordHash = hashPassword(newPassword);
  await sql`
    UPDATE users
    SET password_hash = ${passwordHash}, reset_token = NULL, reset_token_expires = NULL
    WHERE id = ${rows[0].id}
  `;
  return true;
}
