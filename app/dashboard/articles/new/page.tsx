import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getCities } from "@/lib/cities";
import { getCategories } from "@/lib/categories";
import { getAttractions } from "@/lib/attractions";
import ArticleEditor from "@/components/dashboard/ArticleEditor";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Write New Article | Dashboard",
  robots: { index: false, follow: false },
};

export default async function NewArticlePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [cities, categories, attractions] = await Promise.all([getCities(), getCategories(), getAttractions()]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Link href="/dashboard/articles" className="hover:text-[#DC2626] transition-colors">
              My Articles
            </Link>
            <span>/</span>
            <span className="text-slate-800 font-semibold">New Article</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            Write New Article
          </h1>
        </div>
      </div>

      {/* Editor Component */}
      <ArticleEditor
        cities={cities.map((c) => ({ id: c.id, name: c.name, country: c.country }))}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        attractions={attractions.map((a) => ({ id: a.id, name: a.name, cityId: a.cityId }))}
      />
    </div>
  );
}
