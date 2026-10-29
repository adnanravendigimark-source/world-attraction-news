import { recordAiRun } from "./aiRuns";

// One wrapper for every OpenAI chat call in the news pipeline (research,
// writing, fact checking). Keeps timeouts, retries and model-specific
// parameters in one place, so a model change in .env can't break a step.

export interface ChatJsonInput {
  system: string;
  user: string;
  model: string;
  temperature?: number;
  // How much hidden "thinking" a reasoning model does (gpt-6-luna, gpt-5.x).
  // Reasoning tokens are billed as output, so "none" is the cheap default;
  // the fact check asks for "low". Ignored by models that don't reason.
  reasoningEffort?: ReasoningEffort;
  // Used once when OpenAI says the model no longer exists (a retired model,
  // e.g. gpt-4o after 14 January 2027), so a shutdown doesn't stop the site.
  fallbackModel?: string;
  timeoutMs?: number;
  // Short label for error messages and the ai_runs log ("research", "write", "check", "revise").
  kind?: string;
  // What the call is for, recorded in ai_runs (Phase 12).
  log?: { articleId?: string | null; clusterId?: string | null; promptVersion?: string };
}

export interface ChatJsonResult {
  json: any;
  model: string;
  tokensIn: number | null;
  tokensOut: number | null;
  durationMs: number;
}

export class AiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "AiError";
    this.status = status;
  }
}

export type ReasoningEffort = "none" | "low" | "medium" | "high";

// Reasoning models (o1, o3, o4-mini, gpt-5…, gpt-6…) reject sampling
// parameters such as temperature, so they are left out for them.
export function isReasoningModel(model: string): boolean {
  return /^(o\d|gpt-5|gpt-6)/i.test(model.trim());
}

// Models that take reasoning_effort "none" (gpt-6-luna, gpt-5.1 and later).
// With "none" they also accept temperature (checked against the API,
// 2026-10-29: gpt-6-luna rejects temperature 0.2 without it).
export function takesEffortNone(model: string): boolean {
  return /^(gpt-6|gpt-5\.\d)/i.test(model.trim());
}

function defaultEffort(): ReasoningEffort {
  const v = String(process.env.OPENAI_REASONING_EFFORT || "").trim();
  return v === "low" || v === "medium" || v === "high" ? v : "none";
}

export function buildChatBody(input: ChatJsonInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: input.model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: input.system },
      { role: "user", content: input.user },
    ],
  };
  if (takesEffortNone(input.model)) {
    const effort = input.reasoningEffort ?? defaultEffort();
    body.reasoning_effort = effort;
    if (effort === "none" && typeof input.temperature === "number") body.temperature = input.temperature;
  } else if (!isReasoningModel(input.model)) {
    if (typeof input.temperature === "number") body.temperature = input.temperature;
  } else if (input.reasoningEffort && input.reasoningEffort !== "none") {
    body.reasoning_effort = input.reasoningEffort;
  }
  return body;
}

const RETRYABLE = new Set([408, 409, 429, 500, 502, 503, 504]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Calls the chat completions API in JSON mode. Retries once on rate limits
// and server errors; never retries on a timeout (the caller's job retry
// handles that, with back-off).
// True when OpenAI rejected the request because the model is gone or not
// available to this account (not for bad input or rate limits).
export function modelGone(err: { status?: number; message?: string }): boolean {
  const msg = String(err?.message || "");
  return (err?.status === 404 || err?.status === 400 || err?.status === 403) && /model[^.]*(does not exist|not found|deprecated|has been retired|no longer available|do not have access)/i.test(msg);
}

export async function chatJson(input: ChatJsonInput, fetchImpl: typeof fetch = fetch): Promise<ChatJsonResult> {
  try {
    return await chatJsonOnce(input, fetchImpl);
  } catch (err: any) {
    if (input.fallbackModel && input.fallbackModel !== input.model && modelGone(err)) {
      return chatJsonOnce({ ...input, model: input.fallbackModel, fallbackModel: undefined }, fetchImpl);
    }
    throw err;
  }
}

async function chatJsonOnce(input: ChatJsonInput, fetchImpl: typeof fetch): Promise<ChatJsonResult> {
  const started = Date.now();
  try {
    const result = await callChat(input, fetchImpl);
    await recordAiRun({
      kind: input.kind || "chat",
      model: input.model,
      promptVersion: input.log?.promptVersion,
      articleId: input.log?.articleId,
      clusterId: input.log?.clusterId,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      durationMs: result.durationMs,
      outcome: "ok",
    });
    return result;
  } catch (err: any) {
    await recordAiRun({
      kind: input.kind || "chat",
      model: input.model,
      promptVersion: input.log?.promptVersion,
      articleId: input.log?.articleId,
      clusterId: input.log?.clusterId,
      durationMs: Date.now() - started,
      outcome: "error",
      error: String(err?.message || err),
    });
    throw err;
  }
}

async function callChat(input: ChatJsonInput, fetchImpl: typeof fetch): Promise<ChatJsonResult> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new AiError("OPENAI_API_KEY is not set.");
  const started = Date.now();
  const label = input.kind ? `${input.kind}: ` : "";

  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response;
    try {
      res = await fetchImpl("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify(buildChatBody(input)),
        signal: AbortSignal.timeout(input.timeoutMs ?? 60_000),
      });
    } catch (err: any) {
      if (err?.name === "TimeoutError" || err?.name === "AbortError") throw new AiError(`${label}the model took too long to respond.`);
      throw new AiError(`${label}couldn't reach OpenAI (${String(err?.message || err).slice(0, 120)}).`);
    }
    const body: any = await res.json().catch(() => null);
    if (!res.ok) {
      if (attempt === 0 && RETRYABLE.has(res.status)) {
        const wait = Number(res.headers.get("retry-after")) * 1000;
        await sleep(Number.isFinite(wait) && wait > 0 ? Math.min(wait, 10_000) : 2_000);
        continue;
      }
      throw new AiError(`OpenAI error (${label.replace(/: $/, "") || "request"}): ${body?.error?.message || `HTTP ${res.status}`}`, res.status);
    }
    let json: any;
    try {
      json = JSON.parse(body?.choices?.[0]?.message?.content);
    } catch {
      throw new AiError(`${label}the model returned an unreadable response.`);
    }
    return {
      json,
      model: input.model,
      tokensIn: body?.usage?.prompt_tokens ?? null,
      tokensOut: body?.usage?.completion_tokens ?? null,
      durationMs: Date.now() - started,
    };
  }
  throw new AiError(`${label}OpenAI kept failing.`);
}
