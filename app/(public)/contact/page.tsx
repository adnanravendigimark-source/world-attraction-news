import type { Metadata } from "next";
import Container from "@/components/Container";
import Breadcrumbs from "@/components/Breadcrumbs";
import ContactForm from "@/components/ContactForm";
import { buildMetadata } from "@/lib/seo";
import { SITE_NAME, CONTACT_EMAIL, SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = buildMetadata({
  title: `Contact Us | ${SITE_NAME}`,
  description: "Get in touch with the Attraction Travel News editorial team.",
  path: "/contact",
});

const breadcrumbs = [{ name: "Home", path: "/" }, { name: "Contact", path: "/contact" }];

export default function ContactPage() {
  return (
    <Container className="py-10 sm:py-14">
      <Breadcrumbs items={breadcrumbs} />
      <h1 className="mt-3 font-serif text-2xl font-bold text-ink-900 sm:text-3xl">Contact Us</h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-600">
        Questions about a story, a correction request, or a general inquiry — reach out directly.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-4">
          <div className="rounded-lg border border-ink-200 bg-white p-5">
            <h2 className="text-sm font-bold text-ink-900">Editorial &amp; General Inquiries</h2>
            <p className="mt-1.5 text-xs text-ink-600">
              Story tips, corrections, or general questions about our coverage.
            </p>
            <a href={`mailto:${CONTACT_EMAIL}`} className="mt-3 inline-block text-sm font-semibold text-signal hover:underline">
              {CONTACT_EMAIL}
            </a>
          </div>
        </div>

        <div className="rounded-lg border border-ink-200 bg-white p-6">
          <h2 className="font-serif text-base font-bold text-ink-900">Send a Message</h2>
          <p className="mt-1 text-xs text-ink-500">We read every message and typically reply within a few business days.</p>
          <div className="mt-5">
            <ContactForm />
          </div>
        </div>
      </div>
    </Container>
  );
}
