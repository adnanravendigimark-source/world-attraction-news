import { sql } from "./db";

// Real newsletter capture (no email-sending / campaign system attached —
// this just stores who asked to be notified, so the homepage/footer form
// isn't a dead end that discards what a reader submits). `source` records
// which form on the site captured the signup (e.g. "footer", "homepage",
// "article"), useful later for knowing what's actually driving signups.
export async function subscribeToNewsletter(email: string, source: string): Promise<{ alreadySubscribed: boolean }> {
  const existing = await sql`SELECT id FROM newsletter_subscribers WHERE email = ${email} LIMIT 1`;
  if (existing.length) return { alreadySubscribed: true };
  await sql`INSERT INTO newsletter_subscribers (email, source) VALUES (${email}, ${source})`;
  return { alreadySubscribed: false };
}
