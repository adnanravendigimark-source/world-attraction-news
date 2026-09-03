import { sql } from "./db";

// Real, admin-managed calendar events — festivals, ride openings, seasonal
// celebrations. The public /calendar page reads only from this table; there
// is no seeded or hardcoded event data anywhere. An empty calendar is the
// honest state until an admin actually creates events from /admin/events.
export type EventType = "festival" | "opening" | "exhibition" | "special" | "celebration";

export interface EventItem {
  id: string;
  title: string;
  description: string;
  eventDate: string; // YYYY-MM-DD
  endDate: string | null;
  location: string;
  cityId: string | null;
  cityName: string | null;
  citySlug: string | null;
  eventType: EventType;
  image: string;
  imageAlt: string;
  articleId: string | null;
  articleSlug: string | null;
  articleCitySlug: string | null;
  createdAt: string;
  updatedAt: string;
}

function toDateOnly(value: any): string {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  // Neon returns DATE columns as "YYYY-MM-DD" strings already.
  return String(value).slice(0, 10);
}

function rowToEvent(row: any): EventItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description || "",
    eventDate: toDateOnly(row.event_date),
    endDate: row.end_date ? toDateOnly(row.end_date) : null,
    location: row.location || "",
    cityId: row.city_id || null,
    cityName: row.city_name || null,
    citySlug: row.city_slug || null,
    eventType: (row.event_type as EventType) || "special",
    image: row.image || "",
    imageAlt: row.image_alt || "",
    articleId: row.article_id || null,
    articleSlug: row.article_slug || null,
    articleCitySlug: row.article_city_slug || null,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  };
}

const JOIN_SELECT = `
  SELECT e.*, c.name AS city_name, c.slug AS city_slug, a.slug AS article_slug, ac.slug AS article_city_slug
  FROM events e
  LEFT JOIN cities c ON c.id = e.city_id
  LEFT JOIN articles a ON a.id = e.article_id
  LEFT JOIN cities ac ON ac.id = a.city_id
`;

export interface EventFilters {
  citySlug?: string;
  eventType?: EventType;
  query?: string;
}

function buildFilterClause(filters: EventFilters | undefined, params: unknown[]): string {
  const clauses: string[] = [];
  if (filters?.citySlug) {
    params.push(filters.citySlug);
    clauses.push(`c.slug = $${params.length}`);
  }
  if (filters?.eventType) {
    params.push(filters.eventType);
    clauses.push(`e.event_type = $${params.length}`);
  }
  if (filters?.query && filters.query.trim()) {
    params.push(`%${filters.query.trim()}%`);
    const idx = params.length;
    clauses.push(`(e.title ILIKE $${idx} OR e.location ILIKE $${idx} OR e.description ILIKE $${idx})`);
  }
  return clauses.length ? ` AND ${clauses.join(" AND ")}` : "";
}

// Every event within [from, to] (inclusive), used for the month-grid view —
// an event also counts as "in range" if it started before `from` but its
// end_date extends into the range (multi-day events).
export async function getEventsInRange(from: string, to: string, filters?: EventFilters): Promise<EventItem[]> {
  try {
    const params: unknown[] = [from, to];
    const filterClause = buildFilterClause(filters, params);
    const rows = await sql(
      `${JOIN_SELECT} WHERE e.event_date <= $2 AND COALESCE(e.end_date, e.event_date) >= $1${filterClause} ORDER BY e.event_date ASC`,
      params
    );
    return rows.map(rowToEvent);
  } catch {
    return [];
  }
}

export async function getUpcomingEvents(limit = 50, filters?: EventFilters): Promise<EventItem[]> {
  try {
    const params: unknown[] = [];
    const filterClause = buildFilterClause(filters, params);
    params.push(limit);
    const rows = await sql(
      `${JOIN_SELECT} WHERE e.event_date >= CURRENT_DATE${filterClause} ORDER BY e.event_date ASC LIMIT $${params.length}`,
      params
    );
    return rows.map(rowToEvent);
  } catch {
    return [];
  }
}

export async function getPastEvents(limit = 50, filters?: EventFilters): Promise<EventItem[]> {
  try {
    const params: unknown[] = [];
    const filterClause = buildFilterClause(filters, params);
    params.push(limit);
    const rows = await sql(
      `${JOIN_SELECT} WHERE e.event_date < CURRENT_DATE${filterClause} ORDER BY e.event_date DESC LIMIT $${params.length}`,
      params
    );
    return rows.map(rowToEvent);
  } catch {
    return [];
  }
}

// Ascending (soonest first) — the admin manager's own list, so what's
// coming up next is what an admin most needs to see/manage first. Matches
// the client-side re-sort EventsManager applies after create/edit.
export async function getAllEvents(limit = 300): Promise<EventItem[]> {
  try {
    const rows = await sql(`${JOIN_SELECT} ORDER BY e.event_date ASC LIMIT $1`, [limit]);
    return rows.map(rowToEvent);
  } catch {
    return [];
  }
}

export async function getEventById(id: string): Promise<EventItem | undefined> {
  const rows = await sql(`${JOIN_SELECT} WHERE e.id = $1 LIMIT 1`, [id]);
  return rows.length ? rowToEvent(rows[0]) : undefined;
}

export async function createEvent(input: {
  title: string;
  description: string;
  eventDate: string;
  endDate: string | null;
  location: string;
  cityId: string | null;
  eventType: EventType;
  image: string;
  imageAlt: string;
  articleId: string | null;
}): Promise<EventItem> {
  if (!input.title.trim()) throw new Error("Event title is required.");
  if (!input.eventDate) throw new Error("Event date is required.");
  const rows = await sql`
    INSERT INTO events (title, description, event_date, end_date, location, city_id, event_type, image, image_alt, article_id, updated_at)
    VALUES (${input.title.trim()}, ${input.description}, ${input.eventDate}, ${input.endDate}, ${input.location}, ${input.cityId}, ${input.eventType}, ${input.image}, ${input.imageAlt}, ${input.articleId}, now())
    RETURNING *
  `;
  const created = await getEventById(rows[0].id);
  return created!;
}

export async function updateEvent(
  id: string,
  updates: Partial<{
    title: string;
    description: string;
    eventDate: string;
    endDate: string | null;
    location: string;
    cityId: string | null;
    eventType: EventType;
    image: string;
    imageAlt: string;
    articleId: string | null;
  }>
): Promise<EventItem> {
  const current = await sql`SELECT * FROM events WHERE id = ${id} LIMIT 1`;
  if (!current.length) throw new Error("Event not found.");
  const c = current[0];
  await sql`
    UPDATE events
    SET title = ${updates.title ?? c.title},
        description = ${updates.description ?? c.description},
        event_date = ${updates.eventDate ?? c.event_date},
        end_date = ${updates.endDate !== undefined ? updates.endDate : c.end_date},
        location = ${updates.location ?? c.location},
        city_id = ${updates.cityId !== undefined ? updates.cityId : c.city_id},
        event_type = ${updates.eventType ?? c.event_type},
        image = ${updates.image ?? c.image},
        image_alt = ${updates.imageAlt ?? c.image_alt},
        article_id = ${updates.articleId !== undefined ? updates.articleId : c.article_id},
        updated_at = now()
    WHERE id = ${id}
  `;
  const updated = await getEventById(id);
  return updated!;
}

export async function deleteEvent(id: string): Promise<void> {
  await sql`DELETE FROM events WHERE id = ${id}`;
}
