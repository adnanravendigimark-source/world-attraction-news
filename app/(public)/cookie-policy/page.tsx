import type { Metadata } from "next";
import Container from "@/components/Container";
import Breadcrumbs from "@/components/Breadcrumbs";
import { buildMetadata } from "@/lib/seo";
import { SITE_NAME, CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = buildMetadata({
  title: `Cookie Policy | ${SITE_NAME}`,
  description: `How ${SITE_NAME} uses cookies.`,
  path: "/cookie-policy",
});

const breadcrumbs = [{ name: "Home", path: "/" }, { name: "Cookie Policy", path: "/cookie-policy" }];

export default function CookiePolicyPage() {
  return (
    <Container className="py-10 sm:py-14">
      <Breadcrumbs items={breadcrumbs} />
      <h1 className="mt-3 font-serif text-2xl font-bold text-ink-900 sm:text-3xl">Cookie Policy</h1>
      <p className="mt-2 text-xs text-ink-500">Last updated: {new Date().toISOString().slice(0, 10)}</p>

      <div className="article-body mt-6 max-w-prose">
        <p>
          This is a short, honest list of every cookie {SITE_NAME} sets — there's no cookie consent banner because
          there's no advertising, analytics, or tracking cookie to consent to.
        </p>

        <h2>The one cookie we set</h2>
        <table>
          <thead>
            <tr>
              <th>Cookie</th>
              <th>Purpose</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Session cookie</td>
              <td>Keeps you signed in to the contributor dashboard or admin panel</td>
              <td>Until you log out, or it expires</td>
            </tr>
          </tbody>
        </table>
        <p>
          This cookie is strictly necessary — it only exists so a logged-in contributor or admin stays logged in
          between page loads. It is not set for readers who are just browsing published articles, and it is never
          used for advertising, analytics, or tracking you across other websites.
        </p>

        <h2>Third-party content</h2>
        <p>
          Article images are served from our own image storage. We don't embed third-party ad networks, tracking
          pixels, or social-media widgets that would set their own cookies.
        </p>

        <h2>Browser controls</h2>
        <p>
          You can clear or block cookies in your browser's settings at any time. Since our only cookie is the login
          session cookie, blocking it simply means you can't stay signed in to the dashboard or admin panel — it
          won't affect your ability to read published articles.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about this policy can be sent to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </div>
    </Container>
  );
}
