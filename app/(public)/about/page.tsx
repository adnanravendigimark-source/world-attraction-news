import type { Metadata } from "next";
import Link from "next/link";
import Container from "@/components/Container";
import Breadcrumbs from "@/components/Breadcrumbs";
import { getCities } from "@/lib/cities";
import { buildMetadata } from "@/lib/seo";
import { SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildMetadata({
  title: `About Us | ${SITE_NAME}`,
  description: "How Attraction Travel News works — city-based contributors, editorial review, and no aggregated links.",
  path: "/about",
});

const breadcrumbs = [{ name: "Home", path: "/" }, { name: "About", path: "/about" }];

export default async function AboutPage() {
  const cities = await getCities();

  return (
    <Container className="py-10 sm:py-14">
      <Breadcrumbs items={breadcrumbs} />
      <h1 className="mt-3 font-serif text-2xl font-bold text-ink-900 sm:text-3xl">About {SITE_NAME}</h1>

      <div className="article-body mt-6 max-w-prose">
        <p>
          {SITE_NAME} is a city-based news portal covering attractions, theme parks, museums, and tourist sites
          around the world. Every article is organized under the city it's about, and written by an approved local
          contributor rather than aggregated from other outlets.
        </p>

        <h2>What we cover</h2>
        <p>
          New ride and exhibit openings, ticket and pricing changes, closures and renovations, seasonal events, and
          practical visitor updates for attractions in the cities we operate in. Coverage is always about a specific
          city's attractions — this isn't a general travel-tips blog.
        </p>

        <h2>Global coverage, one city at a time</h2>
        <p>
          {SITE_NAME} grows city by city. Each city page is run by contributors who actually live there or visit
          regularly, rather than one central desk writing about places nobody on staff has been to.
          {cities.length > 0 && (
            <>
              {" "}Right now that's{" "}
              {cities.map((c, i) => (
                <span key={c.id}>
                  <Link href={`/cities/${c.slug}`} className="text-signal hover:underline">
                    {c.name}
                  </Link>
                  {i < cities.length - 2 ? ", " : i === cities.length - 2 ? ", and " : ""}
                </span>
              ))}
              {" "}— see the full, current list on the{" "}
              <Link href="/cities" className="text-signal hover:underline">
                Cities page
              </Link>
              , which updates automatically as new cities are added.
            </>
          )}
        </p>

        <h2>How articles get published</h2>
        <p>
          Anyone can apply to become a contributor. Every application is reviewed by our editorial team, and an
          applicant can't log in or submit anything until their account is approved. Once approved, a contributor
          can write about any city on the site — they choose which city each article belongs to when they submit
          it.
        </p>
        <p>
          Every submitted article is written directly on the site — we don't accept links to external articles or
          aggregate content from other outlets. An editor reads the full submission, checks it for originality,
          scores it out of 10, and either publishes it, sends it back with feedback, or declines it. See{" "}
          <Link href="/write-for-us" className="text-signal hover:underline">
            Write for Us
          </Link>{" "}
          for the full editorial process, and our{" "}
          <Link href="/editorial-policy" className="text-signal hover:underline">
            Editorial Policy
          </Link>{" "}
          for how we handle corrections and standards.
        </p>

        <h2>Editorial independence</h2>
        <p>
          {SITE_NAME} is not affiliated with, endorsed by, or operated by any of the attractions, parks, or venues
          covered on this site. Coverage decisions are made independently by our editorial team and contributors,
          and we don't accept payment in exchange for coverage.
        </p>

        <h2>Why readers use {SITE_NAME}</h2>
        <p>
          Every published article has gone through a real review process — no unreviewed submissions, no
          content-farmed listicles, no fake bylines. If you want to know whether a ticket price changed, an exhibit
          closed, or a new attraction opened in a city we cover, this is written by someone with an actual reason to
          know.
        </p>
      </div>

      <div className="mt-8 rounded-lg border border-ink-200 bg-white p-6">
        <h2 className="font-serif text-lg font-bold text-ink-900">Interested in contributing?</h2>
        <p className="mt-2 text-sm text-ink-600">
          If you want to write about attraction news in any of our covered cities, read how it works and apply.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/write-for-us"
            className="inline-flex items-center gap-1.5 rounded-md border border-ink-300 px-4 py-2 text-sm font-semibold text-ink-700 hover:border-ink-900"
          >
            How It Works
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center gap-1.5 rounded-md bg-signal px-4 py-2 text-sm font-semibold text-white hover:bg-signal-dark"
          >
            Apply to Become a Contributor →
          </Link>
        </div>
      </div>
    </Container>
  );
}
