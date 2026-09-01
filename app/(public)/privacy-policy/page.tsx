import type { Metadata } from "next";
import Link from "next/link";
import Container from "@/components/Container";
import Breadcrumbs from "@/components/Breadcrumbs";
import { buildMetadata } from "@/lib/seo";
import { SITE_NAME, CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = buildMetadata({
  title: `Privacy Policy | ${SITE_NAME}`,
  description: `How ${SITE_NAME} collects and uses information from readers and contributors.`,
  path: "/privacy-policy",
});

const breadcrumbs = [{ name: "Home", path: "/" }, { name: "Privacy Policy", path: "/privacy-policy" }];

export default function PrivacyPolicyPage() {
  return (
    <Container className="py-10 sm:py-14">
      <Breadcrumbs items={breadcrumbs} />
      <h1 className="mt-3 font-serif text-2xl font-bold text-ink-900 sm:text-3xl">Privacy Policy</h1>
      <p className="mt-2 text-xs text-ink-500">Last updated: {new Date().toISOString().slice(0, 10)}</p>

      <div className="article-body mt-6 max-w-prose">
        <h2>Information we collect</h2>
        <p>
          When you apply to become a contributor, we collect your email address, display name, a short bio, and the
          city you're applying to write for (or your Google account's name/email/avatar if you sign up with
          Google). When you submit an article, we store the content, images, and category you provide, along with
          your account and submission history.
        </p>
        <p>
          If you use the contact form, we store your name, email address, subject, and message. If you subscribe to
          our newsletter, we store your email address and which page you subscribed from.
        </p>

        <h2>How we use it</h2>
        <p>
          Contributor account information is used to manage the approval process, attribute published articles, and
          contact you about your submissions. Contact form messages are used only to respond to your inquiry.
          Newsletter emails are used only to send the updates you signed up for. We do not sell reader or
          contributor data to third parties.
        </p>

        <h2>Cookies</h2>
        <p>
          We use a single essential session cookie to keep contributors and admins logged in — required for the
          contributor dashboard and admin panel to function, not used for advertising or cross-site tracking. See
          our <Link href="/cookie-policy">Cookie Policy</Link> for details.
        </p>

        <h2>Data retention</h2>
        <p>
          Contributor accounts and article history are retained for as long as the account is active. Contact form
          messages and newsletter subscriptions are retained until you ask us to delete them.
        </p>

        <h2>Your choices</h2>
        <p>
          You can unsubscribe from newsletter emails at any time by contacting us. Contributors can request account
          deletion by contacting our support address below.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about this policy or your data can be sent to{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </div>
    </Container>
  );
}
