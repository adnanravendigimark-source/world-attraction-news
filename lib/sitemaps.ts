import { sql } from "./db";
import { SITE_URL } from "./site";
import { getCountryHubs } from "./countryHubs";
import { getCities } from "./cities";
import { getCategories } from "./categories";
import { getPublishedArticles } from "./articles";
import { countryPath, cityPath, articlePath } from "./destinations";
import { SITEMAP_TYPES, SITEMAP_TYPE_LABELS, type SitemapType, type SitemapUrlEntry } from "./sitemapTypes";

// --- Sitemap configuration (the `sitemaps` table) ----------------------
// See scripts/setup-db.mjs's createSitemapsTable() for the schema and the
// 5 seeded default rows. SitemapType/SITEMAP_TYPES/SITEMAP_TYPE_LABELS/
// SitemapUrlEntry live in ./sitemapTypes (not here) so a "use client" admin
// component can value-import them without pulling this whole server module
// (DB queries, lib/articles.ts, etc.) into the browser bundle — re-exported
// below so every existing server-side import site (`from "@/lib/sitemaps"`)
// keeps working unchanged.
export { SITEMAP_TYPES, SITEMAP_TYPE_LABELS, type SitemapType, type SitemapUrlEntry };

export interface SitemapConfig {
  id: string;
  name: string;
  type: SitemapType;
  path: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

function rowToSitemap(row: any): SitemapConfig {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    path: row.path,
    enabled: Boolean(row.enabled),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  };
}

export async function getSitemaps(): Promise<SitemapConfig[]> {
  try {
    const rows = await sql`SELECT * FROM sitemaps ORDER BY type ASC, name ASC`;
    return rows.map(rowToSitemap);
  } catch {
    return [];
  }
}

export async function getSitemapById(id: string): Promise<SitemapConfig | undefined> {
  try {
    const rows = await sql`SELECT * FROM sitemaps WHERE id = ${id} LIMIT 1`;
    return rows.length ? rowToSitemap(rows[0]) : undefined;
  } catch {
    return undefined;
  }
}

export async function getSitemapByPath(path: string): Promise<SitemapConfig | undefined> {
  try {
    const rows = await sql`SELECT * FROM sitemaps WHERE path = ${path} LIMIT 1`;
    return rows.length ? rowToSitemap(rows[0]) : undefined;
  } catch {
    return undefined;
  }
}

// Looked up by each of the 5 built-in child route files (app/sitemap-
// country.xml/route.ts etc.) to find "my own" config row. Reads by type +
// enabled rather than matching the route's own URL against the
// admin-editable `path` field, because a built-in route file's location is
// fixed by Next.js's file-based routing — an admin renaming the Path text
// for a built-in sitemap can't and doesn't move the actual file, so path
// text is informational/display + what's linked from the master index, not
// what the route handler uses to find itself. `type` is deliberately NOT a
// unique column (see the CHECK constraint in scripts/setup-db.mjs), so if
// more than one row ever shares a type, the most recently created enabled
// one wins.
export async function getEnabledSitemapByType(type: SitemapType): Promise<SitemapConfig | undefined> {
  try {
    const rows = await sql`
      SELECT * FROM sitemaps WHERE type = ${type} AND enabled = true
      ORDER BY created_at DESC LIMIT 1
    `;
    return rows.length ? rowToSitemap(rows[0]) : undefined;
  } catch {
    return undefined;
  }
}

function normalizeSitemapPath(path: string): string {
  let p = (path || "").trim();
  if (!p.startsWith("/")) p = `/${p}`;
  return p;
}

const PATH_PATTERN = /^\/[a-zA-Z0-9\-_./]+\.xml$/;

export function validateSitemapInput(input: { name?: string; type?: string; path?: string }): string | null {
  if (!input.name || !input.name.trim()) return "Name is required.";
  if (!input.type || !SITEMAP_TYPES.includes(input.type as SitemapType)) {
    return `Type must be one of: ${SITEMAP_TYPES.join(", ")}.`;
  }
  const path = normalizeSitemapPath(input.path || "");
  if (!PATH_PATTERN.test(path)) {
    return "Path must be a site-relative .xml path, e.g. /sitemap-country.xml.";
  }
  return null;
}

export async function createSitemap(input: {
  name: string;
  type: SitemapType;
  path: string;
  enabled?: boolean;
}): Promise<SitemapConfig> {
  const path = normalizeSitemapPath(input.path);
  const existing = await getSitemapByPath(path);
  if (existing) throw new Error("A sitemap with this path already exists.");
  const rows = await sql`
    INSERT INTO sitemaps (name, type, path, enabled)
    VALUES (${input.name.trim()}, ${input.type}, ${path}, ${input.enabled ?? true})
    RETURNING *
  `;
  return rowToSitemap(rows[0]);
}

export async function updateSitemap(
  id: string,
  updates: Partial<{ name: string; type: SitemapType; path: string; enabled: boolean }>
): Promise<SitemapConfig> {
  const current = await getSitemapById(id);
  if (!current) throw new Error("Sitemap not found.");
  const nextName = updates.name !== undefined ? updates.name.trim() : current.name;
  const nextType = updates.type !== undefined ? updates.type : current.type;
  const nextPath = updates.path !== undefined ? normalizeSitemapPath(updates.path) : current.path;
  const nextEnabled = updates.enabled !== undefined ? updates.enabled : current.enabled;

  if (nextPath !== current.path) {
    const existing = await getSitemapByPath(nextPath);
    if (existing && existing.id !== id) throw new Error("A sitemap with this path already exists.");
  }

  const rows = await sql`
    UPDATE sitemaps
    SET name = ${nextName}, type = ${nextType}, path = ${nextPath}, enabled = ${nextEnabled}, updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `;
  return rowToSitemap(rows[0]);
}

// Deletes only the sitemap config row — never touches the underlying
// countries/cities/categories/articles it was listing. The moment a row is
// gone it simply drops out of the next /sitemap.xml read and its own child
// route (if it was one of the 5 built-ins) starts 404ing, since that route
// looks itself up via getEnabledSitemapByType() on every request.
export async function deleteSitemap(id: string): Promise<void> {
  await sql`DELETE FROM sitemaps WHERE id = ${id}`;
}

// --- Per-type URL builders ----------------------------------------------
// Each function below is scoped to exactly one content type and applies
// that type's own published/indexable rule using the CMS's existing
// fields — never a shared "get every URL" query. This is what enforces the
// rule that a sitemap's Type determines exactly which content it may
// contain: there is no code path here that can mix two content types into
// one result array. (SitemapUrlEntry itself is defined in ./sitemapTypes —
// see the import/re-export at the top of this file.)

// One extra query per sitemap generation (never per-row) to know which
// keys carry a noindex override — see lib/indexing.ts's getIndexingOverview
// for the same key convention (`city:<id>`, `category:<id>`, `article:<id>`,
// or a bare static-page key like "homepage"). Doing this once and checking
// membership in-memory avoids an N+1 query per city/category/article.
async function getNoIndexKeySet(): Promise<Set<string>> {
  try {
    const rows = await sql`SELECT key FROM indexing_settings WHERE no_index = true`;
    return new Set(rows.map((r: any) => r.key as string));
  } catch {
    return new Set();
  }
}

// Static, code-defined public routes (not backed by a DB row) — genuinely
// static by nature, so a fixed list here is the correct source of truth,
// the same way app/sitemap.ts's own staticPages array always was. Kept in
// sync with lib/indexing.ts's STATIC_CORE_PAGES + STATIC_LEGAL_PAGES keys
// so an admin's existing noindex overrides on these pages are respected.
const STATIC_SITEMAP_PAGES: { path: string; indexingKey: string }[] = [
  { path: "/", indexingKey: "homepage" },
  { path: "/latest-news", indexingKey: "latest-news" },
  { path: "/destinations", indexingKey: "destinations" },
  { path: "/categories", indexingKey: "categories" },
  { path: "/about", indexingKey: "about" },
  { path: "/write-for-us", indexingKey: "write-for-us" },
  { path: "/contact", indexingKey: "contact" },
  { path: "/privacy-policy", indexingKey: "privacy-policy" },
  { path: "/terms-and-conditions", indexingKey: "terms-and-conditions" },
  { path: "/cookie-policy", indexingKey: "cookie-policy" },
  { path: "/editorial-policy", indexingKey: "editorial-policy" },
  { path: "/disclaimer", indexingKey: "disclaimer" },
];

export async function getStaticSitemapUrls(): Promise<SitemapUrlEntry[]> {
  const noIndex = await getNoIndexKeySet();
  return STATIC_SITEMAP_PAGES.filter((p) => !noIndex.has(p.indexingKey)).map((p) => ({
    loc: `${SITE_URL}${p.path}`,
  }));
}

export async function getCountrySitemapUrls(): Promise<SitemapUrlEntry[]> {
  // getCountryHubs() (not getAllCountries() / the `countries` table alone)
  // — a country page goes live the moment any city is assigned to it (see
  // app/(public)/[countrySlug]/page.tsx's own existence check), even
  // before an admin has ever opened its Country Hub editor to create a
  // `countries` table row. Querying the table alone under-counted real,
  // publicly-reachable country pages. Same noindex-override pattern as
  // city/category/article, keyed `country:<slug>` — see lib/indexing.ts's
  // getIndexingOverview(), which enumerates the same merged list.
  const [countries, noIndex] = await Promise.all([getCountryHubs(), getNoIndexKeySet()]);
  return countries
    .filter((c) => !!c.slug && !noIndex.has(`country:${c.slug}`))
    .map((c) => ({ loc: `${SITE_URL}${countryPath(c.slug)}`, lastModified: c.updatedAt }));
}

export async function getCitySitemapUrls(): Promise<SitemapUrlEntry[]> {
  const [cities, noIndex] = await Promise.all([getCities(), getNoIndexKeySet()]);
  return cities
    .filter((c) => !!c.slug && !noIndex.has(`city:${c.id}`))
    .map((c) => ({ loc: `${SITE_URL}${cityPath(c.countrySlug, c.slug)}` }));
}

export async function getCategorySitemapUrls(): Promise<SitemapUrlEntry[]> {
  const [categories, noIndex] = await Promise.all([getCategories(), getNoIndexKeySet()]);
  return categories
    .filter((c) => !!c.slug && !noIndex.has(`category:${c.id}`))
    .map((c) => ({ loc: `${SITE_URL}/categories/${c.slug}` }));
}

export async function getArticleSitemapUrls(): Promise<SitemapUrlEntry[]> {
  // status = 'published' is enforced inside getPublishedArticles() itself
  // (lib/articles.ts) — never re-implemented here. "slug exists" is the
  // `!!a.slug` check below.
  const [articles, noIndex] = await Promise.all([
    getPublishedArticles({ limit: 5000 }),
    getNoIndexKeySet(),
  ]);
  const seen = new Set<string>();
  const entries: SitemapUrlEntry[] = [];
  for (const a of articles) {
    if (!a.slug || noIndex.has(`article:${a.id}`)) continue;
    const loc = `${SITE_URL}${articlePath(a.countrySlug, a.citySlug, a.slug)}`;
    if (seen.has(loc)) continue; // defensive de-dup within this one type
    seen.add(loc);
    entries.push({ loc, lastModified: a.updatedAt || undefined });
  }
  return entries;
}

// Single dispatch point mapping a sitemap config row to the one query
// function allowed to populate it — used by the master index's URL-count
// column and by the admin API's response after create/update. Every branch
// is scoped to exactly one of the 5 real content types; there is no
// open-ended/"custom" case, so a sitemap's Type always determines exactly
// what it contains.
export async function getUrlsForSitemap(config: SitemapConfig): Promise<SitemapUrlEntry[]> {
  switch (config.type) {
    case "STATIC":
      return getStaticSitemapUrls();
    case "COUNTRY":
      return getCountrySitemapUrls();
    case "CITY":
      return getCitySitemapUrls();
    case "CATEGORY":
      return getCategorySitemapUrls();
    case "ARTICLE":
      return getArticleSitemapUrls();
    default:
      return [];
  }
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildUrlsetXml(entries: SitemapUrlEntry[]): string {
  const urls = entries
    .map((e) => {
      const lastmod = e.lastModified
        ? `\n    <lastmod>${new Date(e.lastModified).toISOString()}</lastmod>`
        : "";
      return `  <url>\n    <loc>${escapeXml(e.loc)}</loc>${lastmod}\n  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
}
