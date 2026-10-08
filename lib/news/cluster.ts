// Phase 4 — group items that report the same real-world event into a story
// cluster. Runs after every fetch and on demand from the admin.
//
// Matching is deliberately conservative (see similarity.ts): a false merge
// hides a distinct story, a missed merge only costs a duplicate row the editor
// can see. Only travel-relevant / borderline items are clustered.
import { sql } from "../db";
import { normalizeUrl, prepareTitle, sameStoryPrepared, type PreparedTitle } from "./similarity";

const WINDOW_DAYS = 3;
const MAX_ITEMS = 2500;

interface Row {
  id: string;
  cluster_id: string | null;
  title: string;
  url: string;
  published_at: Date | null;
  created_at: Date;
  publisher: string;
  reliability: number;
  category: string;
}

interface Group {
  id: string | null; // existing cluster id, null when new
  members: Row[];
  prepared: PreparedTitle[];
  urls: Set<string>;
}

export interface ClusterRunResult {
  considered: number;
  assigned: number;
  newClusters: number;
  joinedExisting: number;
}

export async function runClustering(): Promise<ClusterRunResult> {
  const rows = (await sql`
    SELECT i.id, i.cluster_id, i.title, i.url, i.published_at, i.created_at, i.relevance_category,
           s.reliability_score AS reliability,
           CASE WHEN s.type = 'google_news_rss' AND i.author <> '' THEN lower(i.author) ELSE lower(s.name) END AS publisher
    FROM news_items i JOIN news_sources s ON s.id = i.source_id
    WHERE i.filter_status = 'relevant'
      AND i.status <> 'dismissed'
      AND COALESCE(i.published_at, i.created_at) > now() - (${WINDOW_DAYS}::int * interval '1 day')
    ORDER BY COALESCE(i.published_at, i.created_at) ASC
    LIMIT ${MAX_ITEMS}
  `) as any[];

  const items: Row[] = rows.map((r) => ({ ...r, category: r.relevance_category || "", reliability: Number(r.reliability ?? 50) }));
  const groups: Group[] = [];
  const byCluster = new Map<string, Group>();
  const pending: Row[] = [];

  for (const it of items) {
    if (it.cluster_id) {
      let g = byCluster.get(it.cluster_id);
      if (!g) {
        g = { id: it.cluster_id, members: [], prepared: [], urls: new Set() };
        byCluster.set(it.cluster_id, g);
        groups.push(g);
      }
      g.members.push(it);
      g.prepared.push(prepareTitle(it.title));
      g.urls.add(normalizeUrl(it.url));
    } else {
      pending.push(it);
    }
  }

  let joinedExisting = 0;
  const touched = new Set<Group>();
  const assignments: { item: Row; group: Group }[] = [];

  for (const it of pending) {
    const p = prepareTitle(it.title);
    const url = it.url ? normalizeUrl(it.url) : "";
    let best: Group | null = null;
    for (const g of groups) {
      // Same page linked from two feeds, or a matching headline.
      if (url && g.urls.has(url)) {
        best = g;
        break;
      }
      if (g.prepared.some((q) => sameStoryPrepared(p, q))) {
        best = g;
        break;
      }
    }
    if (!best) {
      best = { id: null, members: [], prepared: [], urls: new Set() };
      groups.push(best);
    } else if (best.id) {
      joinedExisting++;
    }
    best.members.push(it);
    best.prepared.push(p);
    if (url) best.urls.add(url);
    touched.add(best);
    assignments.push({ item: it, group: best });
  }

  let newClusters = 0;
  // Create clusters for brand-new groups.
  for (const g of touched) {
    if (g.id) continue;
    const rep = pickRepresentative(g.members);
    const created = await sql`
      INSERT INTO story_clusters (canonical_title, category, first_seen_at, last_seen_at, published_first_at)
      VALUES (${rep.title}, ${rep.category}, now(), now(), ${earliest(g.members)})
      RETURNING id
    `;
    g.id = created[0].id as string;
    newClusters++;
  }

  if (assignments.length) {
    await sql`
      UPDATE news_items i SET cluster_id = t.cid
      FROM unnest(${assignments.map((a) => a.item.id)}::uuid[], ${assignments.map((a) => a.group.id)}::uuid[]) AS t(iid, cid)
      WHERE i.id = t.iid
    `;
  }

  // Refresh stats for every touched cluster from ALL its members (not just the
  // ones inside the clustering window).
  const ids = [...touched].map((g) => g.id as string);
  if (ids.length) {
    await sql`
      UPDATE story_clusters c SET
        item_count = a.n, source_count = a.p, last_seen_at = a.last_at, published_first_at = a.first_at
      FROM (
        SELECT i.cluster_id, COUNT(*)::int AS n,
               COUNT(DISTINCT CASE WHEN s.type = 'google_news_rss' AND i.author <> '' THEN lower(i.author) ELSE lower(s.name) END)::int AS p,
               MAX(COALESCE(i.published_at, i.created_at)) AS last_at,
               MIN(COALESCE(i.published_at, i.created_at)) AS first_at
        FROM news_items i JOIN news_sources s ON s.id = i.source_id
        WHERE i.cluster_id = ANY(${ids}::uuid[])
        GROUP BY i.cluster_id
      ) a
      WHERE c.id = a.cluster_id
    `;
    for (const g of touched) {
      const rep = pickRepresentative(g.members);
      await sql`UPDATE story_clusters SET canonical_title = ${rep.title}, category = ${rep.category} WHERE id = ${g.id}`;
    }
  }

  return { considered: items.length, assigned: assignments.length, newClusters, joinedExisting };
}

// Best headline for the cluster: most reliable source, then earliest.
function pickRepresentative(members: Row[]): Row {
  return [...members].sort((a, b) => b.reliability - a.reliability || time(a) - time(b))[0];
}

const time = (r: Row) => new Date(r.published_at || r.created_at).getTime();
const earliest = (m: Row[]) => new Date(Math.min(...m.map(time))).toISOString();

// Detach everything and rebuild from scratch (used after changing the matcher).
export async function resetClustering(): Promise<void> {
  await sql`UPDATE news_items SET cluster_id = NULL`;
  await sql`DELETE FROM story_clusters`;
}
