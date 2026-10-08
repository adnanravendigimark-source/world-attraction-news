// Phase 6 — research a story cluster. Gathers the sources behind a story,
// asks the model to EXTRACT structured facts (not write an article), and
// stores the facts plus the list of sources. Source page text is never saved.
//
// The model may only use the text it is given. Each fact must cite the source
// numbers that support it, and confidence is assigned by rule: "confirmed"
// needs two independent sources or an official source.
import { sql } from "../db";
import { fetchPageText, isGoogleNewsRedirect, isPublicUrl } from "./extract";
import { chatJson } from "./aiClient";

export interface ResearchSource {
  n: number;
  title: string;
  url: string;
  publisher: string;
  reliability: number;
  official: boolean;
  usedText: boolean; // true = full page text read, false = headline/teaser only
  note: string;
}

export interface ResearchFact {
  claim: string;
  sources: number[];
  confidence: "confirmed" | "single_source" | "conflicting";
}

export interface ResearchFacts {
  what_happened: string;
  when: string;
  where: string;
  who_is_affected: string;
  what_changed: string;
  traveler_impact: string; // an inference for editors, flagged as such in the UI
  important_facts: ResearchFact[];
  confirmed_numbers: { value: string; context: string; sources: number[] }[];
  uncertain_claims: string[];
  conflicts: string[];
  missing_info: string[];
}

export interface ResearchRecord {
  id: string;
  clusterId: string;
  status: string;
  model: string;
  facts: ResearchFacts | null;
  sources: ResearchSource[];
  error: string;
  createdAt: string;
  finishedAt: string | null;
}

const MAX_SOURCES = 6;
const MAX_TOTAL_CHARS = 30_000;

export function researchModel(): string {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
}

export function researchDailyCap(): number {
  const n = Number(process.env.NEWS_RESEARCH_DAILY_CAP);
  return Number.isFinite(n) && n > 0 ? n : 30;
}

const iso = (v: unknown): string | null => (v ? (v instanceof Date ? v.toISOString() : String(v)) : null);

function mapRecord(r: any): ResearchRecord {
  return {
    id: r.id,
    clusterId: r.cluster_id,
    status: r.status,
    model: r.model || "",
    facts: r.facts || null,
    sources: r.sources || [],
    error: r.error || "",
    createdAt: iso(r.created_at) || "",
    finishedAt: iso(r.finished_at),
  };
}

export async function getLatestResearch(clusterId: string): Promise<ResearchRecord | null> {
  const rows = await sql`SELECT * FROM story_research WHERE cluster_id = ${clusterId} ORDER BY created_at DESC LIMIT 1`;
  return rows[0] ? mapRecord(rows[0]) : null;
}

const SYSTEM_PROMPT = `You are a careful travel-news research assistant for a news site. Your job is to EXTRACT facts about ONE news event from the numbered sources provided. You are not writing an article.

Rules:
- Use ONLY information stated in the sources. Never use outside knowledge, never guess, never fill gaps.
- If a detail is not stated, write "Not stated in sources" (or leave the list empty). Do not invent dates, numbers, names, places or rules.
- Every item in important_facts and confirmed_numbers must cite the source numbers that state it.
- confidence: "confirmed" only if two or more independent sources state it or an official source (marked official) states it; "single_source" if only one source states it; "conflicting" if sources disagree.
- Sources marked "headline only" contain just a headline and teaser; treat claims from them as weaker.
- Put anything speculative, attributed to anonymous people, or unverified in uncertain_claims.
- If sources disagree about a fact, describe the disagreement in conflicts.
- traveler_impact is your reading of what this means for travellers, based strictly on the facts above; keep it short and say "Not clear from sources" if it is not.
- Be thorough: extract EVERY distinct, specific fact a traveller or editor could use that the text states (dates, routes, flight numbers and times, aircraft, places, prices, numbers, eligibility, effective dates, related changes, relevant background the text gives). One fact per item. When a full text source is long, aim for 10 to 25 important_facts. Do not pad with facts the text does not state.
- Be concise and neutral. Do not copy sentences from sources; paraphrase facts.

Return ONLY a JSON object with exactly these keys:
what_happened (string), when (string), where (string), who_is_affected (string), what_changed (string), traveler_impact (string),
important_facts (array of {claim: string, sources: number[], confidence: "confirmed"|"single_source"|"conflicting"}),
confirmed_numbers (array of {value: string, context: string, sources: number[]}),
uncertain_claims (string[]), conflicts (string[]), missing_info (string[]).`;

const OFFICIAL_HINTS = [/\.gov(\.|\/|$)/i, /\.gob\./i, /\.gouv\./i, /\.go\.[a-z]{2}(\/|$)/i, /europa\.eu/i, /\.int(\/|$)/i, /airport/i, /airlines?\./i, /tourism/i];

function looksOfficial(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return OFFICIAL_HINTS.some((re) => re.test(host));
  } catch {
    return false;
  }
}

export async function checkDailyCap(): Promise<{ used: number; cap: number; ok: boolean }> {
  const cap = researchDailyCap();
  const rows = await sql`SELECT COUNT(*)::int AS n FROM story_research WHERE status <> 'failed' AND created_at > now() - interval '24 hours'`;
  const used = Number(rows[0]?.n ?? 0);
  return { used, cap, ok: used < cap };
}

export async function runResearch(clusterId: string, requestedBy: string): Promise<ResearchRecord> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY is not set.");

  const clusters = await sql`SELECT id, canonical_title FROM story_clusters WHERE id = ${clusterId} LIMIT 1`;
  if (!clusters[0]) throw new Error("Story not found.");

  const model = researchModel();
  const created = await sql`
    INSERT INTO story_research (cluster_id, status, model, requested_by) VALUES (${clusterId}, 'running', ${model}, ${requestedBy}) RETURNING id
  `;
  const researchId = created[0].id as string;

  const fail = async (message: string, sources: ResearchSource[] = []) => {
    await sql`
      UPDATE story_research SET status = 'failed', error = ${message.slice(0, 500)}, sources = ${JSON.stringify(sources)}::jsonb, finished_at = now()
      WHERE id = ${researchId}
    `;
    const rec = await getLatestResearch(clusterId);
    return rec as ResearchRecord;
  };

  try {
    const items = (await sql`
      SELECT i.title, i.description, i.url, s.reliability_score,
             CASE WHEN s.type = 'google_news_rss' AND i.author <> '' THEN i.author ELSE s.name END AS publisher
      FROM news_items i JOIN news_sources s ON s.id = i.source_id
      WHERE i.cluster_id = ${clusterId}
      ORDER BY s.reliability_score DESC, COALESCE(i.published_at, i.created_at) ASC
    `) as any[];
    if (items.length === 0) return await fail("This story has no items.");

    // One source per publisher, best reliability first.
    const seen = new Set<string>();
    const picked: any[] = [];
    for (const it of items) {
      const k = String(it.publisher).toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      picked.push(it);
      if (picked.length >= MAX_SOURCES) break;
    }

    const pages = await Promise.all(
      picked.map(async (it) => {
        if (!it.url || isGoogleNewsRedirect(it.url) || !isPublicUrl(it.url)) return null;
        return fetchPageText(it.url);
      })
    );

    const perSource = Math.floor(MAX_TOTAL_CHARS / picked.length);
    const sources: ResearchSource[] = [];
    const blocks: string[] = [];
    picked.forEach((it, idx) => {
      const n = idx + 1;
      const page = pages[idx];
      const usedText = !!page?.ok;
      const official = looksOfficial(page?.finalUrl || it.url || "");
      const body = usedText ? page!.text.slice(0, perSource) : `${it.description || ""}`.slice(0, 600);
      sources.push({
        n,
        title: String(it.title).slice(0, 200),
        url: page?.finalUrl || it.url || "",
        publisher: String(it.publisher),
        reliability: Number(it.reliability_score ?? 50),
        official,
        usedText,
        note: usedText ? "full text read" : page ? `headline only (${page.error})` : "headline only (aggregator link)",
      });
      blocks.push(
        `SOURCE ${n} — ${it.publisher}${official ? " [official]" : ""} — ${usedText ? "full text" : "headline only"}\nHeadline: ${it.title}\n${body ? `Text: ${body}` : ""}`
      );
    });

    let ai;
    try {
      ai = await chatJson({
        kind: "research",
        model,
        temperature: 0.1,
        timeoutMs: 90_000,
        system: SYSTEM_PROMPT,
        user: `Event headline: ${clusters[0].canonical_title}\n\n${blocks.join("\n\n---\n\n")}`,
      });
    } catch (err: any) {
      return await fail(String(err?.message || err), sources);
    }
    const facts = normalizeFacts(ai.json, sources.length, sources);

    await sql`
      UPDATE story_research SET status = 'done', facts = ${JSON.stringify(facts)}::jsonb, sources = ${JSON.stringify(sources)}::jsonb,
        tokens_in = ${ai.tokensIn}, tokens_out = ${ai.tokensOut}, finished_at = now()
      WHERE id = ${researchId}
    `;
    return (await getLatestResearch(clusterId)) as ResearchRecord;
  } catch (err: any) {
    const msg = err?.name === "TimeoutError" || err?.name === "AbortError" ? "The model took too long to respond." : String(err?.message || err);
    return await fail(msg);
  }
}

export const NOT_STATED = "Not stated in sources";
// The model is told to answer "Not clear from sources" or "Not stated in
// sources" when a field is unknown; store every such variant the same way so
// later steps can recognise it and never pass it on as a fact.
const UNKNOWN = /^(not (stated|clear|mentioned|specified|known|available)|unknown|unclear|n\/a|none)\b/i;
const str = (v: unknown) => (typeof v === "string" && v.trim() && !UNKNOWN.test(v.trim()) ? v.trim().slice(0, 600) : NOT_STATED);
export const isKnown = (v: string | undefined | null): v is string => !!v && v !== NOT_STATED && !UNKNOWN.test(v.trim());
const strList = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).map((x) => String(x).trim().slice(0, 400)).slice(0, 12) : []);
const nums = (v: unknown, max: number): number[] =>
  Array.isArray(v) ? [...new Set(v.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= max))] : [];

// Never trust model output shape: coerce, cap, and drop facts with no valid citation.
export function normalizeFacts(raw: any, sourceCount: number, sources: Pick<ResearchSource, "n" | "official">[] = []): ResearchFacts {
  const official = new Set(sources.filter((s) => s.official).map((s) => s.n));
  const conf = (c: unknown): ResearchFact["confidence"] => (c === "confirmed" || c === "conflicting" ? c : "single_source");
  const facts: ResearchFact[] = (Array.isArray(raw?.important_facts) ? raw.important_facts : [])
    .map((f: any) => ({ claim: typeof f?.claim === "string" ? f.claim.trim().slice(0, 500) : "", sources: nums(f?.sources, sourceCount), confidence: conf(f?.confidence) }))
    .filter((f: ResearchFact) => f.claim && f.sources.length > 0)
    .slice(0, 25);
  // "Confirmed" needs two independent sources, or one official source.
  for (const f of facts) {
    if (f.confidence === "confirmed" && f.sources.length < 2 && !f.sources.some((n) => official.has(n))) f.confidence = "single_source";
  }
  const numbers = (Array.isArray(raw?.confirmed_numbers) ? raw.confirmed_numbers : [])
    .map((n: any) => ({ value: typeof n?.value === "string" ? n.value.slice(0, 120) : String(n?.value ?? ""), context: typeof n?.context === "string" ? n.context.slice(0, 300) : "", sources: nums(n?.sources, sourceCount) }))
    .filter((n: any) => n.value && n.sources.length > 0)
    .slice(0, 10);
  return {
    what_happened: str(raw?.what_happened),
    when: str(raw?.when),
    where: str(raw?.where),
    who_is_affected: str(raw?.who_is_affected),
    what_changed: str(raw?.what_changed),
    traveler_impact: str(raw?.traveler_impact),
    important_facts: facts,
    confirmed_numbers: numbers,
    uncertain_claims: strList(raw?.uncertain_claims),
    conflicts: strList(raw?.conflicts),
    missing_info: strList(raw?.missing_info),
  };
}
