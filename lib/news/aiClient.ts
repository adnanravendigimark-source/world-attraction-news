// One wrapper for every OpenAI chat call in the news pipeline (research,
// writing, fact checking). Keeps timeouts, retries and model-specific
// parameters in one place, so a model change in .env can't break a step.

export interface ChatJsonInput {
  system: string;
  user: string;
  model: string;
  temperature?: number;
  timeoutMs?: number;
  // Short label for error messages ("research", "write", "check", "revise").
  kind?: string;
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

// Reasoning models (o1, o3, o4-mini, gpt-5…) reject sampling parameters
// such as temperature, so they are left out for them.
export function isReasoningModel(model: string): boolean {
  return /^(o\d|gpt-5)/i.test(model.trim());
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
  if (!isReasoningModel(input.model) && typeof input.temperature === "number") body.temperature = input.temperature;
  return body;
}

const RETRYABLE = new Set([408, 409, 429, 500, 502, 503, 504]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Calls the chat completions API in JSON mode. Retries once on rate limits
// and server errors; never retries on a timeout (the caller's job retry
// handles that, with back-off).
export async function chatJson(input: ChatJsonInput, fetchImpl: typeof fetch = fetch): Promise<ChatJsonResult> {
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
