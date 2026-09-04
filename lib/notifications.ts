import { sql } from "./db";
import {
  sendNotificationEmail,
  sendAccountApprovedEmail,
  sendArticleSubmittedEmail,
  sendArticleApprovedEmail,
  sendArticleRejectedEmail,
  sendArticlePublishedEmail,
} from "./email";
import { createMagicToken } from "./auth";
import { getAppUrl } from "./appUrl";

// In-app + (best-effort) emailed notifications. Every notification is a
// real row in the database, created at the moment the real event happens
// (approval, rejection, submission, review, scoring, publish/unpublish) —
// never simulated or backfilled. The dashboard's Notification Center
// (components/contributor/NotificationCenter.tsx) reads this table directly.
export type NotificationType =
  | "account_approved"
  | "account_rejected"
  | "article_submitted"
  | "article_under_review"
  | "changes_requested"
  | "article_approved"
  | "article_rejected"
  | "article_scored"
  | "article_feedback_updated"
  | "article_published"
  | "article_unpublished";

export interface Notification {
  id: number;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string;
  readAt: string | null;
  emailSent: boolean;
  createdAt: string;
}

function rowToNotification(row: any): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body || "",
    link: row.link || "",
    readAt: row.read_at ? (row.read_at instanceof Date ? row.read_at.toISOString() : String(row.read_at)) : null,
    emailSent: Boolean(row.email_sent),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

// Creates the in-app notification row and, best-effort, sends the email via
// lib/email.ts (which itself logs instead of sending if RESEND_API_KEY
// isn't configured — see lib/email.ts). A failure in either step never
// throws back to the caller: notifications are important but must never
// block the actual workflow action (approve/reject/publish/etc.) that
// triggered them.
//
// `sendEmail`, if provided, is used instead of the generic notification
// template — this is how the dedicated, richer templates (article
// submitted/approved/rejected/published) get wired in below without this
// function needing to know about any of them. It must resolve to whether
// the email actually sent (never throw) — same contract as every
// `send*Email` function in lib/email.ts except sendNotificationEmail
// itself, which is the fallback used when no override is given.
export async function createNotification(input: {
  userId: string;
  userEmail: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  sendEmail?: () => Promise<boolean>;
}): Promise<void> {
  let emailSent = false;
  try {
    if (input.sendEmail) {
      emailSent = await input.sendEmail();
    } else {
      await sendNotificationEmail(input.userEmail, input.title, input.body, input.link || "");
      emailSent = true;
    }
  } catch (err) {
    console.error("[notifications] failed to send email:", err);
  }
  try {
    await sql`
      INSERT INTO notifications (user_id, type, title, body, link, email_sent)
      VALUES (${input.userId}, ${input.type}, ${input.title}, ${input.body}, ${input.link || ""}, ${emailSent})
    `;
  } catch (err) {
    console.error("[notifications] failed to record notification:", err);
  }
}

export async function getNotifications(userId: string, limit = 50): Promise<Notification[]> {
  try {
    const rows = await sql`
      SELECT * FROM notifications WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT ${limit}
    `;
    return rows.map(rowToNotification);
  } catch {
    return [];
  }
}

export async function getUnreadCount(userId: string): Promise<number> {
  try {
    const rows = await sql`
      SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = ${userId} AND read_at IS NULL
    `;
    return rows[0]?.count ?? 0;
  } catch {
    return 0;
  }
}

export async function markNotificationRead(id: number, userId: string): Promise<void> {
  await sql`UPDATE notifications SET read_at = now() WHERE id = ${id} AND user_id = ${userId} AND read_at IS NULL`;
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await sql`UPDATE notifications SET read_at = now() WHERE user_id = ${userId} AND read_at IS NULL`;
}

// --- Event-specific helpers -------------------------------------------
// One small wrapper per workflow event so API routes call a single,
// clearly-named function rather than hand-building title/body strings
// inline at every call site.

export async function notifyAccountApproved(user: {
  id: string;
  email: string;
  displayName: string;
  authProvider?: string;
  passwordHash?: string | null;
}) {
  const isGoogle = user.authProvider === "google" || !user.passwordHash;
  const appUrl = getAppUrl();
  let magicLoginUrl = `${appUrl}/contributor/dashboard`;
  let profileUrl = `${appUrl}/contributor/profile`;

  try {
    const magicToken = await createMagicToken({
      userId: user.id,
      email: user.email,
      action: "magic_login",
      next: isGoogle ? "/contributor/profile" : "/contributor/dashboard",
    });
    magicLoginUrl = `${appUrl}/api/auth/magic-login?token=${encodeURIComponent(magicToken)}&next=${encodeURIComponent(
      isGoogle ? "/contributor/profile" : "/contributor/dashboard"
    )}`;
    profileUrl = `${appUrl}/api/auth/magic-login?token=${encodeURIComponent(magicToken)}&next=/contributor/profile`;
  } catch (err) {
    console.error("[notifications] failed to create magic token:", err);
  }

  await createNotification({
    userId: user.id,
    userEmail: user.email,
    type: "account_approved",
    title: "Your account has been approved",
    body: isGoogle
      ? `Welcome, ${user.displayName || user.email}! Your account is approved. You can now set your password from your profile settings and start writing.`
      : `Welcome, ${user.displayName || user.email} — you can now log in and start writing articles.`,
    link: isGoogle ? "/contributor/profile" : "/contributor",
    sendEmail: () =>
      sendAccountApprovedEmail(user.email, {
        displayName: user.displayName,
        loginUrl: magicLoginUrl,
        profileUrl,
        isGoogleUser: isGoogle,
      }),
  });
}

export async function notifyAccountRejected(user: { id: string; email: string; displayName: string }) {
  await createNotification({
    userId: user.id,
    userEmail: user.email,
    type: "account_rejected",
    title: "Your account application was not approved",
    body: `Your contributor application for ${user.displayName || user.email} was not approved at this time.`,
  });
}

export async function notifyArticleSubmitted(user: { id: string; email: string }, article: { id: string; title: string }) {
  const link = `/contributor/articles/${article.id}`;
  await createNotification({
    userId: user.id,
    userEmail: user.email,
    type: "article_submitted",
    title: "Article submitted for review",
    body: `"${article.title}" has been submitted and is now in the review queue.`,
    link,
    sendEmail: () => sendArticleSubmittedEmail(user.email, { title: article.title, dashboardUrl: link }),
  });
}

export async function notifyArticleUnderReview(user: { id: string; email: string }, article: { id: string; title: string }) {
  await createNotification({
    userId: user.id,
    userEmail: user.email,
    type: "article_under_review",
    title: "Your article is now under review",
    body: `An editor has started reviewing "${article.title}".`,
    link: `/contributor/articles/${article.id}`,
  });
}

export async function notifyChangesRequested(
  user: { id: string; email: string },
  article: { id: string; title: string },
  feedback: string
) {
  await createNotification({
    userId: user.id,
    userEmail: user.email,
    type: "changes_requested",
    title: "Changes requested on your article",
    body: `An editor requested changes on "${article.title}"${feedback ? `: ${feedback}` : "."} You can edit and resubmit it.`,
    link: `/contributor/articles/${article.id}/edit`,
  });
}

export async function notifyArticleApproved(
  user: { id: string; email: string },
  article: { id: string; title: string },
  review?: { score?: number | null; feedback?: string }
) {
  const link = `/contributor/articles/${article.id}`;
  const score = review?.score ?? null;
  const feedback = review?.feedback || "";
  await createNotification({
    userId: user.id,
    userEmail: user.email,
    type: "article_approved",
    title: "Your article was approved",
    body: `"${article.title}" was approved${score !== null ? ` (score: ${score}/10)` : ""} and is now ready to be scheduled or published.${feedback ? ` Editor's feedback: ${feedback}` : ""}`,
    link,
    sendEmail: () => sendArticleApprovedEmail(user.email, { title: article.title, score, feedback, dashboardUrl: link }),
  });
}

export async function notifyArticleRejected(
  user: { id: string; email: string },
  article: { id: string; title: string },
  feedback: string
) {
  const link = `/contributor/articles/${article.id}`;
  await createNotification({
    userId: user.id,
    userEmail: user.email,
    type: "article_rejected",
    title: "Your article was rejected",
    body: `"${article.title}" was rejected${feedback ? `: ${feedback}` : "."}`,
    link,
    sendEmail: () => sendArticleRejectedEmail(user.email, { title: article.title, feedback, dashboardUrl: link }),
  });
}

export async function notifyArticleScored(user: { id: string; email: string }, article: { id: string; title: string }, score: number) {
  await createNotification({
    userId: user.id,
    userEmail: user.email,
    type: "article_scored",
    title: "Your article was scored",
    body: `"${article.title}" received a score of ${score}/10.`,
    link: `/contributor/articles/${article.id}`,
  });
}

// Fires when an admin corrects an article's feedback after it was already
// reviewed (see updateArticleReview() in lib/articles.ts) - separate from
// notifyArticleScored below so a feedback-only correction (no score change)
// still lets the contributor know something changed, without implying their
// score moved when it didn't.
export async function notifyArticleFeedbackUpdated(
  user: { id: string; email: string },
  article: { id: string; title: string },
  feedback: string
) {
  await createNotification({
    userId: user.id,
    userEmail: user.email,
    type: "article_feedback_updated",
    title: "Editor feedback updated",
    body: `The editor's feedback on "${article.title}" was updated${feedback ? `: ${feedback}` : "."}`,
    link: `/contributor/articles/${article.id}`,
  });
}

export async function notifyArticlePublished(
  user: { id: string; email: string },
  article: {
    id: string;
    title: string;
    url: string;
    score?: number | null;
    feedback?: string | null;
  }
) {
  const score = article.score ?? null;
  const feedback = article.feedback || "";
  const body = `"${article.title}" is approved and live on the public site!${score !== null ? ` (Quality Score: ${score}/10)` : ""}${feedback ? ` — Feedback: ${feedback}` : ""}`;

  await createNotification({
    userId: user.id,
    userEmail: user.email,
    type: "article_published",
    title: "Your article is approved and live!",
    body,
    link: article.url,
    sendEmail: () =>
      sendArticlePublishedEmail(user.email, {
        title: article.title,
        url: article.url,
        score,
        feedback,
        dashboardUrl: `/contributor/articles/${article.id}`,
      }),
  });
}

export async function notifyArticleUnpublished(user: { id: string; email: string }, article: { id: string; title: string }) {
  await createNotification({
    userId: user.id,
    userEmail: user.email,
    type: "article_unpublished",
    title: "Your article was unpublished",
    body: `"${article.title}" has been taken down from the public site.`,
    link: `/contributor/articles/${article.id}`,
  });
}
