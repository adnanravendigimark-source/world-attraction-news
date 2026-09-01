import type { Metadata } from "next";
import Link from "next/link";
import Container from "@/components/Container";
import Breadcrumbs from "@/components/Breadcrumbs";
import { buildMetadata } from "@/lib/seo";
import { SITE_NAME, CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = buildMetadata({
  title: `Editorial Policy | ${SITE_NAME}`,
  description: `How ${SITE_NAME} reviews, scores, publishes, and corrects contributor content.`,
  path: "/editorial-policy",
});

const breadcrumbs = [{ name: "Home", path: "/" }, { name: "Editorial Policy", path: "/editorial-policy" }];

export default function EditorialPolicyPage() {
  return (
    <Container className="py-10 sm:py-14">
      <Breadcrumbs items={breadcrumbs} />
      <h1 className="mt-3 font-serif text-2xl font-bold text-ink-900 sm:text-3xl">Editorial Policy</h1>
      <p className="mt-2 text-xs text-ink-500">Last updated: {new Date().toISOString().slice(0, 10)}</p>

      <div className="article-body mt-6 max-w-prose">
        <h2>Who writes for us</h2>
        <p>
          Every article is written by an approved local contributor — never generated, aggregated, or purchased.
          Applications go through an editorial approval step before anyone can submit content; see{" "}
          <Link href="/write-for-us">Write for Us</Link> for the full process.
        </p>

        <h2>Review process</h2>
        <p>
          Every submission enters a pending review queue. An editor reads the full article, checks it against our
          own site's existing content for duplication, and either approves it (with a 0–10 quality score and
          optional written feedback), sends it back for revisions, or declines it. Nothing is published
          automatically — approval and publication are two separate, deliberate steps.
        </p>

        <h2>Editing contributor content</h2>
        <p>
          Editors may correct factual errors, tighten unclear writing, fix formatting, or adjust SEO metadata before
          publication. Substantive factual changes are made in good faith to improve accuracy, not to alter a
          contributor's reporting or opinions.
        </p>

        <h2>Corrections</h2>
        <p>
          If you spot an error in a published article, contact us at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> with the article link and a description of the
          issue. Confirmed factual errors are corrected as soon as practical; a published article's "Updated" date
          reflects when a real, substantive edit was made after publication — not a fabricated or cosmetic refresh
          date.
        </p>

        <h2>Independence</h2>
        <p>
          {SITE_NAME} does not accept payment from attractions, parks, or venues in exchange for coverage, and
          coverage decisions are made independently of any commercial relationship.
        </p>

        <h2>Removing content</h2>
        <p>
          We may unpublish or remove an article that is found to be inaccurate, plagiarized, or in violation of our{" "}
          <Link href="/terms-and-conditions">Terms &amp; Conditions</Link>, at our editorial discretion.
        </p>
      </div>
    </Container>
  );
}
