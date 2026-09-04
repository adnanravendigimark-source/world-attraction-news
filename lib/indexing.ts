import { sql } from "./db";
import { getPublishedArticles } from "./articles";
import { getCities } from "./cities";
import { getCategories } from "./categories";
import { articlePath, cityPath } from "./destinations";

export type IndexingPageType = "core" | "legal" | "destination" | "category" | "article";

export interface IndexingRow {
  key: string;
  type: IndexingPageType;
  label: string;
  url: string;
  noIndex: boolean;
  noFollow: boolean;
}

const STATIC_CORE_PAGES: Array<{ key: string; label: string; url: string }> = [
  { key: "homepage", label: "Homepage", url: "/" },
  { key: "latest-news", label: "Latest News (listing)", url: "/latest-news" },
  { key: "destinations", label: "Destinations (index)", url: "/destinations" },
  { key: "categories", label: "Categories (index)", url: "/categories" },
  { key: "about", label: "About Us", url: "/about" },
  { key: "write-for-us", label: "Write For Us", url: "/write-for-us" },
  { key: "contact", label: "Contact", url: "/contact" },
];

const STATIC_LEGAL_PAGES: Array<{ key: string; label: string; url: string }> = [
  { key: "privacy-policy", label: "Privacy Policy", url: "/privacy-policy" },
  { key: "terms-and-conditions", label: "Terms & Conditions", url: "/terms-and-conditions" },
  { key: "cookie-policy", label: "Cookie Policy", url: "/cookie-policy" },
  { key: "editorial-policy", label: "Editorial Policy", url: "/editorial-policy" },
  { key: "disclaimer", label: "Disclaimer", url: "/disclaimer" },
];

export async function getIndexingOverview(): Promise<IndexingRow[]> {
  try {
    const [overridesRows, articles, cities, categories] = await Promise.all([
      sql`SELECT key, no_index, no_follow FROM indexing_settings`.catch(() => []),
      getPublishedArticles({ limit: 500 }).catch(() => []),
      getCities().catch(() => []),
      getCategories().catch(() => []),
    ]);

    const overrideMap = new Map<string, { noIndex: boolean; noFollow: boolean }>();
    for (const row of overridesRows) {
      overrideMap.set(row.key, {
        noIndex: Boolean(row.no_index),
        noFollow: Boolean(row.no_follow),
      });
    }

    const rows: IndexingRow[] = [];

    // 1. Core pages
    for (const page of STATIC_CORE_PAGES) {
      const ov = overrideMap.get(page.key) || overrideMap.get(page.url);
      rows.push({
        key: page.key,
        type: "core",
        label: page.label,
        url: page.url,
        noIndex: ov?.noIndex ?? false,
        noFollow: ov?.noFollow ?? false,
      });
    }

    // 2. Legal pages
    for (const page of STATIC_LEGAL_PAGES) {
      const ov = overrideMap.get(page.key) || overrideMap.get(page.url);
      rows.push({
        key: page.key,
        type: "legal",
        label: page.label,
        url: page.url,
        noIndex: ov?.noIndex ?? false,
        noFollow: ov?.noFollow ?? false,
      });
    }

    // 3. Destinations (cities)
    for (const city of cities) {
      const url = cityPath(city.countrySlug, city.slug);
      const key = `city:${city.id}`;
      const ov = overrideMap.get(key) || overrideMap.get(url);
      rows.push({
        key,
        type: "destination",
        label: `${city.name}, ${city.country}`,
        url,
        noIndex: ov?.noIndex ?? false,
        noFollow: ov?.noFollow ?? false,
      });
    }

    // 4. Categories
    for (const cat of categories) {
      const url = `/categories/${cat.slug}`;
      const key = `category:${cat.id}`;
      const ov = overrideMap.get(key) || overrideMap.get(url);
      rows.push({
        key,
        type: "category",
        label: cat.name,
        url,
        noIndex: ov?.noIndex ?? false,
        noFollow: ov?.noFollow ?? false,
      });
    }

    // 5. Published Articles
    for (const art of articles) {
      const url = articlePath(art.countrySlug, art.citySlug, art.slug);
      const key = `article:${art.id}`;
      const ov = overrideMap.get(key) || overrideMap.get(url);
      rows.push({
        key,
        type: "article",
        label: art.title,
        url,
        noIndex: ov?.noIndex ?? false,
        noFollow: ov?.noFollow ?? false,
      });
    }

    return rows;
  } catch (err) {
    console.error("[getIndexingOverview error]:", err);
    return [];
  }
}

export async function setIndexing(input: {
  key: string;
  type?: IndexingPageType;
  label?: string;
  url?: string;
  noIndex: boolean;
  noFollow: boolean;
}): Promise<void> {
  const type = input.type || "core";
  const label = input.label || input.key;
  const url = input.url || `/${input.key}`;
  await sql`
    INSERT INTO indexing_settings (key, type, label, url, no_index, no_follow, updated_at)
    VALUES (${input.key}, ${type}, ${label}, ${url}, ${!!input.noIndex}, ${!!input.noFollow}, now())
    ON CONFLICT (key) DO UPDATE SET
      no_index = EXCLUDED.no_index,
      no_follow = EXCLUDED.no_follow,
      updated_at = now()
  `;
}

export async function setBulkIndexing(
  items: Array<{
    key: string;
    type?: IndexingPageType;
    label?: string;
    url?: string;
    noIndex: boolean;
    noFollow: boolean;
  }>
): Promise<void> {
  if (!items.length) return;
  for (const item of items) {
    await setIndexing(item);
  }
}

export async function getPageIndexing(keyOrPath: string): Promise<{ noIndex: boolean; noFollow: boolean }> {
  try {
    const rows = await sql`
      SELECT no_index, no_follow FROM indexing_settings
      WHERE key = ${keyOrPath} OR url = ${keyOrPath}
      LIMIT 1
    `;
    if (rows.length > 0) {
      return {
        noIndex: Boolean(rows[0].no_index),
        noFollow: Boolean(rows[0].no_follow),
      };
    }
  } catch {
    // fall through
  }
  return { noIndex: false, noFollow: false };
}
