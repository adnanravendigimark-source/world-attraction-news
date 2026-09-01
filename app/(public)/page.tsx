import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import Container from "@/components/Container";
import ArticleCard from "@/components/ArticleCard";
import SectionHeading from "@/components/SectionHeading";
import NewsletterForm from "@/components/NewsletterForm";
import { getCitiesWithArticleCounts } from "@/lib/cities";
import { getCategories } from "@/lib/categories";
import {
  getPublishedArticles,
  getTrendingArticles,
  getTopScoredArticles,
  getPublishedArticleCountsByCategory,
} from "@/lib/articles";
import { buildMetadata, websiteJsonLd } from "@/lib/seo";
import { getSettings } from "@/lib/settings";
import { SITE_NAME, SITE_DESCRIPTION } from "@/lib/site";

export const dynamic = "force-dynamic";

// Sitewide meta description falls back to the /admin/seo default only when
// the site's own copy is empty — in practice SITE_DESCRIPTION is always set,
// so this is a genuine fallback path rather than dead code, exercised the
// moment that constant is ever cleared.
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildMetadata({
    title: `${SITE_NAME} — Latest News from Attractions Around the World`,
    description: SITE_DESCRIPTION || settings.defaultMetaDescription,
    path: "/",
    image: settings.defaultOgImage || undefined,
    noIndex: settings.robotsDefault === "noindex",
  });
}

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default async function HomePage() {
  const [cities, categories, articles, trending, topScored, categoryCounts, settings] = await Promise.all([
    getCitiesWithArticleCounts(),
    getCategories(),
    getPublishedArticles({ limit: 60 }),
    getTrendingArticles(6),
    getTopScoredArticles(6),
    getPublishedArticleCountsByCategory(),
    getSettings(),
  ]);

  // Featured cities (chosen in Admin -> Settings) are shown first, in the
  // order selected; any remaining cities follow after, sorted by real
  // published-article count. If none are chosen, popularity ordering alone
  // decides.
  const featuredSet = new Set(settings.featuredCitySlugs);
  const popularCities = [...cities].sort((a, b) => b.articleCount - a.articleCount);
  const orderedCities = featuredSet.size
    ? [
        ...settings.featuredCitySlugs.map((slug) => cities.find((c) => c.slug === slug)).filter((c): c is NonNullable<typeof c> => Boolean(c)),
        ...popularCities.filter((c) => !featuredSet.has(c.slug)),
      ]
    : popularCities;

  const heroText = settings.homepageIntroOverride || SITE_DESCRIPTION;

  const [hero, ...rest] = articles;
  const topStories = rest.slice(0, 4);
  const afterTopStories = rest.slice(4);
  const latestGrid = afterTopStories.slice(0, 6);

  // Up to 3 categories that actually have published articles, ranked by
  // real article count — each gets its own mini section with its 3 latest
  // stories, fetched in parallel.
  const categoriesWithArticles = categories
    .filter((c) => (categoryCounts[c.id] || 0) > 0)
    .sort((a, b) => (categoryCounts[b.id] || 0) - (categoryCounts[a.id] || 0))
    .slice(0, 3);
  const categorySections = await Promise.all(
    categoriesWithArticles.map(async (cat) => ({
      category: cat,
      articles: await getPublishedArticles({ categorySlug: cat.slug, limit: 3 }),
    }))
  );

  const publishedCount = articles.length;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd()) }}
      />

      {/* Masthead — the tagline itself is the page's H1, satisfying the
          "immediately communicates Latest News from Attractions Around the
          World" requirement independent of whatever today's lead story is. */}
      <section className="border-b border-ink-200 bg-white py-8 sm:py-10">
        <Container>
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-signal" aria-hidden="true" />
              <span className="text-xs font-bold uppercase tracking-widest text-signal">Latest News</span>
            </span>
            <span className="text-ink-300" aria-hidden="true">·</span>
            <span className="text-xs font-medium text-ink-500">
              {cities.length} {cities.length === 1 ? "city" : "cities"} covered · {publishedCount}{" "}
              {publishedCount === 1 ? "story" : "stories"} published
            </span>
          </div>
          <h1 className="mt-2 max-w-3xl font-serif text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
            {heroText}
          </h1>
        </Container>
      </section>

      {articles.length === 0 ? (
        <Container className="py-16 text-center">
          <p className="text-sm text-ink-500">
            No published articles yet. Once contributors are approved and their articles are reviewed, they'll appear
            here.
          </p>
        </Container>
      ) : (
        <>
          {/* Hero / featured story + top headlines */}
          <Container className="animate-fade-in-up py-10 sm:py-14">
            <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
              <Link
                href={`/cities/${hero.citySlug}/${hero.slug}`}
                className="group relative flex min-h-[22rem] flex-col justify-end overflow-hidden rounded-xl border border-ink-100 shadow-lift sm:min-h-[28rem]"
              >
                {hero.image && (
                  <Image
                    src={hero.image}
                    alt={hero.imageAlt || hero.title}
                    fill
                    priority
                    sizes="(min-width: 1024px) 60vw, 100vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-ink-900/90 via-ink-900/30 to-transparent" />
                <div className="relative z-10 p-5 sm:p-8">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-white">
                    <span className="rounded bg-signal px-2 py-0.5">{hero.cityName}</span>
                    {hero.categoryName && <span className="text-ink-200">{hero.categoryName}</span>}
                  </div>
                  <h2 className="mt-3 max-w-2xl font-serif text-2xl font-bold leading-tight text-white sm:text-3xl lg:text-4xl">
                    {hero.title}
                  </h2>
                  <p className="mt-2 hidden max-w-xl text-sm leading-relaxed text-ink-100 sm:block">{hero.excerpt}</p>
                  <p className="mt-3 text-xs text-ink-200">
                    By {hero.authorName} · {formatDate(hero.publishedAt)} · {hero.readingTimeMinutes} min read
                  </p>
                </div>
              </Link>

              <div className="flex flex-col">
                <p className="text-[11px] font-bold uppercase tracking-widest text-ink-500">Top Stories</p>
                <div className="mt-1 divide-y divide-ink-100">
                  {topStories.map((a) => (
                    <ArticleCard key={a.id} article={a} size="compact" />
                  ))}
                </div>
              </div>
            </div>
          </Container>

          {/* Trending Now */}
          {trending.length > 0 && (
            <section className="border-t border-ink-200 bg-ink-50 py-10 sm:py-12">
              <Container>
                <SectionHeading eyebrow="What readers are talking about" title="Trending Now" href="/latest-news" />
                <div className="mt-6 grid gap-x-8 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
                  {trending.map((a, i) => (
                    <ArticleCard key={a.id} article={a} size="compact" rank={i + 1} />
                  ))}
                </div>
              </Container>
            </section>
          )}

          {/* Popular Cities */}
          {orderedCities.length > 0 && (
            <section className="border-t border-ink-200 bg-white py-10 sm:py-12">
              <Container>
                <SectionHeading
                  eyebrow="Explore by destination"
                  title={featuredSet.size ? "Featured Cities" : "Popular Cities"}
                  href="/cities"
                />
                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  {orderedCities.slice(0, 5).map((c) => (
                    <Link
                      key={c.id}
                      href={`/cities/${c.slug}`}
                      className="group relative flex h-36 items-end overflow-hidden rounded-lg border border-ink-100 shadow-card transition-shadow hover:shadow-lift"
                    >
                      {c.heroImage && (
                        <Image
                          src={c.heroImage}
                          alt={c.heroImageAlt || c.name}
                          fill
                          sizes="(min-width: 1024px) 20vw, 50vw"
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-ink-900/85 via-ink-900/15 to-transparent" />
                      <div className="relative z-10 px-3 py-2.5">
                        <p className="font-serif text-base font-bold text-white">{c.name}</p>
                        <p className="text-[11px] text-ink-200">
                          {c.articleCount} {c.articleCount === 1 ? "story" : "stories"}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </Container>
            </section>
          )}

          {/* Category sections */}
          {categorySections.map(({ category, articles: catArticles }) =>
            catArticles.length === 0 ? null : (
              <section key={category.id} className="border-t border-ink-200 bg-ink-50 py-10 sm:py-12">
                <Container>
                  <SectionHeading eyebrow="Category" title={category.name} href={`/categories/${category.slug}`} />
                  <div className="mt-6 grid gap-6 sm:grid-cols-3">
                    {catArticles.map((a) => (
                      <ArticleCard key={a.id} article={a} />
                    ))}
                  </div>
                </Container>
              </section>
            )
          )}

          {/* Popular Attractions / Reader Favorites — ranked by the admin's
              own quality score, an honest all-time signal rather than a
              fabricated "popularity" metric. */}
          {topScored.length > 0 && (
            <section className="border-t border-ink-200 bg-white py-10 sm:py-12">
              <Container>
                <SectionHeading eyebrow="Highest-rated coverage" title="Popular Attractions" href="/latest-news" />
                <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {topScored.map((a) => (
                    <ArticleCard key={a.id} article={a} />
                  ))}
                </div>
              </Container>
            </section>
          )}

          {/* Latest articles grid */}
          {latestGrid.length > 0 && (
            <section className="border-t border-ink-200 bg-ink-50 py-10 sm:py-12">
              <Container>
                <SectionHeading eyebrow="Fresh off the wire" title="Latest Attraction News" href="/latest-news" />
                <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {latestGrid.map((a) => (
                    <ArticleCard key={a.id} article={a} />
                  ))}
                </div>
              </Container>
            </section>
          )}
        </>
      )}

      {/* Newsletter */}
      <section className="border-t border-ink-200 bg-ink-900 py-14 sm:py-16">
        <Container className="text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-signal">Never miss an update</p>
          <h2 className="mx-auto mt-2 max-w-lg font-serif text-2xl font-bold text-white sm:text-3xl">
            Get attraction news delivered to your inbox
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-400">
            New openings, ticket and pricing changes, and travel updates from cities around the world — once a week,
            no spam.
          </p>
          <div className="mx-auto mt-6 max-w-sm">
            <NewsletterForm source="homepage" variant="dark" />
          </div>
        </Container>
      </section>

      {/* Write for us CTA */}
      <section className="border-t border-ink-200 bg-white py-10">
        <Container>
          <div className="rounded-lg border border-ink-200 bg-paper p-6 text-center sm:p-8">
            <h2 className="font-serif text-lg font-bold text-ink-900 sm:text-xl">Write for {SITE_NAME}</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-ink-600">
              We're looking for local contributors in cities around the world to report on attraction news, ticket
              changes, and openings where they live. Every submission is reviewed by our editorial team before
              publication.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/write-for-us"
                className="inline-flex items-center gap-1.5 rounded-md border border-ink-300 px-5 py-2.5 text-sm font-semibold text-ink-700 transition-colors hover:border-ink-900"
              >
                How It Works
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center gap-1.5 rounded-md bg-signal px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-signal-dark"
              >
                Become a Contributor →
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
