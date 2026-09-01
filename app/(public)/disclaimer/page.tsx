import type { Metadata } from "next";
import Container from "@/components/Container";
import Breadcrumbs from "@/components/Breadcrumbs";
import { buildMetadata } from "@/lib/seo";
import { SITE_NAME, CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = buildMetadata({
  title: `Disclaimer | ${SITE_NAME}`,
  description: `Important disclaimers about the information published on ${SITE_NAME}.`,
  path: "/disclaimer",
});

const breadcrumbs = [{ name: "Home", path: "/" }, { name: "Disclaimer", path: "/disclaimer" }];

export default function DisclaimerPage() {
  return (
    <Container className="py-10 sm:py-14">
      <Breadcrumbs items={breadcrumbs} />
      <h1 className="mt-3 font-serif text-2xl font-bold text-ink-900 sm:text-3xl">Disclaimer</h1>
      <p className="mt-2 text-xs text-ink-500">Last updated: {new Date().toISOString().slice(0, 10)}</p>

      <div className="article-body mt-6 max-w-prose">
        <h2>No affiliation</h2>
        <p>
          {SITE_NAME} is an independent news publication. We are not affiliated with, endorsed by, sponsored by, or
          operated on behalf of any attraction, theme park, museum, landmark, or venue mentioned or reviewed on this
          site.
        </p>

        <h2>Not official information</h2>
        <p>
          Content on {SITE_NAME} is independent reporting and commentary, not official communication from any
          attraction or venue. For binding information — current ticket prices, opening hours, accessibility, or
          booking terms — always check directly with the official source before making plans or a purchase.
        </p>

        <h2>Accuracy and timeliness</h2>
        <p>
          We make reasonable efforts to keep articles accurate at the time of publication, and to note when
          something has genuinely changed since. However, prices, hours, availability, and policies at real-world
          attractions can change at any time, sometimes without notice, and we cannot guarantee that every detail in
          an older article still reflects current reality.
        </p>

        <h2>No professional advice</h2>
        <p>
          Nothing on this site constitutes travel, legal, financial, or safety advice. Travel decisions, including
          bookings, itineraries, and safety precautions, are your own responsibility.
        </p>

        <h2>External links</h2>
        <p>
          Where an article links to an attraction's official site or another external resource, that link is
          provided for convenience. We are not responsible for the content, accuracy, or availability of external
          sites we don't control.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about this disclaimer can be sent to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </div>
    </Container>
  );
}
