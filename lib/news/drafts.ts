// Create a news draft (articles.type = 'news') from a story cluster.
//
// No AI is involved here. The draft holds the researched facts as editor
// notes (no headings: news stories carry none) plus a "TODO" marker. It always lands as a DRAFT in the normal review workflow —
// nothing here can publish.
import { sql } from "../db";
import { createNewsDraft, getArticleById, type Article } from "../articles";
import { getLatestResearch, isKnown } from "./research";
import { loadGazetteer } from "./places";
import { pickNewsCategorySlug } from "./newsCategory";
import { resolveOrCreateCity } from "../cities";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const todo = (hint: string) => `<p><em>TODO: ${esc(hint)}</em></p>`;
const known = (v: string | undefined) => (isKnown(v) ? v : "");

export async function findExistingNewsDraft(clusterId: string): Promise<{ id: string } | null> {
  const rows = await sql`SELECT id FROM articles WHERE news_cluster_id = ${clusterId} AND type = 'news' ORDER BY updated_at DESC LIMIT 1`;
  return rows[0] ? { id: rows[0].id as string } : null;
}

export async function createDraftFromStory(clusterId: string): Promise<{ article: Article; created: boolean }> {
  const existing = await findExistingNewsDraft(clusterId);
  if (existing) {
    // Older drafts were created as 'draft', which the admin review screen hides.
    await sql`UPDATE articles SET status = 'pending' WHERE id = ${existing.id} AND status = 'draft'`;
    await fillNewsCategory(existing.id).catch(() => {});
    const a = await getArticleById(existing.id);
    if (a) return { article: a, created: false };
  }

  const clusters = await sql`SELECT canonical_title, category FROM story_clusters WHERE id = ${clusterId} LIMIT 1`;
  if (!clusters[0]) throw new Error("Story not found.");
  const title = String(clusters[0].canonical_title).replace(/\s[-–—|]\s[^-–—|]{2,40}$/, "").trim();

  const research = await getLatestResearch(clusterId);
  const f = research?.status === "done" ? research.facts : null;

  const happened = known(f?.what_happened);
  const detail = [known(f?.when) && `When: ${f?.when}`, known(f?.where) && `Where: ${f?.where}`, known(f?.what_changed) && `What changed: ${f?.what_changed}`]
    .filter(Boolean)
    .join(" ");
  const facts = (f?.important_facts || []).filter((x) => x.confidence !== "conflicting");

  // Editor notes, not a template: plain paragraphs and a fact list with TODO
  // markers. The AI writer replaces all of it; the TODO markers keep the
  // publish gate closed if nobody does.
  const html = [
    happened ? `<p>${esc(happened)}</p>` : todo("Write the lede: who did what, where and when, in your own words."),
    detail ? `<p>${esc(detail)}</p>` : "",
    facts.length ? `<ul>${facts.map((x) => `<li>${esc(x.claim)}</li>`).join("")}</ul>` : "",
    known(f?.who_is_affected) ? `<p>${esc(f!.who_is_affected)}</p>` : "",
    known(f?.traveler_impact)
      ? `<p><em>Editor note (unverified reading): ${esc(f!.traveler_impact)}</em></p>`
      : "",
    todo("Turn these notes into a 200-300 word news story (or use Write article with AI)."),
  ]
    .filter(Boolean)
    .join("\n");

  let sources: { title: string; url: string; publisher: string; isOfficial?: boolean }[] = [];
  if (research && research.sources.length) {
    sources = research.sources.filter((s) => s.url).map((s) => ({ title: s.title, url: s.url, publisher: s.publisher, isOfficial: s.official }));
  } else {
    const items = (await sql`
      SELECT i.title, i.url,
             CASE WHEN s.type = 'google_news_rss' AND i.author <> '' THEN i.author ELSE s.name END AS publisher
      FROM news_items i JOIN news_sources s ON s.id = i.source_id
      WHERE i.cluster_id = ${clusterId} ORDER BY s.reliability_score DESC LIMIT 12
    `) as any[];
    sources = items.filter((it) => it.url).map((it) => ({ title: it.title, url: it.url, publisher: it.publisher }));
  }


  const article = await createNewsDraft({
    title,
    contentHtml: html,
    excerpt: happened.slice(0, 200),
    clusterId,
    // Set from the headline or the story's topic (see newsCategory.ts); the
    // editor can change it in the article editor.
    categoryId: await categoryIdFor(title, String(clusters[0].category || "")).catch(() => null),
    sources,
  });
  // Destination: the one site destination the story is about, if there is
  // exactly one (the editor can change it). Skipped until places are tagged.
  const dest = (await sql`
    SELECT ci.id FROM cities ci, story_clusters c
    WHERE c.id = ${clusterId} AND lower(ci.name) = ANY(c.places)
  `.catch(() => [])) as any[];
  let cityId: string | null = dest.length === 1 ? dest[0].id : null;
  if (dest.length === 0) cityId = await newDestinationFor(clusterId).catch(() => null);
  if (cityId) {
    await sql`UPDATE articles SET city_id = ${cityId} WHERE id = ${article.id}`;
    article.cityId = cityId;
  }
  return { article, created: true };
}

// The site category for a news draft, or null when unclear.
async function categoryIdFor(title: string, topic: string): Promise<string | null> {
  const cats = (await sql`SELECT id, slug FROM categories`) as any[];
  const slug = pickNewsCategorySlug(title, topic, cats.map((c) => c.slug));
  return slug ? cats.find((c) => c.slug === slug)?.id ?? null : null;
}

// Gives an existing news draft without a category one (never overwrites an
// editor's choice).
async function fillNewsCategory(articleId: string): Promise<void> {
  const row = (await sql`
    SELECT a.title, c.category AS topic FROM articles a LEFT JOIN story_clusters c ON c.id = a.news_cluster_id
    WHERE a.id = ${articleId} AND a.type = 'news' AND a.category_id IS NULL LIMIT 1
  `)[0];
  if (!row) return;
  const id = await categoryIdFor(String(row.title || ""), String(row.topic || ""));
  if (id) await sql`UPDATE articles SET category_id = ${id} WHERE id = ${articleId} AND category_id IS NULL`;
}

// A story about exactly one known city that isn't a destination on the site
// yet (for example Florence) creates that destination, with its country.
async function newDestinationFor(clusterId: string): Promise<string | null> {
  const row = (await sql`SELECT places FROM story_clusters WHERE id = ${clusterId} LIMIT 1`)[0];
  const places: string[] = Array.isArray(row?.places) ? row.places : [];
  const g = await loadGazetteer();
  const cities = places.map((k) => g.find((e) => e.key === k)).filter((e): e is NonNullable<typeof e> => !!e && !!e.country);
  if (cities.length !== 1) return null;
  const country = g.find((e) => e.key === cities[0].country);
  if (!country) return null;
  const city = await resolveOrCreateCity(cities[0].name, country.name);
  return city.id;
}
