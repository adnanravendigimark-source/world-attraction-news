// Validation for the sources an editor lists under a news article. Pure.

export interface SourceInput {
  title: string;
  url: string;
  publisher: string;
  isOfficial: boolean;
}

export const MAX_SOURCES = 12;

export function validateSourceList(raw: unknown): { sources: SourceInput[] } | { error: string } {
  if (!Array.isArray(raw)) return { error: "sources must be a list." };
  if (raw.length > MAX_SOURCES) return { error: `At most ${MAX_SOURCES} sources.` };
  const out: SourceInput[] = [];
  const seen = new Set<string>();
  for (const [i, s] of raw.entries()) {
    const url = String((s as any)?.url || "").trim();
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return { error: `Source ${i + 1}: enter a full web address (https://…).` };
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return { error: `Source ${i + 1}: only http(s) links are allowed.` };
    const publisher = String((s as any)?.publisher || "").trim() || parsed.hostname.replace(/^www\./, "");
    const key = parsed.toString().toLowerCase();
    if (seen.has(key)) return { error: `Source ${i + 1} is listed twice.` };
    seen.add(key);
    out.push({
      url: parsed.toString().slice(0, 1000),
      publisher: publisher.slice(0, 120),
      title: String((s as any)?.title || "").trim().slice(0, 300),
      isOfficial: !!(s as any)?.isOfficial,
    });
  }
  return { sources: out };
}
