import { describe, expect, it } from "vitest";
import { healthChecks, failStreaks, overCap, researchUsable, type HealthInput } from "@/lib/news/ops";
import { isPrivateIp, resolvesPublic } from "@/lib/news/extract";
import { buildChatBody } from "@/lib/news/aiClient";

const now = Date.UTC(2026, 9, 12, 12);
const healthy: HealthInput = {
  now,
  lastOkFetchAt: new Date(now - 20 * 60_000).toISOString(),
  failingSources: [],
  stuckJobs: 0,
  jobFailStreaks: {},
  failedJobs24h: 0,
  ai24h: { calls: 10, errors: 0, rateLimited: 0 },
  readyMissingImage: 0,
  researchIncomplete24h: 0,
  publishFailures24h: 0,
  costUsd: 0.4,
  capUsd: 2,
};
const level = (h: Partial<HealthInput>, key: string) => healthChecks({ ...healthy, ...h }).find((c) => c.key === key)!;

describe("cost controls (phase 13)", () => {
  it("stops at the cap; 0 means no cap", () => {
    expect(overCap(1.99, 2)).toBe(false);
    expect(overCap(2, 2)).toBe(true);
    expect(overCap(50, 0)).toBe(false);
  });
  it("skips stories research can't support (incomplete research)", () => {
    expect(researchUsable({ facts: 2, sourcesRead: 2 }, 4).ok).toBe(false);
    expect(researchUsable({ facts: 8, sourcesRead: 0 }, 4).reason).toMatch(/headlines only/);
    expect(researchUsable({ facts: 8, sourcesRead: 1 }, 4).ok).toBe(true);
  });
});

describe("health: every failure type has a visible state (phase 14)", () => {
  it("all green when nothing is wrong", () => {
    expect(healthChecks(healthy).every((c) => c.level === "ok")).toBe(true);
  });
  it("RSS / API source failures", () => {
    expect(level({ failingSources: [{ name: "Skift", error: "HTTP 403", failures: 4 }] }, "sources").level).toBe("warn");
  });
  it("no successful fetch for 2+ hours", () => {
    expect(level({ lastOkFetchAt: new Date(now - 3 * 3_600_000).toISOString() }, "fetch").level).toBe("error");
    expect(level({ lastOkFetchAt: null }, "fetch").level).toBe("error");
  });
  it("failed and stuck jobs; three failures in a row of one kind is an error", () => {
    expect(level({ failedJobs24h: 1 }, "jobs").level).toBe("warn");
    expect(level({ stuckJobs: 2 }, "jobs").level).toBe("warn");
    expect(level({ jobFailStreaks: { write: 3 } }, "jobs").level).toBe("error");
  });
  it("AI errors, invalid responses and rate limits", () => {
    expect(level({ ai24h: { calls: 10, errors: 1, rateLimited: 0 } }, "ai").level).toBe("warn");
    expect(level({ ai24h: { calls: 10, errors: 5, rateLimited: 3 } }, "ai").level).toBe("error");
    expect(level({ ai24h: { calls: 10, errors: 5, rateLimited: 3 } }, "ai").note).toMatch(/3 rate-limited/);
  });
  it("incomplete research, missing images, publish failures, cost cap", () => {
    expect(level({ researchIncomplete24h: 2 }, "research").level).toBe("warn");
    expect(level({ readyMissingImage: 1 }, "images").level).toBe("warn");
    expect(level({ publishFailures24h: 1 }, "publish").level).toBe("error");
    expect(level({ costUsd: 2.5 }, "cost").note).toMatch(/paused/);
  });
  it("counts consecutive final failures per job kind, newest first", () => {
    const rows = [
      { kind: "write", status: "failed" }, { kind: "image", status: "done" }, { kind: "write", status: "failed" },
      { kind: "write", status: "failed" }, { kind: "image", status: "failed" }, { kind: "write", status: "done" }, { kind: "write", status: "failed" },
    ];
    expect(failStreaks(rows)).toEqual({ write: 3 });
  });
});

describe("safe fetching (phase 14)", () => {
  it("knows internal addresses", () => {
    for (const ip of ["10.0.0.1", "127.0.0.1", "169.254.169.254", "172.20.1.1", "192.168.1.1", "100.64.0.1", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"]) expect(isPrivateIp(ip), ip).toBe(true);
    for (const ip of ["8.8.8.8", "151.101.1.1", "2606:4700::1111"]) expect(isPrivateIp(ip), ip).toBe(false);
  });
  it("refuses a public-looking name that resolves inside (DNS rebinding)", async () => {
    expect(await resolvesPublic("https://news.example.com/a", async () => [{ address: "10.0.0.5" }])).toBe(false);
    expect(await resolvesPublic("https://news.example.com/a", async () => [{ address: "93.184.216.34" }, { address: "127.0.0.1" }])).toBe(false);
    expect(await resolvesPublic("https://news.example.com/a", async () => [{ address: "93.184.216.34" }])).toBe(true);
    expect(await resolvesPublic("https://news.example.com/a", async () => { throw new Error("ENOTFOUND"); })).toBe(false);
  });
});

describe("duplicate requests", () => {
  it("the AI request body is deterministic (a retried job sends the same request)", () => {
    const a = buildChatBody({ system: "s", user: "u", model: "gpt-4o", temperature: 0.2 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(buildChatBody({ system: "s", user: "u", model: "gpt-4o", temperature: 0.2 })));
  });
});
