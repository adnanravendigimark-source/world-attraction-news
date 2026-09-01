import type { Metadata } from "next";
import Container from "@/components/Container";
import Breadcrumbs from "@/components/Breadcrumbs";
import { buildMetadata } from "@/lib/seo";
import { SITE_NAME, CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = buildMetadata({
  title: `Terms & Conditions | ${SITE_NAME}`,
  description: `The terms governing use of ${SITE_NAME}, including contributor submissions.`,
  path: "/terms-and-conditions",
});

const breadcrumbs = [{ name: "Home", path: "/" }, { name: "Terms & Conditions", path: "/terms-and-conditions" }];

export default function TermsPage() {
  return (
    <Container className="py-10 sm:py-14">
      <Breadcrumbs items={breadcrumbs} />
      <h1 className="mt-3 font-serif text-2xl font-bold text-ink-900 sm:text-3xl">Terms &amp; Conditions</h1>
      <p className="mt-2 text-xs text-ink-500">Last updated: {new Date().toISOString().slice(0, 10)}</p>

      <div className="article-body mt-6 max-w-prose">
        <h2>Using this site</h2>
        <p>
          {SITE_NAME} is provided for informational purposes — reporting on attraction and travel news in the
          cities we cover. By using this site, you agree to use it lawfully and not to attempt to disrupt,
          scrape at scale, or interfere with its normal operation.
        </p>

        <h2>Accuracy of information</h2>
        <p>
          We make reasonable efforts to keep published articles accurate and up to date, but ticket prices, hours,
          and attraction details can change without notice. Always confirm time-sensitive details (pricing,
          opening hours, availability) directly with the attraction or venue before visiting.
        </p>

        <h2>Contributor submissions</h2>
        <p>
          By submitting an article as an approved contributor, you confirm the content is your own original work,
          written specifically for {SITE_NAME}, and you grant us the right to review, edit, publish, and display it
          on the site. We may edit submissions for clarity, accuracy, length, or house style before publication, and
          may decline, unpublish, or remove content at our editorial discretion.
        </p>
        <p>
          You remain responsible for the accuracy of what you submit. Content that is plagiarized, defamatory,
          misleading, or otherwise unlawful will be rejected or removed, and repeated violations may result in
          account suspension.
        </p>

        <h2>Intellectual property</h2>
        <p>
          Published articles, the {SITE_NAME} name, and site design are protected by copyright and may not be
          reproduced elsewhere without permission, beyond normal fair-use quoting with attribution and a link back.
        </p>

        <h2>No affiliation</h2>
        <p>
          {SITE_NAME} is editorially independent and is not affiliated with, endorsed by, or operated by any
          attraction, park, or venue covered on this site.
        </p>

        <h2>Limitation of liability</h2>
        <p>
          The site and its content are provided "as is" without warranties of any kind. {SITE_NAME} is not liable
          for any loss or damage arising from reliance on information published here — see our{" "}
          <a href="/disclaimer">Disclaimer</a> for more detail.
        </p>

        <h2>Changes to these terms</h2>
        <p>We may update these terms from time to time; continued use of the site after a change constitutes acceptance of the updated terms.</p>

        <h2>Contact</h2>
        <p>
          Questions about these terms can be sent to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </div>
    </Container>
  );
}
