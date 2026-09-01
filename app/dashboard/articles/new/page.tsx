import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getCities } from "@/lib/cities";
import { getCategories } from "@/lib/categories";
import { getAttractions } from "@/lib/attractions";
import ArticleEditor from "@/components/dashboard/ArticleEditor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Write New Article", robots: { index: false, follow: false } };

export default async function NewArticlePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [cities, categories, attractions] = await Promise.all([getCities(), getCategories(), getAttractions()]);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-serif text-2xl font-bold text-ink-900">Write New Article</h1>
      <p className="mt-1 text-sm text-ink-600">
        Choose which city this article belongs to, then write it directly below — your work saves automatically as
        you go.
      </p>
      <div className="mt-6">
        <ArticleEditor
          cities={cities.map((c) => ({ id: c.id, name: c.name, country: c.country }))}
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
          attractions={attractions.map((a) => ({ id: a.id, name: a.name, cityId: a.cityId }))}
        />
      </div>
    </div>
  );
}
