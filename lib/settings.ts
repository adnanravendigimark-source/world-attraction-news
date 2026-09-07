import { sql } from "./db";
import { SITE_NAME, SITE_TAGLINE, CONTACT_EMAIL } from "./site";

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

// An admin-curated, ordered list of category slugs for the public navbar's
// Categories dropdown (Admin -> Header) — the exact same pattern as
// getFeaturedCitySlugs()/setFeaturedCitySlugs() above, just for categories
// instead of cities. See getFeaturedCategories() in lib/categories.ts for
// the fallback behavior when nothing has been picked yet.
export async function getFeaturedCategorySlugs(): Promise<string[]> {
  try {
    const rows = await sql`SELECT featured_category_slugs FROM settings WHERE id = 1 LIMIT 1`;
    const raw: string = rows.length ? rows[0].featured_category_slugs || "" : "";
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export async function setFeaturedCategorySlugs(slugs: string[]): Promise<void> {
  const value = slugs.map((s) => s.trim()).filter(Boolean).join(",");
  await sql`
    INSERT INTO settings (id, featured_category_slugs) VALUES (1, ${value})
    ON CONFLICT (id) DO UPDATE SET featured_category_slugs = EXCLUDED.featured_category_slugs
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

// --- Contact page (fully admin-editable) ----------------------------------
// app/(public)/contact/page.tsx used to be a form (name/email/subject/
// message) that wrote to contact_messages and emailed a notification — no
// admin page ever read those messages back, so it was a write-only pipe
// nobody could see. Replaced with a simple "email us directly" card whose
// copy lives here. `email` is the one sitewide contact address, editable
// here from Admin -> Pages -> Contact — the About page reads this same
// value (see getAboutPageContactEmail below) rather than having its own
// separate editable copy, so there's still only one address to keep
// current. CONTACT_EMAIL from lib/site.ts is now only the fallback default
// for brand-new installs, not a hardcoded value pages render directly.
export interface ContactPageConfig {
  badgeText: string;
  heading: string;
  subtitle: string;
  email: string;
  emailCardLabel: string;
  replyNote: string;
}

export const DEFAULT_CONTACT_PAGE_CONFIG: ContactPageConfig = {
  badgeText: "CONTACT",
  heading: "Get in Touch",
  subtitle: "Questions about a story, a correction request, or a general inquiry — reach out directly.",
  email: CONTACT_EMAIL,
  emailCardLabel: "EMAIL US DIRECTLY",
  replyNote: "We typically reply within 1–2 business days.",
};

function normalizeContactPageConfig(raw: any): ContactPageConfig {
  if (!raw || typeof raw !== "object") return DEFAULT_CONTACT_PAGE_CONFIG;
  const str = (v: any, fallback: string) => (typeof v === "string" && v.trim() ? v : fallback);
  return {
    badgeText: str(raw.badgeText, DEFAULT_CONTACT_PAGE_CONFIG.badgeText),
    heading: str(raw.heading, DEFAULT_CONTACT_PAGE_CONFIG.heading),
    subtitle: str(raw.subtitle, DEFAULT_CONTACT_PAGE_CONFIG.subtitle),
    email: str(raw.email, DEFAULT_CONTACT_PAGE_CONFIG.email),
    emailCardLabel: str(raw.emailCardLabel, DEFAULT_CONTACT_PAGE_CONFIG.emailCardLabel),
    replyNote: str(raw.replyNote, DEFAULT_CONTACT_PAGE_CONFIG.replyNote),
  };
}

export async function getContactPageConfig(): Promise<ContactPageConfig> {
  try {
    const rows = await sql`SELECT contact_page_config FROM settings WHERE id = 1 LIMIT 1`;
    const raw = rows.length ? rows[0].contact_page_config : null;
    if (!raw) return DEFAULT_CONTACT_PAGE_CONFIG;
    return normalizeContactPageConfig(raw);
  } catch {
    return DEFAULT_CONTACT_PAGE_CONFIG;
  }
}

export async function setContactPageConfig(config: ContactPageConfig): Promise<ContactPageConfig> {
  const normalized = normalizeContactPageConfig(config);
  await sql`
    INSERT INTO settings (id, contact_page_config) VALUES (1, ${JSON.stringify(normalized)})
    ON CONFLICT (id) DO UPDATE SET contact_page_config = EXCLUDED.contact_page_config
  `;
  return normalized;
}

// --- About page (fully admin-editable) ------------------------------------
// Two things on this page stay genuinely live/computed rather than becoming
// admin text, because turning them into static copy would let them go
// stale the moment reality changes: the "Global City Bureaus" stat (always
// cities.length) and the "Active Destination Bureaus" city chip list
// (always the real cities). Everything else — hero copy, the other 3 stat
// cards, the numbered pillar sections, and both sidebar boxes — is here.
export interface AboutPageStat {
  value: string;
  label: string;
}

export interface AboutPagePillar {
  title: string;
  body: string;
}

export interface AboutPageConfig {
  badgeText: string;
  heading: string;
  subtitle: string;
  connectBoxTitle: string;
  connectBoxDescription: string;
  connectBoxButtonText: string;
  stats: AboutPageStat[];
  pillars: AboutPagePillar[];
  writeForUsBoxTitle: string;
  writeForUsBoxDescription: string;
  contactBoxTitle: string;
  contactBoxDescription: string;
}

export const DEFAULT_ABOUT_PAGE_CONFIG: AboutPageConfig = {
  badgeText: `ABOUT ${SITE_NAME}`.toUpperCase(),
  heading: "About Our Newsroom",
  subtitle: `${SITE_TAGLINE}. Delivering verified reporting, opening dates, and intelligence on theme parks and cultural landmarks globally.`,
  connectBoxTitle: "Connect With Us",
  connectBoxDescription: "Press inquiries, bureau partnerships, or news tips: reach out to our editorial desk.",
  connectBoxButtonText: "Email Editorial Desk",
  stats: [
    { value: "100%", label: "Independent Coverage" },
    { value: "24/7", label: "Continuous Wire" },
    { value: "0", label: "Sponsored Reviews" },
  ],
  pillars: [
    {
      title: "Our Philosophy & Mission",
      body: `${SITE_NAME} was established to solve a critical issue in modern travel journalism: automated AI aggregation and undisclosed promotional listicles. We run an independent global newsroom dedicated exclusively to verified reporting on attraction expansions, opening calendars, ticket pricing, and visitor intelligence.`,
    },
    {
      title: "Global Bureaus & Local Correspondents",
      body: "Rather than reporting remotely from a single desk, our dispatches are anchored in local tourist hubs. Each destination bureau provides first-hand coverage authored by correspondents living and researching in those regions.",
    },
    {
      title: "Strict Editorial Independence",
      body: "We do not accept paid reviews, undisclosed press trips, or sponsored placements. Every dispatch published undergoes rigorous editorial fact-checking, photo verification, and scoring before syndication.",
    },
  ],
  writeForUsBoxTitle: "Write for Attraction News",
  writeForUsBoxDescription:
    "Are you an attraction researcher, local correspondent, or travel journalist? Join our global contributor network.",
  contactBoxTitle: "Editorial Desk Contact",
  contactBoxDescription: "For press kits, corrections, or scoops:",
};

function normalizeAboutPageConfig(raw: any): AboutPageConfig {
  if (!raw || typeof raw !== "object") return DEFAULT_ABOUT_PAGE_CONFIG;
  const str = (v: any, fallback: string) => (typeof v === "string" && v.trim() ? v : fallback);
  return {
    badgeText: str(raw.badgeText, DEFAULT_ABOUT_PAGE_CONFIG.badgeText),
    heading: str(raw.heading, DEFAULT_ABOUT_PAGE_CONFIG.heading),
    subtitle: str(raw.subtitle, DEFAULT_ABOUT_PAGE_CONFIG.subtitle),
    connectBoxTitle: str(raw.connectBoxTitle, DEFAULT_ABOUT_PAGE_CONFIG.connectBoxTitle),
    connectBoxDescription: str(raw.connectBoxDescription, DEFAULT_ABOUT_PAGE_CONFIG.connectBoxDescription),
    connectBoxButtonText: str(raw.connectBoxButtonText, DEFAULT_ABOUT_PAGE_CONFIG.connectBoxButtonText),
    stats: Array.isArray(raw.stats)
      ? raw.stats
          .filter((s: any) => s && typeof s.value === "string" && typeof s.label === "string")
          .map((s: any) => ({ value: s.value, label: s.label }))
      : DEFAULT_ABOUT_PAGE_CONFIG.stats,
    pillars: Array.isArray(raw.pillars)
      ? raw.pillars
          .filter((p: any) => p && typeof p.title === "string" && typeof p.body === "string")
          .map((p: any) => ({ title: p.title, body: p.body }))
      : DEFAULT_ABOUT_PAGE_CONFIG.pillars,
    writeForUsBoxTitle: str(raw.writeForUsBoxTitle, DEFAULT_ABOUT_PAGE_CONFIG.writeForUsBoxTitle),
    writeForUsBoxDescription: str(raw.writeForUsBoxDescription, DEFAULT_ABOUT_PAGE_CONFIG.writeForUsBoxDescription),
    contactBoxTitle: str(raw.contactBoxTitle, DEFAULT_ABOUT_PAGE_CONFIG.contactBoxTitle),
    contactBoxDescription: str(raw.contactBoxDescription, DEFAULT_ABOUT_PAGE_CONFIG.contactBoxDescription),
  };
}

export async function getAboutPageConfig(): Promise<AboutPageConfig> {
  try {
    const rows = await sql`SELECT about_page_config FROM settings WHERE id = 1 LIMIT 1`;
    const raw = rows.length ? rows[0].about_page_config : null;
    if (!raw) return DEFAULT_ABOUT_PAGE_CONFIG;
    return normalizeAboutPageConfig(raw);
  } catch {
    return DEFAULT_ABOUT_PAGE_CONFIG;
  }
}

export async function setAboutPageConfig(config: AboutPageConfig): Promise<AboutPageConfig> {
  const normalized = normalizeAboutPageConfig(config);
  await sql`
    INSERT INTO settings (id, about_page_config) VALUES (1, ${JSON.stringify(normalized)})
    ON CONFLICT (id) DO UPDATE SET about_page_config = EXCLUDED.about_page_config
  `;
  return normalized;
}
