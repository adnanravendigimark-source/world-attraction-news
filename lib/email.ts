// Email delivery abstraction. This project ships with no email provider
// wired up by default (no such service was part of the original request),
// so this falls back to logging the email to the server console — real
// enough to develop and test the reset-password flow end-to-end locally,
// but reset links will NOT actually be emailed until a provider is
// configured.
//
// To send real emails, set RESEND_API_KEY in your .env (a free account at
// https://resend.com works) — this uses their HTTP API directly with
// fetch(), no extra dependency required. Swap this file for a different
// provider's HTTP API the same way if you'd rather use one of those.
import { SITE_NAME, CONTACT_EMAIL, SITE_URL } from "./site";

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const subject = `Reset your ${SITE_NAME} password`;
  const html = `
    <p>Someone requested a password reset for your ${SITE_NAME} contributor account.</p>
    <p><a href="${resetUrl}">Click here to reset your password</a> (link expires in 1 hour).</p>
    <p>If you didn't request this, you can safely ignore this email.</p>
  `;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(
      `[email] RESEND_API_KEY is not set — password reset email NOT sent. Reset link for ${to}:\n${resetUrl}`
    );
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${SITE_NAME} <${CONTACT_EMAIL}>`,
        to: [to],
        subject,
        html,
      }),
    });
    if (!res.ok) {
      console.error("[email] Resend API error:", res.status, await res.text().catch(() => ""));
    }
  } catch (err) {
    console.error("[email] Failed to send via Resend:", err);
  }
}

// Generic workflow-notification email — used by lib/notifications.ts for
// every event in the notification system (account approved/rejected,
// article submitted/reviewed/scored/published/unpublished, etc.). Same
// graceful-degradation pattern as every other email in this file: without
// RESEND_API_KEY, it logs instead of sending rather than pretending to
// have sent something it didn't.
export async function sendNotificationEmail(to: string, title: string, body: string, link: string): Promise<void> {
  const fullLink = link ? (link.startsWith("http") ? link : `${SITE_URL}${link}`) : "";
  const html = `
    <p>${body}</p>
    ${fullLink ? `<p><a href="${fullLink}">View it on ${SITE_NAME}</a></p>` : ""}
  `;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`[email] RESEND_API_KEY is not set — notification "${title}" NOT emailed to ${to} (saved in-app only).`);
    throw new Error("RESEND_API_KEY not configured");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `${SITE_NAME} <${CONTACT_EMAIL}>`,
      to: [to],
      subject: `${title} — ${SITE_NAME}`,
      html,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[email] Resend API error:", res.status, text);
    throw new Error(`Resend API error: ${res.status}`);
  }
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
  const subject = `[Contact form] ${input.subject || "New message"}`;
  const html = `
    <p><strong>From:</strong> ${input.name} (${input.email})</p>
    <p><strong>Subject:</strong> ${input.subject || "(none)"}</p>
    <p><strong>Message:</strong></p>
    <p>${input.message.replace(/\n/g, "<br />")}</p>
  `;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`[email] RESEND_API_KEY is not set — contact form notification NOT emailed (message was still saved).`);
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${SITE_NAME} <${CONTACT_EMAIL}>`,
        to: [CONTACT_EMAIL],
        reply_to: input.email,
        subject,
        html,
      }),
    });
    if (!res.ok) {
      console.error("[email] Resend API error:", res.status, await res.text().catch(() => ""));
    }
  } catch (err) {
    console.error("[email] Failed to send via Resend:", err);
  }
}
