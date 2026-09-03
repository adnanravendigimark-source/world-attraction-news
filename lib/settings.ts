import { sql } from "./db";

// Single-row site settings (id is always 1) — sitewide SEO fallbacks plus
// the one genuinely-wired general site default (featured cities), managed
// from /admin/seo and /admin/settings respectively. Per-page SEO
// (city/article meta title, description, focus keyword) still lives on
// those records directly and always wins over these fallbacks — this table
// only fills in what a page didn't set itself.
//
// Two fields that used to live here — a "homepage intro override" and an
// "internal newsroom rubric note" — were removed. Neither was ever read by
// any page: the homepage has no rendered subtitle/tagline area to put an
// intro override into, and nothing on the Article Review page displayed the
// moderation note. Rather than keep a form field that silently saves into a
// black hole, they were dropped. Their DB columns (homepage_intro_override,
// moderation_note) are left in place, unused, exactly like any other
// retired column — dropping a live column is a separate, deliberate call.
export interface SiteSettings {
  defaultMetaDescription: string;
  defaultOgImage: string;
  robotsDefault: "index" | "noindex";
  featuredCitySlugs: string[];
  gaMeasurementId: string;
  gscVerificationCode: string;
  updatedAt: string;
}

const FALLBACK: SiteSettings = {
  defaultMetaDescription: "",
  defaultOgImage: "",
  robotsDefault: "index",
  featuredCitySlugs: [],
  gaMeasurementId: "",
  gscVerificationCode: "",
  updatedAt: "",
};

function rowToSettings(row: any): SiteSettings {
  return {
    defaultMetaDescription: row.default_meta_description || "",
    defaultOgImage: row.default_og_image || "",
    robotsDefault: row.robots_default === "noindex" ? "noindex" : "index",
    featuredCitySlugs: (row.featured_city_slugs || "")
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean),
    gaMeasurementId: row.ga_measurement_id || "",
    gscVerificationCode: row.gsc_verification_code || "",
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at || ""),
  };
}

// Reads fail soft to sensible defaults (e.g. before the migration/seed has
// run) rather than breaking every page that calls this for SEO fallbacks.
export async function getSettings(): Promise<SiteSettings> {
  try {
    const rows = await sql`SELECT * FROM settings WHERE id = 1 LIMIT 1`;
    return rows.length ? rowToSettings(rows[0]) : FALLBACK;
  } catch {
    return FALLBACK;
  }
}

export async function updateSettings(updates: Partial<Omit<SiteSettings, "updatedAt">>): Promise<SiteSettings> {
  const current = await getSettings();
  // Per-field `??` merge, not `{ ...current, ...updates }` — the API route
  // (deliberately) sends every field's key with an explicit `undefined`
  // value for whatever the calling form didn't include, since
  // SiteSettingsForm (/admin/settings) and SeoSettingsForm (/admin/seo)
  // each only submit their own subset of these fields. An object spread
  // would still overwrite `current`'s real value with `undefined` for every
  // key present-but-undefined on `updates`, so saving one form would
  // silently blank out the other form's fields on the very next save.
  const next: Omit<SiteSettings, "updatedAt"> = {
    defaultMetaDescription: updates.defaultMetaDescription ?? current.defaultMetaDescription,
    defaultOgImage: updates.defaultOgImage ?? current.defaultOgImage,
    robotsDefault: updates.robotsDefault ?? current.robotsDefault,
    featuredCitySlugs: updates.featuredCitySlugs ?? current.featuredCitySlugs,
    gaMeasurementId: updates.gaMeasurementId ?? current.gaMeasurementId,
    gscVerificationCode: updates.gscVerificationCode ?? current.gscVerificationCode,
  };
  const rows = await sql`
    INSERT INTO settings (id, default_meta_description, default_og_image, robots_default, featured_city_slugs, ga_measurement_id, gsc_verification_code, updated_at)
    VALUES (1, ${next.defaultMetaDescription}, ${next.defaultOgImage}, ${next.robotsDefault}, ${next.featuredCitySlugs.join(", ")}, ${next.gaMeasurementId}, ${next.gscVerificationCode}, now())
    ON CONFLICT (id) DO UPDATE SET
      default_meta_description = EXCLUDED.default_meta_description,
      default_og_image = EXCLUDED.default_og_image,
      robots_default = EXCLUDED.robots_default,
      featured_city_slugs = EXCLUDED.featured_city_slugs,
      ga_measurement_id = EXCLUDED.ga_measurement_id,
      gsc_verification_code = EXCLUDED.gsc_verification_code,
      updated_at = now()
    RETURNING *
  `;
  return rowToSettings(rows[0]);
}

// --- Owner account password override -------------------------------------
// The .env ADMIN_EMAIL/ADMIN_PASSWORD "owner" login isn't a row in the
// users table, so its password can't be changed via lib/users.ts's normal
// setOwnPassword(). Instead the hash lives on this same single-row settings
// table (kept deliberately separate from SiteSettings/updateSettings above
// so the generic site-settings form can never touch it). An empty string
// means "no override set" — app/api/auth/admin-login/route.ts falls back to
// comparing against ADMIN_PASSWORD from the environment until the owner
// sets one here via Admin -> Settings.
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
