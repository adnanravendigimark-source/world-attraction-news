// Topic clusters for Travel Blogs. When an editor types a topic ("arno boat
// tour") and clicks Suggest with AI, they get one main guide plus supporting
// articles, each for a different visitor need and its own search keyword,
// instead of ten rewordings of the same title.
//
// One model call plans the cluster. Everything after that is code:
//   - normalizeCluster: one main guide, one article per need, no two articles
//     chasing the same keyword (pure, tested)
//   - supportFor: do free sources (Wikivoyage, Wikipedia) say enough about
//     each idea to research it? (pure, tested; the text is fetched once)
//   - overlap with existing guides, topics and news, and suggested internal
//     links to pages that already exist
// No keyword-volume or difficulty figures are produced: the site has no
// keyword data source, and invented numbers would mislead.

import { randomUUID } from "node:crypto";
import { sql } from "../db";
import { chatJson } from "../news/aiClient";
import { researchModel } from "../news/research";
import { articlePath } from "../destinations";
import { isOffTopicTitle, wikiExtract, wikiSearch } from "./research";
import {
  NEEDS,
  SUGGEST_PROMPT_VERSION,
  findSimilar,
  existingTitlesFor,
  getTopic,
  resolveDestination,
  resolveSuggestedPlace,
  siblingDuplicate,
  topicTokens,
  type BlogTopic,
  type Need,
  type TopicPlan,
} from "./topics";

// ------------------------------------------------------------------ prompt

const CLUSTER_PROMPT = `You plan a topic cluster for a travel website: one main guide plus supporting articles about ONE topic an editor typed (for example "Arno boat tour").
Goal: cover the whole visitor journey (discovering, comparing, planning, deciding to book) with articles that each have a distinct purpose and target a distinct search query. Not a list of rewordings.

Return:
- destination: the one city (or the country, if the topic is country-wide) the topic is in, as "City, Country" or "Country". If DESTINATION is given, use it. If you cannot identify the place with confidence, return "" and no topics.
- topics: one item for EACH of these needs, in this order:
  1. overview (role "pillar"): the comprehensive visitor guide to the topic.
  2. decision: is it worth it, what to expect, who it suits.
  3. booking: how to choose and book.
  4. practical: where it starts or departs, how to get there, how long it takes.
  5. itinerary: fitting it into a day or a trip.
  6. seasonality: best time, time of day, year-round availability.
  7. accessibility: families, children, limited mobility.
  8. comparison: versus other ways to see or do the same thing.
  9. experience: what you see or do.
  10. preparation: what to know before going.
  All except overview have role "supporting". If a need truly does not apply to this topic, still include it with "skip": true and a one-line "skip_reason" instead of inventing a weak article.
  - Every supporting article is clearly about the TOPIC, not a general guide to the destination.
  - primary_keyword: the 2-6 word query this article targets. No two articles share a primary keyword or a near-identical one.
  - secondary_keywords: 2-4 related queries or questions.
  - intent: informational, decision, planning, comparison or booking research.
  - audience: who it is for, in a few words.
  - angle: one sentence on what it covers.
  - priority: high (the pillar and at most two articles closest to a booking decision), medium or low.
  - reason: one sentence on why this article is useful and distinct. Never state search volumes, rankings or traffic: you have no keyword data.
  - words: suggested length (pillar 1500-2200, supporting 800-1300).
- Titles: natural, specific and search-friendly, under 75 characters, no years, no prices or facts you are unsure of, no clickbait.
- Skip any article whose purpose is already covered by a title in EXISTING.

Return JSON: {"destination":"...","topics":[{"role","need","title","primary_keyword","secondary_keywords","intent","audience","angle","priority","reason","words","skip","skip_reason"}]}`;

const INTENTS = ["informational", "decision", "planning", "comparison", "booking research"] as const;
const NEED_TYPE: Record<Need, string> = {
  overview: "travel_guide",
  decision: "attractions",
  booking: "tickets",
  practical: "travel_guide",
  itinerary: "itinerary",
  seasonality: "best_time",
  accessibility: "travel_guide",
  comparison: "attractions",
  experience: "attractions",
  preparation: "travel_guide",
  prices: "tickets",
  history: "history",
};

export interface ClusterIdea {
  title: string;
  angle: string;
  topicType: string;
  words: number;
  plan: TopicPlan;
}

// ------------------------------------------------------------ pure helpers

// The same typed topic, however it was spaced or capitalised.
export const clusterKey = (topic: string) => topic.replace(/\s+/g, " ").trim().toLowerCase();

const clip = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");
const keywordKey = (k: string) => [...topicTokens(k)].sort().join(" ");

// Turns the model's answer into a clean cluster: exactly one main guide,
// one article per visitor need, no repeated keyword or near-identical title.
export function normalizeCluster(raw: any, topic: string): ClusterIdea[] {
  const items: any[] = Array.isArray(raw?.topics) ? raw.topics : [];
  const out: ClusterIdea[] = [];
  const usedNeeds = new Set<string>();
  const usedKeywords = new Set<string>();
  // The main guide first, whatever order the model used.
  const ordered = [...items].sort((a, b) => (a?.role === "pillar" ? -1 : 0) - (b?.role === "pillar" ? -1 : 0));
  for (const it of ordered) {
    if (it?.skip === true && it?.role !== "pillar") continue; // the model judged this need not useful here
    const title = clip(it?.title, 200);
    if (title.length < 5) continue;
    const isPillar = out.length === 0; // the first kept idea is the main guide
    const need: Need = isPillar ? "overview" : NEEDS.includes(it?.need) ? it.need : "experience";
    if (!isPillar && (need === "overview" || usedNeeds.has(need))) continue; // one article per need
    const primaryKeyword = clip(it?.primary_keyword, 80).toLowerCase() || title.toLowerCase();
    const key = keywordKey(primaryKeyword);
    if (key && usedKeywords.has(key)) continue; // two articles must not chase one query
    if (siblingDuplicate(title, out.map((o) => o.title), topic)) continue;
    const priority = ["high", "medium", "low"].includes(it?.priority) ? it.priority : "medium";
    const words = Math.min(Math.max(Math.round(Number(it?.words) || (isPillar ? 1800 : 1100)), 600), 2500);
    out.push({
      title,
      angle: clip(it?.angle, 300),
      topicType: NEED_TYPE[need],
      words,
      plan: {
        topic: clusterKey(topic),
        role: isPillar ? "pillar" : "supporting",
        need,
        primaryKeyword,
        secondaryKeywords: (Array.isArray(it?.secondary_keywords) ? it.secondary_keywords : []).map((k: unknown) => clip(k, 80)).filter(Boolean).slice(0, 4),
        intent: INTENTS.includes(it?.intent) ? it.intent : isPillar ? "informational" : "planning",
        audience: clip(it?.audience, 80),
        priority: isPillar ? "high" : priority,
        reason: clip(it?.reason, 240).replace(/\b\d[\d,.]*\s*(searches|monthly searches|visits|clicks)\b/gi, "").trim(),
        support: "unchecked",
        supportNote: "",
        links: [],
      },
    });
    usedNeeds.add(need);
    if (key) usedKeywords.add(key);
    if (out.length >= 10) break;
  }
  return out;
}

// Words that say an idea's need is covered by a passage.
const NEED_TERMS: Record<Need, RegExp> = {
  overview: /./,
  decision: /./,
  experience: /\b(view|see|pass|bridge|palace|church|landmark|sight|panoram|scenery)/i,
  history: /\b(century|history|historic|built|founded|medieval|ancient|renaissance|flood)/i,
  booking: /\b(book|ticket|tour|operator|reserv|guide|cruise|rental|hire)/i,
  prices: /(€|\$|£|\beuro|\bprice|\bcost|\bfee|\bfare|\bfree\b)/i,
  practical: /\b(depart|pier|dock|landing|embark|station|bus|tram|walk|minutes|hour|from the|near the)/i,
  itinerary: /\b(day|morning|afternoon|evening|hour|minutes|route|walk)/i,
  seasonality: /\b(summer|winter|spring|autumn|season|month|weather|rain|flood|hot|cold|january|july|august)/i,
  accessibility: /\b(wheelchair|accessib|step|stairs|children|famil|elderly|mobility|disab)/i,
  comparison: /\b(walk|bus|tour|alternative|instead|bike|cycle|view from|lookout|piazzale)/i,
  preparation: /\b(bring|wear|book|advance|crowd|queue|tip|rule|allowed|closed|weather)/i,
};
// Words in a topic that describe the activity rather than the subject.
const GENERIC = new Set(["tour", "trip", "guide", "visit", "ticket", "cruise", "experience", "day", "best", "top", "zdo", "zwhen", "zfood", "zticket", "zitinerary"]);

// Do the free sources say enough about this idea to research it? Looks for
// passages that mention the topic's subject (e.g. "Arno") and the idea's need.
export function supportFor(text: string, topic: string, need: Need): { support: "found" | "thin"; note: string } {
  // topicTokens drops a final "s" ("beaches" -> "beache"); trim it to a
  // stem that matches both forms in the text ("beach", "galler").
  const subject = [...topicTokens(topic)]
    .filter((w) => !GENERIC.has(w))
    .map((w) => w.replace(/(ch|sh|ss|x|z)e$/, "$1").replace(/ie$/, ""));
  if (subject.length === 0) return { support: "thin", note: "Couldn't tell what the topic is about." };
  const paras = String(text || "")
    .split(/\n+/)
    .map((p) => p.toLowerCase())
    // A passage is about the topic only if it names its subject in full
    // ("Arno" and "boat"), not just the river or just boats in general.
    .filter((p) => subject.filter((w) => p.includes(w)).length >= Math.min(subject.length, 2));
  const hits = paras.filter((p) => NEED_TERMS[need].test(p)).length;
  // Research needs about 12 facts; one passage can't supply that.
  const enough = need === "overview" || need === "decision" ? paras.length >= 3 : hits >= 2;
  return enough
    ? { support: "found", note: `Free sources have ${need === "overview" || need === "decision" ? paras.length : hits} relevant passage(s).` }
    : { support: "thin", note: "Free sources say little about this; research may find too few facts unless you add a source link." };
}

// --------------------------------------------------------------- I/O parts

// Wikivoyage and Wikipedia text for the destination and the topic, fetched
// once per suggestion (free, no AI). Failures just mean less text.
async function freeSourceText(destination: string, topic: string): Promise<string> {
  const dest = destination.split(",")[0].trim();
  const subject = [...topicTokens(topic)].filter((w) => !GENERIC.has(w)).join(" ");
  const titles: [string, string][] = [["en.wikivoyage.org", dest], ["en.wikipedia.org", dest]];
  for (const t of await wikiSearch("en.wikipedia.org", `${subject} ${dest}`.trim(), 3).catch(() => [] as string[])) {
    if (!isOffTopicTitle(t) && t.toLowerCase() !== dest.toLowerCase()) titles.push(["en.wikipedia.org", t]);
    if (titles.length >= 4) break;
  }
  const pages = await Promise.all(titles.map(([host, title]) => wikiExtract(host, title).catch(() => null)));
  return pages.map((p) => p?.text || "").join("\n");
}

// Pages that already exist and an article in this cluster should link to.
async function suggestedLinks(dest: { cityId: string | null; countryId: string | null }): Promise<{ name: string; url: string }[]> {
  const links: { name: string; url: string }[] = [];
  if (dest.cityId) {
    const c = (await sql`SELECT name, slug, country_slug FROM cities WHERE id = ${dest.cityId} LIMIT 1`.catch(() => []))[0] as any;
    if (c?.country_slug) links.push({ name: `${c.name} destination page`, url: `/${c.country_slug}/${c.slug}` });
  } else if (dest.countryId) {
    const c = (await sql`SELECT name, slug FROM countries WHERE id = ${dest.countryId} LIMIT 1`.catch(() => []))[0] as any;
    if (c) links.push({ name: `${c.name} destination page`, url: `/${c.slug}` });
  }
  const guides = (await sql`
    SELECT a.title, a.slug, ci.slug AS city_slug, COALESCE(ci.country_slug, co.slug) AS country_slug
    FROM articles a
    LEFT JOIN cities ci ON ci.id = a.city_id
    LEFT JOIN countries co ON co.id = a.country_id
    WHERE a.type <> 'news' AND a.status = 'published'
      AND ((${dest.cityId}::uuid IS NOT NULL AND a.city_id = ${dest.cityId}) OR (${dest.countryId}::uuid IS NOT NULL AND a.country_id = ${dest.countryId}))
    ORDER BY a.published_at DESC NULLS LAST LIMIT 3`.catch(() => [])) as any[];
  for (const g of guides) links.push({ name: String(g.title), url: articlePath(g.country_slug || "", g.city_slug || "", g.slug) });
  return links;
}


// Plans a cluster around a typed topic and saves it as "suggested" ideas.
export async function suggestCluster(topic: string, destination: string, createdBy = ""): Promise<BlogTopic[]> {
  const t = topic.replace(/\s+/g, " ").trim().slice(0, 120);
  // A typed destination is checked before paying for the model call.
  let dest = destination.trim() ? await resolveDestination(destination) : null;
  // Content for this destination only (articles incl. news, accepted topics);
  // when the place isn't known yet, the model sees no list and the check
  // below runs once the place is resolved.
  const promptExisting = dest ? await existingTitlesFor(dest, { news: true, acceptedOnly: true }) : [];
  const { json } = await chatJson({
    kind: "suggest",
    log: { promptVersion: SUGGEST_PROMPT_VERSION },
    model: researchModel(),
    temperature: 0.6,
    timeoutMs: 60_000,
    system: CLUSTER_PROMPT,
    user: `TOPIC: ${t}\nDESTINATION: ${dest ? dest.label : "(not given: work it out from the topic)"}\n\nEXISTING:\n${promptExisting.slice(0, 100).map((x) => `- ${x}`).join("\n") || "(none)"}`,
  });
  if (!dest) dest = await resolveSuggestedPlace(String(json?.destination || ""), t);
  const existing = await existingTitlesFor(dest, { news: true, acceptedOnly: true });
  const ideas = normalizeCluster(json, t);
  if (ideas.length === 0) throw new Error("No topic ideas came back. Try again.");

  const [text, links] = await Promise.all([freeSourceText(dest.label, t).catch(() => ""), suggestedLinks(dest).catch(() => [])]);
  // Asking again for the same topic and place replaces the earlier ideas
  // nobody accepted, instead of stacking a second copy of the cluster.
  // Done only now, after the new plan succeeded, so a failed call loses nothing.
  await sql`
    UPDATE blog_topics SET status = 'dismissed', updated_at = now()
    WHERE status = 'suggested' AND cluster_id IS NOT NULL AND plan->>'topic' = ${clusterKey(t)}
      AND city_id IS NOT DISTINCT FROM ${dest.cityId}::uuid AND country_id IS NOT DISTINCT FROM ${dest.countryId}::uuid`;
  const clusterId = randomUUID();
  const ids: string[] = [];
  for (const idea of ideas) {
    const overlap = findSimilar(idea.title, existing) || findSimilar(idea.plan.primaryKeyword, existing);
    const s = text ? supportFor(text, t, idea.plan.need) : { support: "thin" as const, note: "Free sources could not be read right now." };
    const plan: TopicPlan = { ...idea.plan, support: s.support, supportNote: s.note, links };
    // Thin sources or an article the site already has: still listed, but low.
    if (s.support === "thin" && plan.role !== "pillar") plan.priority = "low";
    if (overlap) plan.priority = "low";
    const row = (await sql`
      INSERT INTO blog_topics (title, angle, topic_type, target_words, city_id, country_id, source, status, similar_title, created_by, cluster_id, plan)
      VALUES (${idea.title}, ${idea.angle}, ${idea.topicType}, ${idea.words}, ${dest.cityId}, ${dest.countryId},
              'ai_suggested', 'suggested', ${overlap}, ${createdBy}, ${clusterId}, ${JSON.stringify(plan)}::jsonb)
      RETURNING id`)[0];
    ids.push(row.id);
  }
  const saved = await Promise.all(ids.map((id) => getTopic(id)));
  return saved.filter((x): x is BlogTopic => !!x);
}

// ---------------------------------------------------------- after writing

// The other articles in a topic's cluster, for the writer (so each article
// keeps to its own purpose) and for the "More on this topic" box.
export async function clusterSiblings(topicId: string): Promise<{ title: string; need: string; role: string; keyword: string }[]> {
  const rows = (await sql`
    SELECT t.title, t.plan FROM blog_topics t
    JOIN blog_topics me ON me.cluster_id = t.cluster_id
    WHERE me.id = ${topicId} AND t.id <> me.id AND t.status IN ('queued', 'generating', 'drafted')
    ORDER BY (t.plan->>'role') = 'pillar' DESC, t.created_at`.catch(() => [])) as any[];
  return rows.map((r) => ({ title: String(r.title), need: String(r.plan?.need || ""), role: String(r.plan?.role || ""), keyword: String(r.plan?.primaryKeyword || "") }));
}

// Published articles in the same cluster as this article, main guide first.
export async function publishedClusterArticles(articleId: string): Promise<{ title: string; url: string; pillar: boolean }[]> {
  const rows = (await sql`
    SELECT a.title, a.slug, ci.slug AS city_slug, COALESCE(ci.country_slug, co.slug) AS country_slug, (t.plan->>'role') = 'pillar' AS pillar
    FROM blog_topics me
    JOIN blog_topics t ON t.cluster_id = me.cluster_id AND t.id <> me.id
    JOIN articles a ON a.id = t.article_id AND a.status = 'published'
    LEFT JOIN cities ci ON ci.id = a.city_id
    LEFT JOIN countries co ON co.id = a.country_id
    WHERE me.article_id = ${articleId} AND me.cluster_id IS NOT NULL
    ORDER BY pillar DESC, a.published_at DESC NULLS LAST
    LIMIT 8`.catch(() => [])) as any[];
  return rows.map((r) => ({ title: String(r.title), url: articlePath(r.country_slug || "", r.city_slug || "", r.slug), pillar: !!r.pillar }));
}
