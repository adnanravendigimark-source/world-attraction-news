import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { unstable_cache } from "next/cache";
import Container from "@/components/Container";
import Breadcrumbs from "@/components/Breadcrumbs";
import ArticleCard from "@/components/ArticleCard";
import SectionHeading from "@/components/SectionHeading";
import EmptyState from "@/components/EmptyState";
import { findUserBySlug } from "@/lib/users";
import { getPublishedArticlesByAuthorId } from "@/lib/articles";
import { buildMetadata, breadcrumbJsonLd, personJsonLd } from "@/lib/seo";

// Pure read — real ISR.
//
// See app/(public)/page.tsx for why the DB reads below go through
// unstable_cache instead of relying on `revalidate` alone.
export const revalidate = 180;

const getCachedAuthorBySlug = unstable_cache((slug: string) => findUserBySlug(slug), ["author-by-slug"], {
  revalidate: 180,
  tags: ["users"],
});

const getCachedAuthorArticles = unstable_cache(
  (authorId: string) => getPublishedArticlesByAuthorId(authorId),
  ["author-articles"],
  { revalidate: 180, tags: ["articles"] }
);

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const author = await getCachedAuthorBySlug(params.slug);
  if (!author) return {};
  return buildMetadata({
    title: `${author.displayName} — Author`,
    description: author.bio || `Articles by ${author.displayName} on the site.`,
    path: `/author/${author.slug}`,
    image: author.avatarUrl || undefined,
  });
}

export default async function AuthorPage({ params }: { params: { slug: string } }) {
  const author = await getCachedAuthorBySlug(params.slug);
  // Only ever show a real, findable author page — never a fabricated
  // profile — and never expose a pending/rejected/suspended account's page
  // before they've contributed anything visible.
  if (!author) notFound();

  const articles = await getCachedAuthorArticles(author.id);
  if (articles.length === 0 && author.role !== "admin") notFound();

  const citiesCovered = Array.from(new Set(articles.map((a) => a.cityName))).sort();

  const breadcrumbs = [
    { name: "Home", path: "/" },
    { name: author.displayName, path: `/author/${author.slug}` },
  ];

  return (
    <>
      <section className="border-b border-ink-200 bg-ink-50 py-10">
        <Container>
          <Breadcrumbs items={breadcrumbs} />
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-ink-200 bg-white">
              {author.avatarUrl ? (
                <Image src={author.avatarUrl} alt={author.displayName} fill className="object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center font-serif text-xl font-bold text-ink-400">
                  {author.displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <h1 className="font-serif text-2xl font-bold text-ink-900">{author.displayName}</h1>
              <p className="text-xs text-ink-500">
                {articles.length} published article{articles.length === 1 ? "" : "s"}
                {citiesCovered.length > 0 ? ` · Covers ${citiesCovered.join(", ")}` : ""}
              </p>
            </div>
          </div>
          {author.bio && <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-600">{author.bio}</p>}
        </Container>
      </section>

      <Container className="py-10">
        <SectionHeading title={`Articles by ${author.displayName}`} />
        {articles.length === 0 ? (
          <div className="mt-6">
            <EmptyState title="No published articles yet" description="Check back soon." />
          </div>
        ) : (
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        )}
      </Container>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            breadcrumbJsonLd(breadcrumbs),
            personJsonLd({ name: author.displayName, slug: author.slug || "", bio: author.bio, avatarUrl: author.avatarUrl }),
          ]),
        }}
      />
    </>
  );
}
