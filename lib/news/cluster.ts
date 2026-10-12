// Phase 4 — group items that report the same real-world event into a story
// cluster. Runs after every fetch and on demand from the admin.
//
// Matching is deliberately conservative (see similarity.ts): a false merge
// hides a distinct story, a missed merge only costs a duplicate row the editor
// can see. Only travel-relevant / borderline items are clustered.
import { sql } from "../db";
import { normalizeUrl, prepareTitle, sameStoryPrepared, type PreparedTitle } from "./similarity";

const WINDOW_DAYS = 3;
// A story still receiving items stays open this long after it was first seen
// (a strike or a rule change can run for a week); new items are compared
// with all of its members, not only those inside the 3-day window.
const DEVELOPING_DAYS = 14;
const MAX_ITEMS = 2500;

interface Row {
  id: string;
  cluster_id: string | null;
  title: string;
  description: string;
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

// windowDays: how far back to group items; the destination search uses 7 so
// a week of fresh news for a place is grouped, not just the last few days.
export async function runClustering(opts: { windowDays?: number } = {}): Promise<ClusterRunResult> {
  const windowDays = Math.min(Math.max(opts.windowDays ?? WINDOW_DAYS, 1), 14);
  const rows = (await sql`
    SELECT i.id, i.cluster_id, i.title, i.description, i.url, i.published_at, i.created_at, i.relevance_category,
           s.reliability_score AS reliability,
           CASE WHEN s.type = 'google_news_rss' AND i.author <> '' THEN lower(i.author) ELSE lower(s.name) END AS publisher
    FROM news_items i JOIN news_sources s ON s.id = i.source_id
    WHERE i.filter_status = 'relevant'
      AND i.status <> 'dismissed'
      AND (
        COALESCE(i.published_at, i.created_at) > now() - (${windowDays}::int * interval '1 day')
        OR i.cluster_id IN (
          SELECT c.id FROM story_clusters c
          WHERE c.status NOT IN ('ignored', 'merged')
            AND c.last_seen_at > now() - (${windowDays}::int * interval '1 day')
            AND c.first_seen_at > now() - (${DEVELOPING_DAYS}::int * interval '1 day')
        )
      )
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
      g.prepared.push(prepareTitle(it.title, it.description));
      g.urls.add(normalizeUrl(it.url));
    } else {
      pending.push(it);
    }
  }

  let joinedExisting = 0;
  const touched = new Set<Group>();
  const assignments: { item: Row; group: Group }[] = [];

  for (const it of pending) {
    const p = prepareTitle(it.title, it.description);
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
    await refreshClusterStats(ids);
    for (const g of touched) {
      const rep = pickRepresentative(g.members);
      await sql`UPDATE story_clusters SET canonical_title = ${rep.title}, category = ${rep.category} WHERE id = ${g.id}`;
    }
  }

  return { considered: items.length, assigned: assignments.length, newClusters, joinedExisting };
}

async function refreshClusterStats(ids: string[]): Promise<void> {
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
}

export interface MergeCandidate {
  id: string;
  titles: string[];
  descriptions?: string[];
  keptApart?: string[]; // stories an editor split from this one
  hasArticle: boolean;
  itemCount: number;
  firstSeen: number;
}

// Groups clusters that report the same event (any headline pair matches).
// Within a group the target is the cluster that already has an article, else
// the one with most items, else the oldest. A cluster with its own article
// is never merged into another (its draft would lose its story).
export function planMerges(clusters: MergeCandidate[]): { target: string; merge: string[] }[] {
  const parent = clusters.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const prepared = clusters.map((c) => c.titles.slice(0, 8).map((t, i) => prepareTitle(t, c.descriptions?.[i] || "")));
  const apart = (a: MergeCandidate, b: MergeCandidate) => !!a.keptApart?.includes(b.id) || !!b.keptApart?.includes(a.id);
  for (let i = 0; i < clusters.length; i++) {
    for (let j = i + 1; j < clusters.length; j++) {
      if (find(i) === find(j)) continue;
      if (apart(clusters[i], clusters[j])) continue;
      if (prepared[i].some((a) => prepared[j].some((b) => sameStoryPrepared(a, b)))) parent[find(j)] = find(i);
    }
  }
  const groups = new Map<number, number[]>();
  clusters.forEach((_, i) => groups.set(find(i), [...(groups.get(find(i)) || []), i]));
  const plans: { target: string; merge: string[] }[] = [];
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    const sorted = [...members].sort(
      (a, b) => Number(clusters[b].hasArticle) - Number(clusters[a].hasArticle) || clusters[b].itemCount - clusters[a].itemCount || clusters[a].firstSeen - clusters[b].firstSeen
    );
    const target = clusters[sorted[0]];
    const merge = sorted.slice(1).filter((i) => !clusters[i].hasArticle).map((i) => clusters[i].id);
    if (merge.length) plans.push({ target: target.id, merge });
  }
  return plans;
}

// Merges clusters that turned out to be the same event (for example two
// headlines that only matched once the matcher improved). Items move to the
// target; the merged cluster is kept with status 'merged' and merged_into
// pointing at the target, and its research moves along if the target has none.
export async function mergeDuplicateClusters(): Promise<{ merged: number }> {
  // kept_apart arrives with scripts/setup-db.mjs; run without it until then.
  const rows = (await sql`
    SELECT c.id, c.item_count, c.first_seen_at, c.kept_apart,
           EXISTS (SELECT 1 FROM articles a WHERE a.news_cluster_id = c.id) AS has_article,
           ARRAY(SELECT i.title FROM news_items i WHERE i.cluster_id = c.id ORDER BY i.created_at LIMIT 8) AS titles,
           ARRAY(SELECT i.description FROM news_items i WHERE i.cluster_id = c.id ORDER BY i.created_at LIMIT 8) AS descriptions
    FROM story_clusters c
    WHERE c.status NOT IN ('ignored', 'merged') AND c.last_seen_at > now() - (${WINDOW_DAYS + 1}::int * interval '1 day')
  `.catch(
    () => sql`
    SELECT c.id, c.item_count, c.first_seen_at, '{}'::uuid[] AS kept_apart,
           EXISTS (SELECT 1 FROM articles a WHERE a.news_cluster_id = c.id) AS has_article,
           ARRAY(SELECT i.title FROM news_items i WHERE i.cluster_id = c.id ORDER BY i.created_at LIMIT 8) AS titles,
           ARRAY(SELECT i.description FROM news_items i WHERE i.cluster_id = c.id ORDER BY i.created_at LIMIT 8) AS descriptions
    FROM story_clusters c
    WHERE c.status NOT IN ('ignored', 'merged') AND c.last_seen_at > now() - (${WINDOW_DAYS + 1}::int * interval '1 day')
  `
  )) as any[];
  const plans = planMerges(
    rows.map((r) => ({
      id: r.id,
      titles: r.titles || [],
      descriptions: r.descriptions || [],
      keptApart: (r.kept_apart || []).map(String),
      hasArticle: !!r.has_article,
      itemCount: Number(r.item_count || 0),
      firstSeen: new Date(r.first_seen_at).getTime(),
    }))
  );
  let merged = 0;
  for (const p of plans) {
    for (const id of p.merge) {
      await mergeInto(p.target, id);
      merged++;
    }
    await refreshClusterStats([p.target]);
  }
  return { merged };
}

// Moves every item of `id` into `target` and marks `id` merged. Research
// moves along when the target has none.
async function mergeInto(target: string, id: string): Promise<void> {
  await sql`UPDATE news_items SET cluster_id = ${target} WHERE cluster_id = ${id}`;
  await sql`
    UPDATE story_research SET cluster_id = ${target}
    WHERE cluster_id = ${id} AND NOT EXISTS (SELECT 1 FROM story_research r WHERE r.cluster_id = ${target})`;
  await sql`UPDATE story_clusters SET status = 'merged', merged_into = ${target} WHERE id = ${id}`.catch(
    () => sql`UPDATE story_clusters SET status = 'merged' WHERE id = ${id}` // merged_into not migrated yet
  );
}

// Headline and category from the cluster's most reliable, earliest item.
async function refreshCanonical(ids: string[]): Promise<void> {
  await sql`
    UPDATE story_clusters c SET canonical_title = r.title, category = r.cat
    FROM (
      SELECT DISTINCT ON (i.cluster_id) i.cluster_id, i.title, COALESCE(i.relevance_category, '') AS cat
      FROM news_items i JOIN news_sources s ON s.id = i.source_id
      WHERE i.cluster_id = ANY(${ids}::uuid[])
      ORDER BY i.cluster_id, s.reliability_score DESC, COALESCE(i.published_at, i.created_at) ASC
    ) r
    WHERE c.id = r.cluster_id
  `;
}

// Editor action: merge stories into one. A story that already has an article
// can be the target but is never merged away (its draft would lose its story).
export async function mergeStories(targetId: string, ids: string[]): Promise<{ merged: number }> {
  const all = [targetId, ...ids.filter((id) => id !== targetId)];
  if (all.length < 2) throw new Error("Pick at least one other story to merge.");
  const rows = (await sql`
    SELECT c.id, c.status, EXISTS (SELECT 1 FROM articles a WHERE a.news_cluster_id = c.id) AS has_article
    FROM story_clusters c WHERE c.id = ANY(${all}::uuid[])`) as any[];
  const byId = new Map(rows.map((r) => [String(r.id), r]));
  if (!byId.get(targetId) || byId.get(targetId).status === "merged") throw new Error("The target story no longer exists.");
  let merged = 0;
  for (const id of all.slice(1)) {
    const r = byId.get(id);
    if (!r || r.status === "merged") continue;
    if (r.has_article) throw new Error("A story that already has an article can't be merged into another; merge the others into it instead.");
    await mergeInto(targetId, id);
    merged++;
  }
  await refreshClusterStats([targetId]);
  await refreshCanonical([targetId]);
  return { merged };
}

// Editor action: move one item to another story, or (targetId null) split it
// off into a story of its own. The two stories are then kept apart, so the
// automatic duplicate merge doesn't undo the split.
export async function moveItem(itemId: string, targetId: string | null): Promise<{ clusterId: string; emptied: boolean }> {
  const item = (await sql`SELECT id, cluster_id, title, relevance_category, published_at, created_at FROM news_items WHERE id = ${itemId} LIMIT 1`)[0];
  if (!item) throw new Error("Item not found.");
  const from = item.cluster_id ? String(item.cluster_id) : null;
  let to = targetId;
  if (to) {
    const t = (await sql`SELECT id, status FROM story_clusters WHERE id = ${to} LIMIT 1`)[0];
    if (!t || t.status === "merged") throw new Error("The target story no longer exists.");
    if (to === from) return { clusterId: to, emptied: false };
  } else {
    const at = new Date(item.published_at || item.created_at).toISOString();
    const created = await sql`
      INSERT INTO story_clusters (canonical_title, category, first_seen_at, last_seen_at, published_first_at)
      VALUES (${item.title}, ${item.relevance_category || ""}, now(), now(), ${at})
      RETURNING id`;
    to = String(created[0].id);
  }
  await sql`UPDATE news_items SET cluster_id = ${to} WHERE id = ${itemId}`;
  if (from) {
    await sql`UPDATE story_clusters SET kept_apart = array_append(kept_apart, ${to}::uuid) WHERE id = ${from} AND NOT (${to}::uuid = ANY(kept_apart))`.catch(() => {});
    await sql`UPDATE story_clusters SET kept_apart = array_append(kept_apart, ${from}::uuid) WHERE id = ${to} AND NOT (${from}::uuid = ANY(kept_apart))`.catch(() => {});
  }
  const ids = from ? [from, to!] : [to!];
  await refreshClusterStats(ids);
  await refreshCanonical(ids);
  // A story left with no items is retired like a merged one.
  let emptied = false;
  if (from) {
    const left = Number((await sql`SELECT COUNT(*)::int AS n FROM news_items WHERE cluster_id = ${from}`)[0]?.n ?? 0);
    const hasArticle = (await sql`SELECT 1 FROM articles WHERE news_cluster_id = ${from} LIMIT 1`).length > 0;
    if (left === 0 && !hasArticle) {
      await sql`UPDATE story_clusters SET status = 'merged', merged_into = ${to} WHERE id = ${from}`.catch(() => sql`UPDATE story_clusters SET status = 'merged' WHERE id = ${from}`);
      emptied = true;
    }
  }
  return { clusterId: to!, emptied };
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
