import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import Container from "@/components/Container";
import NewsletterForm from "@/components/NewsletterForm";
import EmptyState from "@/components/EmptyState";
import { LeadStory, SideStory, StoryGrid, SectionHeader } from "@/components/home/Stories";
import { getCitiesWithArticleCounts } from "@/lib/cities";
import { getCategories } from "@/lib/categories";
import { getPublishedArticles, getFeaturedArticles, getEditorsPickArticles, getPublishedNews } from "@/lib/articles";
import { resolvePageMetadata, websiteJsonLd, jsonLdScript } from "@/lib/seo";
import { cityPath } from "@/lib/destinations";
import { pickHomeStories } from "@/lib/home";
import { SITE_NAME, SITE_DESCRIPTION, SITE_TAGLINE } from "@/lib/site";

// Pure read (no per-request writes, no searchParams) — real ISR instead of
// force-dynamic. 60s is a real cache window, not a fake one: repeat
// homepage visits within that window are served from the cache (fast, no DB
// round trip), and it's short enough that a newly published/featured
// article shows up within a minute on its own. Admin actions that should
// feel instant (publish, feature/unfeature, unpublish) additionally call
// revalidateTag("homepage") so this page updates immediately rather than
// waiting out the window — see the admin article/city/category routes.
//
// This `revalidate` export alone would do nothing: lib/db.ts's `sql()`
// passes `fetchOptions: { cache: "no-store" }` to every single query
// (deliberately — see that file's own comment about a real earlier bug),
// and Next.js treats any no-store fetch during a render as a signal to
// render that route dynamically on every request, silently overriding
// route-level `revalidate`. Wrapping the actual data fetch below in
// unstable_cache() is what makes this page cacheable despite that — it
// caches the *function's return value* at the framework level, independent
// of what the function does internally, which is the documented way to add
// real caching on top of a non-fetch (or explicitly no-store) data source.
export const revalidate = 60;

const getHomePageData = unstable_cache(
  async () => {
    const [cities, categories, guides, featured, editorsPicks, news] = await Promise.all([
      getCitiesWithArticleCounts(),
      getCategories(),
      getPublishedArticles({ limit: 12 }),
      getFeaturedArticles(3),
      getEditorsPickArticles(4),
      getPublishedNews({ limit: 8 })
        .then((r) => r.articles)
        .catch(() => []),
    ]);
    return { cities, categories, guides, featured, editorsPicks, news };
  },
  ["homepage-data-v2"],
  { revalidate: 60, tags: ["homepage"] }
);

export async function generateMetadata(): Promise<Metadata> {
  return resolvePageMetadata("/", {
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  });
}

export default async function HomePage() {
  const { cities, categories, guides, featured, editorsPicks, news } = await getHomePageData();
  const stories = pickHomeStories({ featured, editorsPicks, guides, news });

  // A city without its own photo is left out rather than shown with a
  // stand-in that would misrepresent the place.
  const destinations = cities.filter((c) => c.heroImage).slice(0, 8);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(websiteJsonLd()) }} />
      <h1 className="sr-only">
        {SITE_NAME}: travel news and destination guides
      </h1>

      <div className="bg-white text-ink-900">
        {/* Top stories */}
        <section className="pb-14 pt-8 sm:pt-10 lg:pb-20">
          <Container>
            {!stories.lead ? (
              <EmptyState title="No stories published yet" description="Check back soon for travel news and destination guides." />
            ) : stories.secondary.length === 0 ? (
              <LeadStory story={stories.lead} wide />
            ) : (
              <div className="grid gap-10 lg:grid-cols-12 lg:gap-10">
                <div className="lg:col-span-8">
                  <LeadStory story={stories.lead} />
                </div>
                <div className="flex flex-col gap-8 border-t border-ink-100 pt-8 lg:col-span-4 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
                  {stories.secondary.map((s, i) => (
                    <div key={s.id} className={i > 0 ? "border-t border-ink-100 pt-8" : ""}>
                      <SideStory story={s} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Container>
        </section>

        {stories.news.length > 0 && (
          <section className="pb-14 lg:pb-20">
            <Container>
              <SectionHeader title="Travel news" description="Airlines, airports, attractions and travel rules, checked against the sources." href="/news" linkLabel="All news" />
              <StoryGrid stories={stories.news} />
            </Container>
          </section>
        )}

        {stories.guides.length > 0 && (
          <section className="pb-14 lg:pb-20">
            <Container>
              <SectionHeader title="Travel guides" description="Plan the trip: what to see, when to go and how to do it well." href="/latest-news" linkLabel="All guides" />
              <StoryGrid stories={stories.guides} />
            </Container>
          </section>
        )}

        {destinations.length > 0 && (
          <section className="bg-paper py-14 lg:py-20">
            <Container>
              <SectionHeader title="Destinations" description="News and guides, place by place." href="/destinations" linkLabel="All destinations" />
            </Container>
            <div className="mx-auto max-w-content">
              <ul className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-3.5 pb-2 sm:gap-5 sm:px-6 lg:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {destinations.map((d) => (
                  <li key={d.slug} className="w-[68%] shrink-0 snap-start sm:w-[15rem] lg:w-[16.5rem]">
                    <Link href={cityPath(d.countrySlug, d.slug)} className="group relative block aspect-[4/5] overflow-hidden rounded-2xl bg-ink-900">
                      <Image
                        src={d.heroImage}
                        alt={d.heroImageAlt || d.name}
                        fill
                        sizes="(min-width: 640px) 264px, 68vw"
                        className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                        <p className="font-serif text-2xl font-semibold leading-tight">{d.name}</p>
                        <p className="mt-1 text-[13px] text-white/80">
                          {[d.country, d.articleCount > 0 ? `${d.articleCount} ${d.articleCount === 1 ? "story" : "stories"}` : ""].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
                <li className="w-[68%] shrink-0 snap-start sm:w-[15rem] lg:w-[16.5rem]">
                  <Link
                    href="/destinations"
                    className="group flex aspect-[4/5] flex-col justify-between rounded-2xl border border-ink-200 bg-white p-6 transition-colors hover:border-ink-900"
                  >
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-500">Explore</span>
                    <span>
                      <span className="block font-serif text-2xl font-semibold leading-tight text-ink-950">All destinations</span>
                      <span className="mt-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-ink-950 text-white transition-transform group-hover:translate-x-1" aria-hidden="true">
                        →
                      </span>
                    </span>
                  </Link>
                </li>
              </ul>
            </div>
            {categories.length >= 3 && (
              <Container className="mt-10">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-500">Browse by topic</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <Link
                      key={cat.id}
                      href={`/categories/${cat.slug}`}
                      className="rounded-full border border-ink-200 bg-white px-4 py-2 text-sm text-ink-800 transition-colors hover:border-ink-900"
                    >
                      {cat.name}
                    </Link>
                  ))}
                </div>
              </Container>
            )}
          </section>
        )}

        {/* Newsletter */}
        <section className="py-14 lg:py-20">
          <Container>
            <div className="grid gap-8 rounded-3xl bg-ink-950 px-6 py-10 sm:px-10 sm:py-12 lg:grid-cols-12 lg:items-center lg:gap-12 lg:px-14">
              <div className="lg:col-span-7">
                <h2 className="font-serif text-[1.75rem] font-semibold leading-tight tracking-tight text-white sm:text-[2.25rem]">
                  The week in travel, in one email
                </h2>
                <p className="mt-3 max-w-xl text-[16px] leading-relaxed text-ink-300">
                  New openings, rule changes and our latest guides. No spam, unsubscribe anytime.
                </p>
              </div>
              <div className="lg:col-span-5">
                <NewsletterForm source="homepage" variant="dark" />
              </div>
            </div>
          </Container>
        </section>
      </div>
    </>
  );
}
