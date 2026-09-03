import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getCities } from "@/lib/cities";
import { getCategories } from "@/lib/categories";
import { getAttractions } from "@/lib/attractions";
import ArticleEditor from "@/components/dashboard/ArticleEditor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Write New Article | World Attraction News",
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
    <ArticleEditor
      cities={cities.map((c) => ({ id: c.id, name: c.name, country: c.country }))}
      categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      attractions={attractions.map((a) => ({ id: a.id, name: a.name, cityId: a.cityId }))}
    />
  );
}
