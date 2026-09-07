import { sql } from "./db";

// --- Owner account password override -------------------------------------
// The .env ADMIN_EMAIL/ADMIN_PASSWORD "owner" login isn't a row in the
// users table, so its password can't be changed via lib/users.ts's normal
// setOwnPassword(). Instead the hash lives on the single-row `settings`
// table (id is always 1). An empty string means "no override set" —
// app/api/auth/admin-login/route.ts falls back to comparing against
// ADMIN_PASSWORD from the environment until the owner sets one here via
// Admin -> Settings.
//
// This table used to also hold sitewide SEO fallbacks and a "featured
// destinations" list (defaultMetaDescription, defaultOgImage, robotsDefault,
// featuredCitySlugs, gaMeasurementId, gscVerificationCode), managed from
// /admin/settings via SiteSettingsForm + SeoSettingsForm. Those were removed
// — every article and city already has its own meta title/description/focus
// keyword, the homepage's indexing is covered by the same per-page Indexing
// admin override every other page uses, and Analytics/Search Console were
// never configured. Their DB columns (default_meta_description,
// default_og_image, robots_default, featured_city_slugs, ga_measurement_id,
// gsc_verification_code) are left in place, unused, exactly like any other
// retired column — dropping a live column is a separate, deliberate call.
export async function getOwnerPasswordHash(): Promise<string> {
  try {
    const rows = await sql`SELECT owner_password_hash FROM settings WHERE id = 1 LIMIT 1`;
    return rows.length ? rows[0].owner_password_hash || "" : "";
  } catch {
    return "";
  }
}

export async function setOwnerPasswordHash(hash: string): Promise<void> {
  await sql`
    INSERT INTO settings (id, owner_password_hash) VALUES (1, ${hash})
    ON CONFLICT (id) DO UPDATE SET owner_password_hash = EXCLUDED.owner_password_hash
  `;
}
