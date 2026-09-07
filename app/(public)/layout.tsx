import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import { getCities, pickFeaturedCities } from "@/lib/cities";
import { getFeaturedCitySlugs, getFooterConfig } from "@/lib/settings";
import { getCategories } from "@/lib/categories";
import { getPublishedArticles } from "@/lib/articles";
import { articlePath } from "@/lib/destinations";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [cities, featuredSlugs, categories, latestArticles, footerConfig] = await Promise.all([
    getCities(),
    getFeaturedCitySlugs(),
    getCategories(),
    getPublishedArticles({ limit: 1 }),
    getFooterConfig(),
  ]);

  // Admin-curated list for the navbar "Destinations" dropdown (Admin ->
  // Destinations -> Top Destinations) — never a hardcoded city list. Derived
  // from the same `cities` fetch above rather than a second query.
  const featuredCities = pickFeaturedCities(cities, featuredSlugs);

  const featuredCityLinks = featuredCities.map((c) => ({ slug: c.slug, name: c.name, countrySlug: c.countrySlug }));
  const categoryLinks = categories.map((c) => ({ slug: c.slug, name: c.name }));

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
        categories={categoryLinks}
        tickerArticle={tickerArticle}
      />
      <main>{children}</main>
      <PublicFooter footerConfig={footerConfig} />
    </>
  );
}
