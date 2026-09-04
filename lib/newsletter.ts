import { sql } from "./db";
import { sendNewsletterArticleBroadcast } from "./email";

export interface Subscriber {
  id: number;
  email: string;
  source: string;
  createdAt: string;
  unsubscribedAt: string | null;
}

export async function subscribeToNewsletter(
  email: string,
  source: string
): Promise<{ alreadySubscribed: boolean; id?: number }> {
  const existing = await sql`
    SELECT id, unsubscribed_at FROM newsletter_subscribers WHERE email = ${email} LIMIT 1
  `;
  if (existing.length) {
    if (existing[0].unsubscribed_at) {
      // Re-subscribe if previously unsubscribed
      await sql`
        UPDATE newsletter_subscribers
        SET unsubscribed_at = NULL, source = ${source}
        WHERE id = ${existing[0].id}
      `;
      return { alreadySubscribed: false, id: Number(existing[0].id) };
    }
    return { alreadySubscribed: true, id: Number(existing[0].id) };
  }

  const rows = await sql`
    INSERT INTO newsletter_subscribers (email, source)
    VALUES (${email}, ${source})
    RETURNING id
  `;
  return { alreadySubscribed: false, id: rows[0]?.id ? Number(rows[0].id) : undefined };
}

export async function getSubscribers(): Promise<Subscriber[]> {
  try {
    const rows = await sql`
      SELECT id, email, source, created_at, unsubscribed_at
      FROM newsletter_subscribers
      ORDER BY created_at DESC
    `;
    return rows.map((r: any) => ({
      id: Number(r.id),
      email: r.email,
      source: r.source || "website",
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : "",
      unsubscribedAt: r.unsubscribed_at ? new Date(r.unsubscribed_at).toISOString() : null,
    }));
  } catch (err) {
    console.error("[newsletter] getSubscribers failed:", err);
    return [];
  }
}

export async function getActiveSubscribers(): Promise<Subscriber[]> {
  try {
    const rows = await sql`
      SELECT id, email, source, created_at, unsubscribed_at
      FROM newsletter_subscribers
      WHERE unsubscribed_at IS NULL
      ORDER BY created_at ASC
    `;
    return rows.map((r: any) => ({
      id: Number(r.id),
      email: r.email,
      source: r.source || "website",
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : "",
      unsubscribedAt: null,
    }));
  } catch (err) {
    console.error("[newsletter] getActiveSubscribers failed:", err);
    return [];
  }
}

export async function notifySubscribersOfNewArticle(article: {
  title: string;
  excerpt: string;
  image?: string | null;
  url: string;
  cityName?: string | null;
  categoryName?: string | null;
}): Promise<{ total: number; sent: number }> {
  try {
    const subscribers = await getActiveSubscribers();
    if (!subscribers.length) {
      return { total: 0, sent: 0 };
    }
    const emails = subscribers.map((s) => s.email);
    const { sent } = await sendNewsletterArticleBroadcast(emails, article);
    return { total: emails.length, sent };
  } catch (err) {
    console.error("[newsletter] notifySubscribersOfNewArticle failed:", err);
    return { total: 0, sent: 0 };
  }
}

export async function toggleSubscriberStatus(id: number | string): Promise<Subscriber | null> {
  const rows = await sql`
    UPDATE newsletter_subscribers
    SET unsubscribed_at = CASE WHEN unsubscribed_at IS NULL THEN now() ELSE NULL END
    WHERE id = ${id}
    RETURNING id, email, source, created_at, unsubscribed_at
  `;
  if (!rows.length) return null;
  const r = rows[0];
  return {
    id: Number(r.id),
    email: r.email,
    source: r.source || "website",
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : "",
    unsubscribedAt: r.unsubscribed_at ? new Date(r.unsubscribed_at).toISOString() : null,
  };
}

export async function deleteSubscriber(id: number | string): Promise<boolean> {
  await sql`DELETE FROM newsletter_subscribers WHERE id = ${id}`;
  return true;
}

