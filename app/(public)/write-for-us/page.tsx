import type { Metadata } from "next";
import Link from "next/link";
import Container from "@/components/Container";
import Breadcrumbs from "@/components/Breadcrumbs";
import { buildMetadata } from "@/lib/seo";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = buildMetadata({
  title: `Write for Us | ${SITE_NAME}`,
  description: "How to become a contributor — who can apply, what we expect, and how articles are reviewed and scored.",
  path: "/write-for-us",
});

const breadcrumbs = [{ name: "Home", path: "/" }, { name: "Write for Us", path: "/write-for-us" }];

const STEPS = [
  {
    title: "1. Apply",
    body: "Sign up with your email (or Google) and tell us a little about yourself. Applications are reviewed by our editorial team — there's no cost to apply, and you can't submit anything until you're approved.",
  },
  {
    title: "2. Write directly on the site",
    body: "Once approved, every article is written in our on-site editor — there's no field to paste a link to an article published elsewhere. We don't accept syndicated content, AI-generated filler, or aggregated round-ups of other outlets' reporting.",
  },
  {
    title: "3. Automatic originality check",
    body: "Before submission, your draft is checked against every other article already on the site for duplicate or near-duplicate content. This isn't a wider plagiarism scan of the internet — it's a same-site originality safeguard, and a flagged draft still goes through, just with a note for the editor.",
  },
  {
    title: "4. Editorial review & scoring",
    body: "An editor reads the full submission and scores it 0–10 on accuracy, usefulness, and writing quality, with written feedback. An article can be approved, sent back for revisions, or declined.",
  },
  {
    title: "5. Publish",
    body: "An approved article isn't automatically live — publishing is a separate, deliberate step by the editorial team. Once published, it appears on its city page, its category page, the homepage, and search.",
  },
];

export default function WriteForUsPage() {
  return (
    <Container className="py-10 sm:py-14">
      <Breadcrumbs items={breadcrumbs} />
      <h1 className="mt-3 font-serif text-2xl font-bold text-ink-900 sm:text-3xl">Write for {SITE_NAME}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-600">
        We're looking for local contributors in cities around the world to report on attraction news where they
        live — ticket and pricing changes, new openings, closures, and events. Here's exactly how it works.
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        {STEPS.map((s) => (
          <div key={s.title} className="rounded-lg border border-ink-200 bg-white p-5">
            <h2 className="font-serif text-base font-bold text-ink-900">{s.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-600">{s.body}</p>
          </div>
        ))}
      </div>

      <div className="article-body mt-10 max-w-prose">
        <h2>Who can contribute</h2>
        <p>
          Anyone with real, first-hand knowledge of a city's attractions — locals, frequent visitors, and people
          working in or around tourism. You don't need previous journalism experience, but you do need to be able to
          write clearly and accurately about a real place you know.
        </p>

        <h2>Content expectations</h2>
        <p>
          Articles should be factual, specific, and useful to someone planning a visit or following attraction news
          in that city — not generic "top 10" filler that could describe any destination. Every article needs a
          city and, where relevant, a category (tickets &amp; pricing, new attractions, openings &amp; closures,
          events, or visitor tips).
        </p>

        <h2>Original content only</h2>
        <p>
          We do not accept links to content published elsewhere, syndicated wire copy, or articles substantially
          copied from other sites. Every submission must be written directly on {SITE_NAME} for the first time —
          there's no external-URL submission option anywhere in the contributor dashboard.
        </p>
      </div>

      <div className="mt-10 rounded-lg border border-ink-200 bg-white p-6 text-center sm:p-8">
        <h2 className="font-serif text-lg font-bold text-ink-900">Ready to apply?</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-600">
          Applications are reviewed by our editorial team — approval usually takes a few business days.
        </p>
        <Link
          href="/signup"
          className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-signal px-5 py-2.5 text-sm font-semibold text-white hover:bg-signal-dark"
        >
          Apply to Become a Contributor →
        </Link>
      </div>
    </Container>
  );
}
