import type { Metadata } from "next";
import Link from "next/link";
import { getPublishedNews } from "@/lib/articles";
import { buildMetadata, breadcrumbJsonLd, jsonLdScript } from "@/lib/seo";
import { SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export async function generateMetadata({ searchParams }: { searchParams: { page?: string } }): Promise<Metadata> {
  return buildMetadata({
    title: `Travel News: Airlines, Attractions, Travel Rules & More | ${SITE_NAME}`,
    description: "Fact-checked travel news on airlines, airports, attractions and travel rules, written for people who plan trips.",
    path: "/news",
    noIndex: !!searchParams?.page && searchParams.page !== "1",
  });
}

function fmt(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default async function NewsIndexPage({ searchParams }: { searchParams: { page?: string } }) {
  const page = Math.max(1, Number(searchParams?.page) || 1);
  const { articles, total } = await getPublishedNews({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const lead = page === 1 ? articles[0] : undefined;
  const list = page === 1 ? articles.slice(1) : articles;

  return (
    <main className="mx-auto max-w-5xl px-5 pb-16 pt-10 sm:pt-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "News", path: "/news" }])) }}
      />
      <header className="border-b border-slate-200 pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#C22938]">{SITE_NAME}</p>
        <h1 className="mt-2 font-serif text-4xl font-bold tracking-tight text-[#111318] sm:text-5xl">Travel News</h1>
        <p className="mt-3 max-w-2xl text-lg text-slate-600">The latest on airlines, airports, attractions and travel rules, checked against the sources.</p>
      </header>

      {articles.length === 0 ? (
        <p className="mt-10 text-slate-600">No news published yet. Check back soon.</p>
      ) : (
        <>
          {lead && (
            <Link href={`/news/${lead.slug}`} className="group mt-8 grid gap-6 md:grid-cols-2 md:items-center">
              {lead.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={lead.image} alt={lead.imageAlt || lead.title} className="aspect-[16/10] w-full rounded-xl object-cover" />
              )}
              <div className={lead.image ? "" : "md:col-span-2"}>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{fmt(lead.publishedAt)}</p>
                <h2 className="mt-2 font-serif text-3xl font-bold leading-tight text-[#111318] group-hover:underline sm:text-[2.1rem]">{lead.title}</h2>
                {lead.excerpt && <p className="mt-3 text-lg leading-snug text-slate-600">{lead.excerpt}</p>}
              </div>
            </Link>
          )}

          {list.length > 0 && (
            <ul className="mt-10 grid gap-x-6 gap-y-10 border-t border-slate-200 pt-10 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((a) => (
                <li key={a.id}>
                  <Link href={`/news/${a.slug}`} className="group block">
                    {a.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.image} alt={a.imageAlt || a.title} loading="lazy" className="mb-3 aspect-[16/10] w-full rounded-lg object-cover" />
                    )}
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{fmt(a.publishedAt)}</p>
                    <h2 className="mt-1 font-serif text-xl font-bold leading-snug text-[#111318] group-hover:underline">{a.title}</h2>
                    {a.excerpt && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-600">{a.excerpt}</p>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {pages > 1 && (
        <nav className="mt-12 flex items-center justify-between text-sm">
          {page > 1 ? <Link href={`/news?page=${page - 1}`} className="underline">← Newer</Link> : <span />}
          <span className="text-slate-500">Page {page} of {pages}</span>
          {page < pages ? <Link href={`/news?page=${page + 1}`} className="underline">Older →</Link> : <span />}
        </nav>
      )}
    </main>
  );
}
