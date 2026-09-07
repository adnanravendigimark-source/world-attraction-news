import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import { getCities, pickFeaturedCities } from "@/lib/cities";
import { getCategories, pickFeaturedCategories } from "@/lib/categories";
import { getFeaturedCitySlugs, getFeaturedCategorySlugs, getFooterConfig } from "@/lib/settings";
import { getPublishedArticles } from "@/lib/articles";
import { articlePath } from "@/lib/destinations";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [cities, featuredCitySlugs, categories, featuredCategorySlugs, latestArticles, footerConfig] =
    await Promise.all([
      getCities(),
      getFeaturedCitySlugs(),
      getCategories(),
      getFeaturedCategorySlugs(),
      getPublishedArticles({ limit: 1 }),
      getFooterConfig(),
    ]);

  // Admin-curated lists for the navbar's Destinations/Categories dropdowns
  // (Admin -> Header) — never hardcoded. Derived from the `cities`/
  // `categories` fetches above rather than a second query each.
  const featuredCities = pickFeaturedCities(cities, featuredCitySlugs);
  const featuredCategories = pickFeaturedCategories(categories, featuredCategorySlugs);

  const featuredCityLinks = featuredCities.map((c) => ({ slug: c.slug, name: c.name, countrySlug: c.countrySlug }));
  const featuredCategoryLinks = featuredCategories.map((c) => ({ slug: c.slug, name: c.name }));

  const topArticle = latestArticles[0];
  const tickerArticle = topArticle
    ? {
        title: topArticle.title,
        href: articlePath(topArticle.countrySlug, topArticle.citySlug, topArticle.slug),
      }
    : undefined;

  return (
    <>
      <PublicHeader
        cities={featuredCityLinks}
        categories={featuredCategoryLinks}
        tickerArticle={tickerArticle}
      />
      <main>{children}</main>
      <PublicFooter footerConfig={footerConfig} />
    </>
  );
}
