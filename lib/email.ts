// Centralized email delivery. Every outbound email in the app — signup
// welcome, password reset, article submitted/approved/rejected/published,
// the generic notification fallback, and the internal contact-form alert —
// goes through the single sendEmail() below, using the Resend SDK
// (https://resend.com). Branded HTML/text content is built in
// lib/emailTemplates.ts; this file only knows how to deliver it.
//
// RESEND_API_KEY lives in server-only environment variables (see
// .env.example) and is never imported by client code — every function here
// runs in API routes / server actions only. Without it set, emails are
// logged to the server console instead of sent — safe for local dev, not
// for production.
import { Resend } from "resend";
import { SITE_NAME, CONTACT_EMAIL } from "./site";
import {
  welcomeEmailTemplate,
  verifyEmailTemplate,
  accountApprovedEmailTemplate,
  passwordResetEmailTemplate,
  articleSubmittedEmailTemplate,
  articleApprovedEmailTemplate,
  articleRejectedEmailTemplate,
  articlePublishedEmailTemplate,
  genericNotificationEmailTemplate,
  contactNotificationEmailTemplate,
  newsletterSubscribedEmailTemplate,
  newsletterArticlePublishedEmailTemplate,
  type RenderedEmail,
} from "./emailTemplates";

// Resend requires the "from" address's domain to be verified in your
// Resend account before it will send from it (Domains -> Add Domain in the
// Resend dashboard) — until worldattractionnews.com is verified there,
// sends will fail with a 403 ("Domain not verified"). RESEND_FROM_EMAIL can
// still override this per-environment if needed.
const FROM_ADDRESS = process.env.RESEND_FROM_EMAIL || `${SITE_NAME} <info@worldattractionnews.com>`;

let resendClient: Resend | null = null;
function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!resendClient) resendClient = new Resend(apiKey);
  return resendClient;
}

// The one real delivery path in the app. Never throws — every failure
// (missing API key, network error, Resend-side rejection) is logged and
// swallowed here so a broken email provider can never take down the
// signup/reset/review/publish flow that triggered it. Returns whether the
// email actually sent, for callers (like lib/notifications.ts) that want
// to record that outcome.
async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}): Promise<boolean> {
  const client = getResendClient();
  if (!client) {
    console.warn(`[email] RESEND_API_KEY is not set — "${input.subject}" NOT sent to ${input.to}. Logging instead:\n${input.text}`);
    return false;
  }
  try {
    const { error } = await client.emails.send({
      from: FROM_ADDRESS,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
      ...(input.replyTo ? { replyTo: input.replyTo } : {}),
    });
    if (error) {
      console.error("[email] Resend API error:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email] Failed to send via Resend:", err);
    return false;
  }
}

async function sendRendered(to: string, rendered: RenderedEmail, replyTo?: string): Promise<boolean> {
  return sendEmail({ to, subject: rendered.subject, html: rendered.html, text: rendered.text, replyTo });
}

// --- Public, typed senders — one per email the app sends ----------------
// Adding a future notification type is just: write a template function in
// lib/emailTemplates.ts, then a one-line wrapper here that calls
// sendRendered(). No other file needs to know about Resend.

export async function sendWelcomeEmail(to: string, displayName: string): Promise<boolean> {
  return sendRendered(to, welcomeEmailTemplate({ displayName, dashboardUrl: "/login" }));
}

// Sent right after password signup, in place of sendWelcomeEmail — the
// "pending approval" welcome email only goes out once they've actually
// verified via this link (see /api/auth/verify-email, which calls
// sendWelcomeEmail itself once the token is consumed). Google signups
// never need this — see findOrCreateGoogleUser in lib/users.ts.
export async function sendVerifyEmail(to: string, input: { displayName: string; verifyUrl: string }): Promise<boolean> {
  return sendRendered(to, verifyEmailTemplate(input));
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  await sendRendered(to, passwordResetEmailTemplate({ resetUrl }));
}

export async function sendAccountApprovedEmail(
  to: string,
  input: { displayName: string; loginUrl: string; profileUrl: string; isGoogleUser?: boolean }
): Promise<boolean> {
  return sendRendered(to, accountApprovedEmailTemplate(input));
}

export async function sendArticleSubmittedEmail(to: string, input: { title: string; dashboardUrl: string }): Promise<boolean> {
  return sendRendered(to, articleSubmittedEmailTemplate(input));
}

export async function sendArticleApprovedEmail(
  to: string,
  input: { title: string; score: number | null; feedback: string; dashboardUrl: string }
): Promise<boolean> {
  return sendRendered(to, articleApprovedEmailTemplate(input));
}

export async function sendArticleRejectedEmail(
  to: string,
  input: { title: string; feedback: string; dashboardUrl: string }
): Promise<boolean> {
  return sendRendered(to, articleRejectedEmailTemplate(input));
}

export async function sendArticlePublishedEmail(to: string, input: { title: string; url: string }): Promise<boolean> {
  return sendRendered(to, articlePublishedEmailTemplate(input));
}

// Generic workflow-notification email — used by lib/notifications.ts as the
// fallback for any notification type that doesn't have a dedicated
// template above (account approved/rejected, under review, changes
// requested, standalone score update, unpublished). Unlike every other
// function in this file, this one *throws* on failure rather than
// swallowing it — lib/notifications.ts relies on that to know whether to
// record `email_sent = true` on the notification row, and already wraps
// this call in its own try/catch.
export async function sendNotificationEmail(to: string, title: string, body: string, link: string): Promise<void> {
  const rendered = genericNotificationEmailTemplate({ title, body, link });
  const sent = await sendEmail({ to, subject: rendered.subject, html: rendered.html, text: rendered.text });
  if (!sent) throw new Error("Email delivery failed or RESEND_API_KEY not configured");
}

// Notifies the editorial inbox of a new /contact submission. The message
// itself is always saved to contact_messages regardless of whether this
// email actually sends — see lib/contactMessages.ts — so a reader's message
// is never lost even without RESEND_API_KEY configured, just not proactively
// emailed until then.
export async function sendContactNotificationEmail(input: {
  name: string;
  email: string;
  subject: string;
  message: string;
}): Promise<void> {
  const rendered = contactNotificationEmailTemplate(input);
  await sendEmail({ to: CONTACT_EMAIL, subject: rendered.subject, html: rendered.html, text: rendered.text, replyTo: input.email });
}

export async function sendNewsletterWelcomeEmail(to: string): Promise<boolean> {
  return sendRendered(to, newsletterSubscribedEmailTemplate());
}

export async function sendNewsletterArticleBroadcast(
  toEmails: string[],
  input: {
    title: string;
    excerpt: string;
    image?: string | null;
    url: string;
    cityName?: string | null;
    categoryName?: string | null;
  }
): Promise<{ sent: number; failed: number }> {
  const rendered = newsletterArticlePublishedEmailTemplate(input);
  let sent = 0;
  let failed = 0;

  // Process in small parallel chunks to avoid throttling
  const BATCH_SIZE = 10;
  for (let i = 0; i < toEmails.length; i += BATCH_SIZE) {
    const batch = toEmails.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (email) => {
        try {
          return await sendRendered(email, rendered);
        } catch {
          return false;
        }
      })
    );
    for (const res of results) {
      if (res) sent++;
      else failed++;
    }
  }

  return { sent, failed };
}

