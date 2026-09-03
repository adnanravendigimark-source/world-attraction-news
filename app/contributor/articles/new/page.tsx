import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getCities } from "@/lib/cities";
import { getCategories } from "@/lib/categories";
import { getAttractions } from "@/lib/attractions";
import ArticleEditor from "@/components/dashboard/ArticleEditor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "New Article | World Attraction News",
  robots: { index: false, follow: false },
};

export default async function NewArticlePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [cities, categories, attractions] = await Promise.all([
    getCities(),
    getCategories(),
    getAttractions(),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-900">New Article</h1>
      <p className="mt-1 text-sm text-stone-600">Fill in the basics, then write the article section by section.</p>
      <div className="mt-8 max-w-7xl">
        <ArticleEditor
          cities={cities.map((c) => ({ id: c.id, name: c.name, country: c.country }))}
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
          attractions={attractions.map((a) => ({ id: a.id, name: a.name, cityId: a.cityId }))}
        />
      </div>
    </div>
  );
}
