import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import { getCities } from "@/lib/cities";
import { getCategories } from "@/lib/categories";
import { getPublishedArticles } from "@/lib/articles";
import { articlePath } from "@/lib/destinations";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [cities, categories, latestArticles] = await Promise.all([
    getCities(),
    getCategories(),
    getPublishedArticles({ limit: 1 }),
  ]);

  const cityLinks = cities.map((c) => ({ slug: c.slug, name: c.name, countrySlug: c.countrySlug }));
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
        cities={cityLinks}
        categories={categoryLinks}
        tickerArticle={tickerArticle}
      />
      <main>{children}</main>
      <PublicFooter cities={cityLinks} categories={categoryLinks} />
    </>
  );
}
