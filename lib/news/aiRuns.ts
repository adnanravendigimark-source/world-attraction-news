// Phase 12 — one row per AI model call (ai_runs): what ran, for which story
// or article, with which model and prompt version, how long it took, the
// tokens it used and an estimated cost. Logging never breaks a pipeline step.

export interface AiRunInput {
  kind: string; // research | write | tighten | check | revise | image
  model: string;
  promptVersion?: string;
  articleId?: string | null;
  clusterId?: string | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
  images?: number; // image calls
  quality?: string; // image quality (low | medium | high), which sets the price
  durationMs: number;
  outcome: "ok" | "error";
  error?: string;
}

// Estimated USD prices, per million tokens (input, output) or per image.
// OpenAI changes prices; override with AI_PRICES (JSON of the same shape) in
// .env. Unknown models are logged without a cost.
// Image prices are per image at 1536x1024 (dall-e-3: 1792x1024), by quality.
type ImagePrice = number | Partial<Record<"low" | "medium" | "high", number>>;
const DEFAULT_PRICES: Record<string, { in?: number; out?: number; image?: ImagePrice }> = {
  "gpt-4o": { in: 2.5, out: 10 },
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
  "gpt-4.1": { in: 2, out: 8 },
  "gpt-4.1-mini": { in: 0.4, out: 1.6 },
  "gpt-4.1-nano": { in: 0.1, out: 0.4 },
  "gpt-image-2": { image: { low: 0.005, medium: 0.041, high: 0.165 } },
  "gpt-image-1.5": { image: { low: 0.005, medium: 0.041, high: 0.165 } }, // estimate: priced like gpt-image-2
  "gpt-image-1": { image: { low: 0.016, medium: 0.063, high: 0.25 } },
  "dall-e-3": { image: { low: 0.08, medium: 0.08, high: 0.12 } }, // standard / hd
};

function prices(): Record<string, { in?: number; out?: number; image?: ImagePrice }> {
  try {
    const extra = process.env.AI_PRICES ? JSON.parse(process.env.AI_PRICES) : {};
    return { ...DEFAULT_PRICES, ...extra };
  } catch {
    return DEFAULT_PRICES;
  }
}

// Longest matching price key, so "gpt-4o-mini-2024-07-18" uses gpt-4o-mini.
export function estimateCost(model: string, tokensIn: number | null | undefined, tokensOut: number | null | undefined, images = 0, quality = "medium"): number | null {
  const table = prices();
  const key = Object.keys(table)
    .filter((k) => model === k || model.startsWith(`${k}-`))
    .sort((a, b) => b.length - a.length)[0];
  if (!key) return null;
  const p = table[key];
  let usd = 0;
  if (images && p.image) {
    const per = typeof p.image === "number" ? p.image : p.image[quality as "low" | "medium" | "high"] ?? p.image.medium ?? 0;
    usd += images * per;
  }
  if (p.in && tokensIn) usd += (tokensIn / 1_000_000) * p.in;
  if (p.out && tokensOut) usd += (tokensOut / 1_000_000) * p.out;
  return Math.round(usd * 1_000_000) / 1_000_000;
}

export async function recordAiRun(r: AiRunInput): Promise<void> {
  try {
    const { sql } = await import("../db");
    await sql`
      INSERT INTO ai_runs (kind, model, prompt_version, article_id, cluster_id, tokens_in, tokens_out, cost_usd, duration_ms, outcome, error)
      VALUES (${r.kind}, ${r.model}, ${r.promptVersion || ""}, ${r.articleId || null}, ${r.clusterId || null},
              ${r.tokensIn ?? null}, ${r.tokensOut ?? null}, ${estimateCost(r.model, r.tokensIn, r.tokensOut, r.images || 0, r.quality || "medium")},
              ${r.durationMs}, ${r.outcome}, ${(r.error || "").slice(0, 500)})`;
  } catch (err) {
    console.error("[ai_runs] couldn't record a model call (run scripts/setup-db.mjs):", (err as Error)?.message);
  }
}

export interface AiRun {
  id: number;
  kind: string;
  model: string;
  promptVersion: string;
  articleId: string | null;
  clusterId: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
  costUsd: number | null;
  durationMs: number;
  outcome: string;
  error: string;
  createdAt: string;
}

// Model calls for an article and the story it came from.
export async function listAiRuns(articleId: string, clusterId: string | null): Promise<AiRun[]> {
  try {
    const { sql } = await import("../db");
    const rows = (await sql`
      SELECT * FROM ai_runs
      WHERE article_id = ${articleId} OR (${clusterId}::uuid IS NOT NULL AND cluster_id = ${clusterId}::uuid)
      ORDER BY created_at ASC LIMIT 200`) as any[];
    return rows.map((r) => ({
      id: Number(r.id),
      kind: r.kind,
      model: r.model,
      promptVersion: r.prompt_version || "",
      articleId: r.article_id,
      clusterId: r.cluster_id,
      tokensIn: r.tokens_in === null ? null : Number(r.tokens_in),
      tokensOut: r.tokens_out === null ? null : Number(r.tokens_out),
      costUsd: r.cost_usd === null ? null : Number(r.cost_usd),
      durationMs: Number(r.duration_ms || 0),
      outcome: r.outcome,
      error: r.error || "",
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    }));
  } catch {
    return [];
  }
}
