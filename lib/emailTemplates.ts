import { SITE_NAME, SITE_URL, SITE_TAGLINE, SUPPORT_EMAIL } from "./site";

// Centralized, branded HTML email templates. Every transactional email in
// the app (signup, password reset, article submitted/approved/rejected/
// published, and the generic notification fallback) renders through
// renderEmailLayout() below, so they all share one consistent, responsive,
// table-based design instead of each call site hand-rolling its own markup.
//
// Table-based layout + inline styles is deliberate, not legacy habit: most
// email clients (Outlook desktop in particular) strip <style> blocks and
// don't support modern CSS layout, so this is the actual professional
// standard for transactional email, not a shortcut.

const BRAND = {
  ink950: "#0A0B0E",
  ink900: "#111318",
  ink700: "#2B303C",
  ink500: "#5A6273",
  ink300: "#B0B6C3",
  ink200: "#D6D9E0",
  ink100: "#ECEEF2",
  paper: "#FAF9F5",
  paperCard: "#FFFFFF",
  signal: "#C22938",
  signalDark: "#9E1D2A",
  signalLight: "#FDF2F3",
  emerald: "#059669",
  emeraldLight: "#ECFDF5",
  amber: "#D97706",
  amberLight: "#FFFBEB",
};

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Cheap, dependency-free HTML -> plain-text fallback shared by every
// template, so every email sent has a real text/plain part (better inbox
// placement, and readable in clients/previews that don't render HTML).
function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/(div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

// The shared shell: dark masthead with the site name, a white content
// card, an optional call-to-action button, and a footer with contact info.
// `bodyHtml` is the caller's already-built inner content (paragraphs,
// feedback boxes, score badges, etc.) — this function only wraps it.
function renderEmailLayout(opts: {
  previewText: string;
  heading: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
}): string {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="light" />
<title>${escapeHtml(opts.heading)}</title>
</head>
<body style="margin:0; padding:0; background-color:${BRAND.paper}; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0;">${escapeHtml(opts.previewText)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.paper}; padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; background-color:${BRAND.paperCard}; border-radius:12px; overflow:hidden; box-shadow:0 1px 3px rgba(10,11,14,0.08);">
          <tr>
            <td style="background-color:${BRAND.ink950}; padding:24px 32px;">
              <span style="font-family:Georgia,'Times New Roman',serif; font-size:20px; font-weight:700; color:#FFFFFF; letter-spacing:0.02em;">${escapeHtml(SITE_NAME)}</span>
              <div style="font-size:11px; color:${BRAND.ink300}; margin-top:2px; text-transform:uppercase; letter-spacing:0.08em;">${escapeHtml(SITE_TAGLINE)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 32px 8px 32px;">
              <h1 style="margin:0 0 16px 0; font-family:Georgia,'Times New Roman',serif; font-size:24px; line-height:1.3; font-weight:700; color:${BRAND.ink950};">${escapeHtml(opts.heading)}</h1>
              <div style="font-size:15px; line-height:1.65; color:${BRAND.ink700};">
                ${opts.bodyHtml}
              </div>
              ${
                opts.ctaLabel && opts.ctaUrl
                  ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 8px 0;">
                      <tr>
                        <td style="border-radius:8px; background-color:${BRAND.signal};">
                          <a href="${opts.ctaUrl}" target="_blank" style="display:inline-block; padding:12px 24px; font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; color:#FFFFFF; text-decoration:none;">${escapeHtml(opts.ctaLabel)}</a>
                        </td>
                      </tr>
                    </table>`
                  : ""
              }
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 32px 32px;">
              <hr style="border:none; border-top:1px solid ${BRAND.ink100}; margin:0 0 20px 0;" />
              <p style="margin:0 0 4px 0; font-size:12px; color:${BRAND.ink500};">
                Questions? Reach us at <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND.signal}; text-decoration:none;">${SUPPORT_EMAIL}</a>
              </p>
              <p style="margin:0; font-size:12px; color:${BRAND.ink300};">
                &copy; ${year} ${escapeHtml(SITE_NAME)}. All rights reserved. &middot; <a href="${SITE_URL}" style="color:${BRAND.ink300}; text-decoration:underline;">${SITE_URL.replace(/^https?:\/\//, "")}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 14px 0;">${text}</p>`;
}

// A quoted callout box for admin feedback — used by both the approval and
// rejection templates so editor notes are visually distinct from the rest
// of the email rather than buried in a run-on sentence.
function feedbackBox(label: string, feedback: string, accent: string, bg: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 18px 0;">
    <tr>
      <td style="background-color:${bg}; border-left:3px solid ${accent}; border-radius:4px; padding:14px 16px;">
        <p style="margin:0 0 4px 0; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:${accent};">${escapeHtml(label)}</p>
        <p style="margin:0; font-size:14px; line-height:1.6; color:${BRAND.ink700}; white-space:pre-line;">${escapeHtml(feedback)}</p>
      </td>
    </tr>
  </table>`;
}

// A round score badge (0–10) colored by tier, used in the approval email.
function scoreBadge(score: number): string {
  const color = score >= 7 ? BRAND.emerald : score >= 4 ? BRAND.amber : BRAND.signal;
  const bg = score >= 7 ? BRAND.emeraldLight : score >= 4 ? BRAND.amberLight : BRAND.signalLight;
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 20px 0;">
    <tr>
      <td style="background-color:${bg}; border-radius:8px; padding:12px 18px;">
        <span style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:${color};">Quality Score</span>
        <span style="display:block; font-family:Georgia,'Times New Roman',serif; font-size:28px; font-weight:700; color:${color}; margin-top:2px;">${score}<span style="font-size:15px; color:${BRAND.ink500}; font-family:-apple-system,sans-serif;">/10</span></span>
      </td>
    </tr>
  </table>`;
}

function absoluteUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return SITE_URL;
  return pathOrUrl.startsWith("http") ? pathOrUrl : `${SITE_URL}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

// --- Individual templates ------------------------------------------------

export function welcomeEmailTemplate(input: { displayName: string; dashboardUrl: string }): RenderedEmail {
  const heading = `Welcome to ${SITE_NAME}, ${input.displayName || "there"}!`;
  const bodyHtml =
    paragraph(
      `Thanks for creating a contributor account with ${escapeHtml(SITE_NAME)}. We're glad to have you on board.`
    ) +
    paragraph(
      `Your account is currently <strong>pending approval</strong> from our editorial team. Once approved, you'll be able to log in and start writing articles about attractions, festivals, and destinations from around the world.`
    ) +
    paragraph(`We'll email you as soon as a decision is made — usually within a day or two.`);
  const html = renderEmailLayout({
    previewText: `Welcome to ${SITE_NAME} — your account is pending approval.`,
    heading,
    bodyHtml,
    ctaLabel: "Visit the site",
    ctaUrl: absoluteUrl(input.dashboardUrl || "/"),
  });
  return { subject: `Welcome to ${SITE_NAME}`, html, text: htmlToText(html) };
}

export function verifyEmailTemplate(input: { displayName: string; verifyUrl: string }): RenderedEmail {
  const heading = `Verify your email, ${input.displayName || "there"}`;
  const bodyHtml =
    paragraph(
      `Thanks for applying to become a contributor at ${escapeHtml(SITE_NAME)}. Before your application can be reviewed, please confirm this is really your email address.`
    ) +
    paragraph(`Click the button below to verify. This link expires in <strong>24 hours</strong>.`) +
    paragraph(`Once verified, your application goes to our editorial team for approval — we'll email you again once there's a decision.`) +
    paragraph(`If you didn't apply for a contributor account, you can safely ignore this email.`);
  const html = renderEmailLayout({
    previewText: "Confirm your email to continue your contributor application.",
    heading,
    bodyHtml,
    ctaLabel: "Verify Email Address",
    ctaUrl: input.verifyUrl,
  });
  return { subject: `Verify your email — ${SITE_NAME}`, html, text: htmlToText(html) };
}

export function accountApprovedEmailTemplate(input: {
  displayName: string;
  loginUrl: string;
  profileUrl: string;
  isGoogleUser?: boolean;
}): RenderedEmail {
  const name = input.displayName || "there";
  const heading = `Your account is approved 🎉`;
  let bodyHtml =
    paragraph(
      `Great news, <strong>${escapeHtml(name)}</strong> — your contributor account for ${escapeHtml(
        SITE_NAME
      )} has been approved by our editorial team.`
    ) +
    paragraph(
      `You can now access your contributor dashboard, create new articles, and share stories with readers around the world.`
    );

  if (input.isGoogleUser) {
    bodyHtml +=
      feedbackBox(
        "Set Your Account Password",
        "Since you signed up with Google, you can also set a password for your account. This allows you to log in directly using your email and password at any time.",
        BRAND.emerald,
        BRAND.emeraldLight
      ) +
      paragraph(
        `Click the button below to go directly to your profile settings and set your password:`
      );
  } else {
    bodyHtml += paragraph(
      `Click below to go to your contributor dashboard and start drafting your first article:`
    );
  }

  const ctaUrl = input.isGoogleUser ? input.profileUrl || input.loginUrl : input.loginUrl || input.profileUrl;
  const ctaLabel = input.isGoogleUser ? "Set Password & View Profile" : "Go to Your Dashboard";

  const html = renderEmailLayout({
    previewText: `Your ${SITE_NAME} contributor account is approved!`,
    heading,
    bodyHtml,
    ctaLabel,
    ctaUrl: absoluteUrl(ctaUrl),
  });

  return { subject: `Your account is approved — ${SITE_NAME}`, html, text: htmlToText(html) };
}

export function passwordResetEmailTemplate(input: { resetUrl: string }): RenderedEmail {
  const heading = "Reset your password";
  const bodyHtml =
    paragraph(`Someone requested a password reset for your ${escapeHtml(SITE_NAME)} contributor account.`) +
    paragraph(`Click the button below to choose a new password. This link expires in <strong>1 hour</strong>.`) +
    paragraph(`If you didn't request this, you can safely ignore this email — your password will stay unchanged.`);
  const html = renderEmailLayout({
    previewText: "Reset your password — this link expires in 1 hour.",
    heading,
    bodyHtml,
    ctaLabel: "Reset Password",
    ctaUrl: input.resetUrl,
  });
  return { subject: `Reset your ${SITE_NAME} password`, html, text: htmlToText(html) };
}

export function articleSubmittedEmailTemplate(input: { title: string; dashboardUrl: string }): RenderedEmail {
  const heading = "Article submitted for review";
  const bodyHtml =
    paragraph(`Your article <strong>"${escapeHtml(input.title)}"</strong> has been submitted and is now in our editorial review queue.`) +
    paragraph(`Our team will review it and get back to you with a decision — approved, rejected, or with requested changes — along with feedback.`);
  const html = renderEmailLayout({
    previewText: `"${input.title}" is now in the review queue.`,
    heading,
    bodyHtml,
    ctaLabel: "View your article",
    ctaUrl: absoluteUrl(input.dashboardUrl),
  });
  return { subject: `Article submitted: "${input.title}"`, html, text: htmlToText(html) };
}

export function articleApprovedEmailTemplate(input: {
  title: string;
  score: number | null;
  feedback: string;
  dashboardUrl: string;
}): RenderedEmail {
  const heading = "Your article was approved 🎉";
  let bodyHtml = paragraph(
    `Great news — your article <strong>"${escapeHtml(input.title)}"</strong> was approved by our editorial team and is ready to be scheduled or published.`
  );
  if (input.score !== null && input.score !== undefined) {
    bodyHtml += scoreBadge(input.score);
  }
  if (input.feedback.trim()) {
    bodyHtml += feedbackBox("Editor's feedback", input.feedback, BRAND.emerald, BRAND.emeraldLight);
  }
  const html = renderEmailLayout({
    previewText: `"${input.title}" was approved${input.score != null ? ` — scored ${input.score}/10` : ""}.`,
    heading,
    bodyHtml,
    ctaLabel: "View your article",
    ctaUrl: absoluteUrl(input.dashboardUrl),
  });
  return { subject: `Approved: "${input.title}"`, html, text: htmlToText(html) };
}

export function articleRejectedEmailTemplate(input: { title: string; feedback: string; dashboardUrl: string }): RenderedEmail {
  const heading = "Your article was not approved";
  let bodyHtml = paragraph(
    `Your article <strong>"${escapeHtml(input.title)}"</strong> was reviewed by our editorial team and was not approved for publication at this time.`
  );
  if (input.feedback.trim()) {
    bodyHtml += feedbackBox("Editor's feedback", input.feedback, BRAND.signal, BRAND.signalLight);
  }
  bodyHtml += paragraph(`We appreciate the effort you put into it — feel free to draft something new any time.`);
  const html = renderEmailLayout({
    previewText: `"${input.title}" was not approved.`,
    heading,
    bodyHtml,
    ctaLabel: "View your dashboard",
    ctaUrl: absoluteUrl(input.dashboardUrl),
  });
  return { subject: `Update on "${input.title}"`, html, text: htmlToText(html) };
}

export function articlePublishedEmailTemplate(input: { title: string; url: string }): RenderedEmail {
  const heading = "Your article is now live";
  const bodyHtml =
    paragraph(`<strong>"${escapeHtml(input.title)}"</strong> has been published and is now live on ${escapeHtml(SITE_NAME)} for readers around the world to see.`) +
    paragraph(`Nice work — thanks for contributing.`);
  const html = renderEmailLayout({
    previewText: `"${input.title}" is now live on ${SITE_NAME}.`,
    heading,
    bodyHtml,
    ctaLabel: "View live article",
    ctaUrl: absoluteUrl(input.url),
  });
  return { subject: `Now live: "${input.title}"`, html, text: htmlToText(html) };
}

// Generic fallback template used for every notification type that doesn't
// have a dedicated template above (account approved/rejected, under
// review, changes requested, standalone score update, unpublished, and any
// future notification type added without a bespoke template). Still fully
// branded via renderEmailLayout — just a single-paragraph body instead of
// bespoke content blocks.
export function genericNotificationEmailTemplate(input: { title: string; body: string; link: string }): RenderedEmail {
  const html = renderEmailLayout({
    previewText: input.body,
    heading: input.title,
    bodyHtml: paragraph(escapeHtml(input.body)),
    ctaLabel: input.link ? "View on " + SITE_NAME : undefined,
    ctaUrl: input.link ? absoluteUrl(input.link) : undefined,
  });
  return { subject: `${input.title} — ${SITE_NAME}`, html, text: htmlToText(html) };
}

// Internal notification (editorial inbox), not user-facing — still uses
// the shared branded shell for consistency across every email the app
// sends.
export function contactNotificationEmailTemplate(input: {
  name: string;
  email: string;
  subject: string;
  message: string;
}): RenderedEmail {
  const bodyHtml =
    paragraph(`<strong>From:</strong> ${escapeHtml(input.name)} (${escapeHtml(input.email)})`) +
    paragraph(`<strong>Subject:</strong> ${escapeHtml(input.subject || "(none)")}`) +
    feedbackBox("Message", input.message, BRAND.ink700, BRAND.ink100);
  const html = renderEmailLayout({
    previewText: `New contact form message from ${input.name}`,
    heading: "New contact form message",
    bodyHtml,
  });
  return { subject: `[Contact form] ${input.subject || "New message"}`, html, text: htmlToText(html) };
}

export function newsletterSubscribedEmailTemplate(): RenderedEmail {
  const heading = `Welcome to ${SITE_NAME} Dispatches`;
  const bodyHtml =
    paragraph(`Thank you for subscribing to <strong>${escapeHtml(SITE_NAME)}</strong>!`) +
    paragraph(`You will now receive our curated editorial dispatches featuring the latest theme park developments, attraction grand openings, insider travel guides, and breaking news delivered straight to your inbox.`) +
    paragraph(`We respect your inbox — expect only quality, fact-checked reporting with no spam.`);
  const html = renderEmailLayout({
    previewText: `Welcome to ${SITE_NAME}! You are now subscribed to our dispatches.`,
    heading,
    bodyHtml,
    ctaLabel: "Explore Latest News",
    ctaUrl: absoluteUrl("/latest-news"),
  });
  return { subject: `Welcome to ${SITE_NAME} — You're Subscribed!`, html, text: htmlToText(html) };
}

export function newsletterArticlePublishedEmailTemplate(input: {
  title: string;
  excerpt: string;
  image?: string | null;
  url: string;
  cityName?: string | null;
  categoryName?: string | null;
}): RenderedEmail {
  let bodyHtml = "";

  if (input.cityName || input.categoryName) {
    const metaTag = [input.cityName, input.categoryName].filter(Boolean).join(" • ");
    bodyHtml += `<div style="font-size:11px; font-weight:700; color:${BRAND.signal}; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:12px;">${escapeHtml(metaTag)}</div>`;
  }

  if (input.image) {
    bodyHtml += `<div style="margin-bottom:20px; border-radius:8px; overflow:hidden; border:1px solid ${BRAND.ink100};"><img src="${escapeHtml(input.image)}" alt="${escapeHtml(input.title)}" style="width:100%; max-height:280px; object-fit:cover; display:block;" /></div>`;
  }

  bodyHtml += paragraph(escapeHtml(input.excerpt || "A new attraction and travel story has just been published on Attraction News."));
  bodyHtml += `<p style="font-size:13px; color:${BRAND.ink500}; margin-top:16px;">Click the button below to read the full scoop and detailed insights on our site.</p>`;

  const html = renderEmailLayout({
    previewText: input.excerpt || `New story: ${input.title}`,
    heading: input.title,
    bodyHtml,
    ctaLabel: "Read Full Story",
    ctaUrl: absoluteUrl(input.url),
  });

  return { subject: `📰 New Story: ${input.title}`, html, text: htmlToText(html) };
}

