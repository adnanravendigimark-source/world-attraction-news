import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import { getCities } from "@/lib/cities";
import { getCategories } from "@/lib/categories";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [cities, categories] = await Promise.all([getCities(), getCategories()]);
  const cityLinks = cities.map((c) => ({ slug: c.slug, name: c.name, countrySlug: c.countrySlug }));
  const categoryLinks = categories.map((c) => ({ slug: c.slug, name: c.name }));

  return (
    <>
      <PublicHeader cities={cityLinks} categories={categoryLinks} />
      <main>{children}</main>
      <PublicFooter cities={cityLinks} categories={categoryLinks} />
    </>
  );
}
