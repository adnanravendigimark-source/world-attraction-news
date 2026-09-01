import { sql } from "./db";

// Single-row site settings (id is always 1) — sitewide SEO fallbacks and a
// small set of genuinely-wired public-content defaults, managed from
// /admin/seo and /admin/settings. Per-page SEO (city/article meta title,
// description, focus keyword) still lives on those records directly and
// always wins over these fallbacks — this table only fills in what a page
// didn't set itself.
export interface SiteSettings {
  homepageIntroOverride: string;
  defaultMetaDescription: string;
  defaultOgImage: string;
  robotsDefault: "index" | "noindex";
  featuredCitySlugs: string[];
  moderationNote: string;
  updatedAt: string;
}

const FALLBACK: SiteSettings = {
  homepageIntroOverride: "",
  defaultMetaDescription: "",
  defaultOgImage: "",
  robotsDefault: "index",
  featuredCitySlugs: [],
  moderationNote: "",
  updatedAt: "",
};

function rowToSettings(row: any): SiteSettings {
  return {
    homepageIntroOverride: row.homepage_intro_override || "",
    defaultMetaDescription: row.default_meta_description || "",
    defaultOgImage: row.default_og_image || "",
    robotsDefault: row.robots_default === "noindex" ? "noindex" : "index",
    featuredCitySlugs: (row.featured_city_slugs || "")
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean),
    moderationNote: row.moderation_note || "",
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
  const next = { ...current, ...updates };
  const rows = await sql`
    INSERT INTO settings (id, homepage_intro_override, default_meta_description, default_og_image, robots_default, featured_city_slugs, moderation_note, updated_at)
    VALUES (1, ${next.homepageIntroOverride}, ${next.defaultMetaDescription}, ${next.defaultOgImage}, ${next.robotsDefault}, ${next.featuredCitySlugs.join(", ")}, ${next.moderationNote}, now())
    ON CONFLICT (id) DO UPDATE SET
      homepage_intro_override = EXCLUDED.homepage_intro_override,
      default_meta_description = EXCLUDED.default_meta_description,
      default_og_image = EXCLUDED.default_og_image,
      robots_default = EXCLUDED.robots_default,
      featured_city_slugs = EXCLUDED.featured_city_slugs,
      moderation_note = EXCLUDED.moderation_note,
      updated_at = now()
    RETURNING *
  `;
  return rowToSettings(rows[0]);
}
