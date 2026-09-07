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
// This table used to also hold sitewide SEO fallbacks (defaultMetaDescription,
// defaultOgImage, robotsDefault, gaMeasurementId, gscVerificationCode),
// managed from /admin/settings via SiteSettingsForm + SeoSettingsForm. Those
// were removed — every article and city already has its own meta
// title/description/focus keyword, the homepage's indexing is covered by the
// same per-page Indexing admin override every other page uses, and
// Analytics/Search Console were never configured. Their DB columns
// (default_meta_description, default_og_image, robots_default,
// ga_measurement_id, gsc_verification_code) are left in place, unused,
// exactly like any other retired column — dropping a live column is a
// separate, deliberate call.
//
// `featured_city_slugs` is the one column from that same original set that
// IS back in active use — see getFeaturedCitySlugs()/setFeaturedCitySlugs()
// below, which power the admin-curated "Top Destinations" navbar dropdown.
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

// --- Top Destinations (public navbar dropdown) ---------------------------
// An admin-curated, ordered list of city slugs — reusing the
// `featured_city_slugs` column that already existed on this table (see the
// removal note above; the column itself was always left in place). Storage
// is a simple comma-separated list of slugs in display order. No slug
// validation happens here — a slug for a since-deleted city is simply
// skipped by the reader (see getFeaturedCities() in lib/cities.ts), so a
// stale entry never breaks the public site, it just silently drops out.
export async function getFeaturedCitySlugs(): Promise<string[]> {
  try {
    const rows = await sql`SELECT featured_city_slugs FROM settings WHERE id = 1 LIMIT 1`;
    const raw: string = rows.length ? rows[0].featured_city_slugs || "" : "";
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export async function setFeaturedCitySlugs(slugs: string[]): Promise<void> {
  const value = slugs.map((s) => s.trim()).filter(Boolean).join(",");
  await sql`
    INSERT INTO settings (id, featured_city_slugs) VALUES (1, ${value})
    ON CONFLICT (id) DO UPDATE SET featured_city_slugs = EXCLUDED.featured_city_slugs
  `;
}

// --- Public footer (fully admin-editable) ---------------------------------
// Every piece of content components/PublicFooter.tsx renders — the About
// blurb, the social icon links, every link column, and the copyright line —
// comes from here instead of being hardcoded. Stored as one JSONB blob
// (footer_config) since it's always read/written as a whole from a single
// Admin -> Footer page, not queried piecemeal.
export interface FooterLink {
  label: string;
  href: string;
}

export interface FooterColumn {
  title: string;
  links: FooterLink[];
}

export interface FooterSocialLinks {
  facebook: string;
  twitter: string;
  instagram: string;
  youtube: string;
}

export interface FooterConfig {
  about: string;
  social: FooterSocialLinks;
  columns: FooterColumn[];
  // May contain the literal placeholder "{year}", replaced with the current
  // year at render time so the copyright line never goes stale on its own.
  copyrightText: string;
}

// Exactly what components/PublicFooter.tsx used to hardcode — a site that
// never touches Admin -> Footer, or one running against a database from
// before this column existed, renders an identical footer to before.
export const DEFAULT_FOOTER_CONFIG: FooterConfig = {
  about:
    "Your trusted source for the latest news and updates from the world's top attractions and destinations.",
  social: {
    facebook: "https://facebook.com",
    twitter: "https://x.com",
    instagram: "https://instagram.com",
    youtube: "https://youtube.com",
  },
  columns: [
    {
      title: "EXPLORE",
      links: [
        { label: "Destinations", href: "/destinations" },
        { label: "Attractions", href: "/destinations" },
        { label: "Categories", href: "/categories" },
        { label: "About Us", href: "/about" },
      ],
    },
    {
      title: "RESOURCES",
      links: [
        { label: "Write For Us", href: "/write-for-us" },
        { label: "Contact Us", href: "/contact" },
        { label: "Privacy Policy", href: "/privacy-policy" },
        { label: "Terms & Conditions", href: "/terms-and-conditions" },
      ],
    },
    {
      title: "POPULAR CATEGORIES",
      links: [
        { label: "Theme Parks", href: "/categories/theme-parks" },
        { label: "Water Parks", href: "/categories/water-parks" },
        { label: "Zoos & Aquariums", href: "/categories/zoos-and-aquariums" },
        { label: "Museums", href: "/categories/museums" },
        { label: "Landmarks", href: "/categories/landmarks" },
      ],
    },
  ],
  copyrightText: "© {year} {siteName}. All rights reserved.",
};

function normalizeFooterConfig(raw: any): FooterConfig {
  if (!raw || typeof raw !== "object") return DEFAULT_FOOTER_CONFIG;
  return {
    about: typeof raw.about === "string" ? raw.about : DEFAULT_FOOTER_CONFIG.about,
    social: {
      facebook: typeof raw.social?.facebook === "string" ? raw.social.facebook : "",
      twitter: typeof raw.social?.twitter === "string" ? raw.social.twitter : "",
      instagram: typeof raw.social?.instagram === "string" ? raw.social.instagram : "",
      youtube: typeof raw.social?.youtube === "string" ? raw.social.youtube : "",
    },
    columns: Array.isArray(raw.columns)
      ? raw.columns.map((col: any) => ({
          title: typeof col?.title === "string" ? col.title : "",
          links: Array.isArray(col?.links)
            ? col.links
                .filter((l: any) => l && typeof l.label === "string" && typeof l.href === "string")
                .map((l: any) => ({ label: l.label, href: l.href }))
            : [],
        }))
      : DEFAULT_FOOTER_CONFIG.columns,
    copyrightText:
      typeof raw.copyrightText === "string" && raw.copyrightText.trim()
        ? raw.copyrightText
        : DEFAULT_FOOTER_CONFIG.copyrightText,
  };
}

export async function getFooterConfig(): Promise<FooterConfig> {
  try {
    const rows = await sql`SELECT footer_config FROM settings WHERE id = 1 LIMIT 1`;
    const raw = rows.length ? rows[0].footer_config : null;
    if (!raw) return DEFAULT_FOOTER_CONFIG;
    return normalizeFooterConfig(raw);
  } catch {
    return DEFAULT_FOOTER_CONFIG;
  }
}

export async function setFooterConfig(config: FooterConfig): Promise<FooterConfig> {
  const normalized = normalizeFooterConfig(config);
  await sql`
    INSERT INTO settings (id, footer_config) VALUES (1, ${JSON.stringify(normalized)})
    ON CONFLICT (id) DO UPDATE SET footer_config = EXCLUDED.footer_config
  `;
  return normalized;
}
