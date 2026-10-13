import { describe, it, expect, vi, afterEach } from "vitest";
vi.mock("@/lib/db", () => ({ sql: vi.fn(async () => []) }));
import { cronDenied } from "@/lib/cronAuth";
import { canManageUser } from "@/lib/permissions";
import { fetchPublicImage } from "@/lib/news/extract";

const req = (auth?: string) => new Request("https://x.test/api/cron/news-jobs", { headers: auth ? { authorization: auth } : {} });

describe("cron routes", () => {
  it("refuse in production when CRON_SECRET is missing", () => {
    expect(cronDenied(req(), { secret: "", production: true })?.status).toBe(503);
  });
  it("run locally without a secret", () => {
    expect(cronDenied(req(), { secret: "", production: false })).toBeNull();
  });
  it("need the right bearer token when a secret is set", () => {
    expect(cronDenied(req(), { secret: "s3cret", production: true })?.status).toBe(401);
    expect(cronDenied(req("Bearer wrong!"), { secret: "s3cret", production: true })?.status).toBe(401);
    expect(cronDenied(req("Bearer s3cret"), { secret: "s3cret", production: true })).toBeNull();
  });
});

describe("managing user accounts", () => {
  const contributorsOnly = { contributors: { read: true, update: true, delete: true } } as any;
  const rolesAdmin = { roles: { read: true, update: true, delete: true } } as any;
  it("a contributors-only admin can manage contributors but not admins", () => {
    expect(canManageUser(contributorsOnly, "contributor", "update")).toBe(true);
    expect(canManageUser(contributorsOnly, "admin", "update")).toBe(false);
    expect(canManageUser(contributorsOnly, "admin", "delete")).toBe(false);
  });
  it("roles permission or full access can manage admins", () => {
    expect(canManageUser(rolesAdmin, "admin", "delete")).toBe(true);
    expect(canManageUser("full", "admin", "update")).toBe(true);
  });
  it("no permission, no access", () => {
    expect(canManageUser({} as any, "contributor", "update")).toBe(false);
  });
});

describe("image downloads", () => {
  const publicDns = async (h: string) => [{ address: h === "internal.example" ? "10.0.0.5" : "93.184.216.34" }];
  afterEach(() => vi.unstubAllGlobals());

  it("refuse a redirect to an internal address", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 302, headers: { location: "http://internal.example/secret.png" } })));
    await expect(fetchPublicImage("https://cdn.example/a.png", { lookup: publicDns })).rejects.toThrow(/isn't allowed/);
  });
  it("follow a redirect to another public address", async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: "https://cdn2.example/a.png" } }))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "image/png" } }));
    vi.stubGlobal("fetch", f);
    const r = await fetchPublicImage("https://cdn.example/a.png", { lookup: publicDns });
    expect(r.type).toBe("image/png");
    expect(r.buf.byteLength).toBe(3);
  });
  it("stop a response bigger than the cap", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array(2000), { status: 200, headers: { "content-type": "image/jpeg" } })));
    await expect(fetchPublicImage("https://cdn.example/a.jpg", { lookup: publicDns, maxBytes: 1000 })).rejects.toThrow(/too large/);
  });
  it("reject non-image content", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>", { status: 200, headers: { "content-type": "text/html" } })));
    await expect(fetchPublicImage("https://cdn.example/a", { lookup: publicDns })).rejects.toThrow(/Unsupported/);
  });
});
