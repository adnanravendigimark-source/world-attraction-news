import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import { getCities, pickFeaturedCities } from "@/lib/cities";
import { getCategories, pickFeaturedCategories } from "@/lib/categories";
import { getFeaturedCitySlugs, getFeaturedCategorySlugs, getFooterConfig } from "@/lib/settings";
import { getLatestNewsHeadline, newsPath } from "@/lib/articles";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [cities, featuredCitySlugs, categories, featuredCategorySlugs, footerConfig, latestNews] = await Promise.all([
    getCities(),
    getFeaturedCitySlugs(),
    getCategories(),
    getFeaturedCategorySlugs(),
    getFooterConfig(),
    // The header's LIVE line: the newest published news story.
    getLatestNewsHeadline(),
  ]);

  // Admin-curated lists for the navbar's Destinations/Categories dropdowns
  // (Admin -> Header) — never hardcoded. Derived from the `cities`/
  // `categories` fetches above rather than a second query each.
  const featuredCities = pickFeaturedCities(cities, featuredCitySlugs);
  const featuredCategories = pickFeaturedCategories(categories, featuredCategorySlugs);

  const featuredCityLinks = featuredCities.map((c) => ({ slug: c.slug, name: c.name, countrySlug: c.countrySlug }));
  const featuredCategoryLinks = featuredCategories.map((c) => ({ slug: c.slug, name: c.name }));

  return (
    <>
      <PublicHeader
        cities={featuredCityLinks}
        categories={featuredCategoryLinks}
        breakingHeadline={latestNews?.title}
        breakingHref={latestNews ? newsPath(latestNews.slug) : "/news"}
      />
      <main id="main" tabIndex={-1} className="outline-none">
        {children}
      </main>
      <PublicFooter footerConfig={footerConfig} />
    </>
  );
}
