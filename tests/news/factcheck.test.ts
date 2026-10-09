import { describe, expect, it, vi } from "vitest";
import { factsBlock, ruleIssues, unsupportedNames, unsupportedNumbers, speculativeWording, verdictFor } from "@/lib/news/factcheck";
import { contentHash } from "@/lib/news/contentHash";
import { normalizeFacts, isKnown } from "@/lib/news/research";
import { buildChatBody, chatJson, isReasoningModel } from "@/lib/news/aiClient";

const facts = `SOURCES
[1] Reuters
[2] BBC
FACTS
F1 What happened: Lufthansa cancelled flights at Frankfurt on Oct 8 due to a pilot strike.
F2 When: Wednesday, 8 October 2026
F3 Fact (confirmed, sources 1,2): About 1,200 flights were cancelled due to the strike.
F4 Fact (single_source, sources 1): Flights to Europe were most affected.`;

const correct =
  "<p>Lufthansa cancelled about 1200 flights at Frankfurt Airport on Wednesday, October 8, due to a pilot strike, Reuters reported.</p>" +
  "<h2>European routes</h2><p>European flights were the most affected.</p>";

describe("rule checks", () => {
  it("passes a correct article (the case that used to fail)", () => {
    const issues = ruleIssues(correct, facts);
    expect(issues).toEqual([]);
    expect(verdictFor(issues)).toBe("passed");
  });

  it("fails on a number that is not in the facts", () => {
    const issues = ruleIssues("<p>Lufthansa cancelled 2,400 flights at Frankfurt.</p>", facts);
    expect(unsupportedNumbers("<p>Lufthansa cancelled 2,400 flights.</p>", facts)).toEqual(["2,400"]);
    expect(verdictFor(issues)).toBe("failed");
  });

  it("only hints at unknown names and wording", () => {
    const html = "<p>Lufthansa cancelled flights at Frankfurt. Passengers on Condor could be affected.</p>";
    const issues = ruleIssues(html, facts);
    expect(issues.map((i) => i.text)).toEqual(expect.arrayContaining(["could", "Condor"]));
    expect(issues.every((i) => i.severity === "low")).toBe(true);
    expect(verdictFor(issues)).toBe("needs_review");
  });

  it("allows causal phrases the facts themselves use", () => {
    expect(speculativeWording("<p>Flights were cancelled due to the strike.</p>", facts)).toEqual([]);
    expect(speculativeWording("<p>Flights were cancelled due to weather.</p>", "FACTS\nF1 Flights were cancelled.")).toEqual(["due to"]);
  });

  it("no longer ignores Emirates", () => {
    expect(unsupportedNames("<p>Lufthansa and Emirates cancelled flights.</p>", facts)).toEqual(["Emirates"]);
  });

  it("treats the start of each heading and paragraph as a sentence start", () => {
    expect(unsupportedNames("<h2>Overview</h2><p>Strikes hit Lufthansa.</p>", facts)).toEqual([]);
  });
});

describe("facts block", () => {
  it("numbers facts and leaves out unknown traveler impact", () => {
    const f = normalizeFacts(
      { what_happened: "X", important_facts: [{ claim: "Y", sources: [1], confidence: "single_source" }], traveler_impact: "Not clear from sources" },
      1
    );
    const block = factsBlock(f, { sources: [{ n: 1, publisher: "Reuters", official: false, usedText: true } as any] });
    expect(block).toContain("F1 What happened: X");
    expect(block).toContain("F6 Fact (single_source, sources 1): Y");
    expect(block).not.toContain("Traveler impact");
  });
});

describe("research normalisation fixes", () => {
  it("keeps a fact confirmed by one official source", () => {
    const f = normalizeFacts({ important_facts: [{ claim: "A", sources: [2], confidence: "confirmed" }] }, 2, [
      { n: 1, official: false },
      { n: 2, official: true },
    ]);
    expect(f.important_facts[0].confidence).toBe("confirmed");
  });

  it("stores every 'unknown' variant the same way", () => {
    for (const v of ["Not clear from sources", "Unknown", "not stated", "N/A"]) {
      expect(isKnown(normalizeFacts({ traveler_impact: v }, 1).traveler_impact)).toBe(false);
    }
    expect(isKnown(normalizeFacts({ traveler_impact: "Check your booking." }, 1).traveler_impact)).toBe(true);
  });
});

describe("content hash", () => {
  it("ignores links, figures and spacing but not words", () => {
    const a = "<p>Paris is busy.</p>";
    expect(contentHash('<p><a href="/p">Paris</a>  is busy.</p><figure class="news-figure"><img src="x"><figcaption>c</figcaption></figure>')).toBe(contentHash(a));
    expect(contentHash("<p>Paris is quiet.</p>")).not.toBe(contentHash(a));
  });
});

describe("AI client", () => {
  it("leaves temperature out for reasoning models", () => {
    expect(isReasoningModel("o3-mini")).toBe(true);
    expect(isReasoningModel("gpt-5")).toBe(true);
    expect(isReasoningModel("gpt-4o")).toBe(false);
    expect(buildChatBody({ system: "s", user: "u", model: "o4-mini", temperature: 0.3 }).temperature).toBeUndefined();
    expect(buildChatBody({ system: "s", user: "u", model: "gpt-4o", temperature: 0.3 }).temperature).toBe(0.3);
  });

  it("retries once on a rate limit, then returns parsed JSON with usage", async () => {
    process.env.OPENAI_API_KEY = "test";
    const ok = { choices: [{ message: { content: '{"a":1}' } }], usage: { prompt_tokens: 10, completion_tokens: 5 } };
    const fake = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "slow down" } }), { status: 429, headers: { "retry-after": "0.01" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify(ok), { status: 200 }));
    const r = await chatJson({ system: "s", user: "u", model: "gpt-4o" }, fake as any);
    expect(fake).toHaveBeenCalledTimes(2);
    expect(r.json).toEqual({ a: 1 });
    expect(r.tokensIn).toBe(10);
  });

  it("reports a bad request without retrying", async () => {
    process.env.OPENAI_API_KEY = "test";
    const fake = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "bad model" } }), { status: 400 }));
    await expect(chatJson({ system: "s", user: "u", model: "x", kind: "write" }, fake as any)).rejects.toThrow("OpenAI error (write): bad model");
    expect(fake).toHaveBeenCalledTimes(1);
  });
});

describe("promotional wording", () => {
  it("hints at selling language the facts don't use", async () => {
    const { promotionalWording, ruleIssues: rules, verdictFor: verdict } = await import("@/lib/news/factcheck");
    const html = "<p>Travelers may want to check their bookings for the overland program, which offers a unique opportunity for cultural exploration and relaxation.</p>";
    expect(promotionalWording(html)).toEqual(["unique opportunity", "relaxation"]);
    const issues = rules(html, "FACTS\nF1 An overland program in Egypt was added.");
    expect(verdict(issues)).toBe("needs_review");
  });
});
