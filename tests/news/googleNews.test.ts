import { describe, expect, it, vi } from "vitest";
import { buildDecodeRequest, decodeOffline, googleNewsArticleId, parseDecodeResponse, readSignature, resolveGoogleNewsUrl } from "@/lib/news/googleNews";

const NEW_ID =
  "CBMirAFBVV95cUxNV19KOVBJWEpGNXVmYUpOVE1MRG9xOE9meFAxelJQOF9lMXFWTUk3TzY5blE1cHJWNC1pTkRjR3Rqd05CZVBYTnE2SWY5VUViaTBiSWVkOTNDd3Q2Mms0ODBNSERZZi1uUEZ3dEIyT3dkMy05OEtCUHBITDFMNDZpN0FLSVZtOUpQU0pQbFhKODRaM0NlMFdoQmVMYUJtWVhYVW9vMlNLRy1qOGRF";
// Captured from Google's decode endpoint for the Belgrade tourist tax story.
const REAL_RESPONSE = `)]}'

[["wrb.fr","Fbv4je","[\\"garturlres\\",\\"https://www.ekapija.com/en/news/5694405/belgrade-increases-visitor-fee-tourist-tax-set-at-240-dinars-per-day\\",1]",null,null,null,"generic"],["di",19],["af.httprm",18,"3471489407624652258",0]]`;

describe("Google News links", () => {
  it("extracts the article id from RSS and web links", () => {
    expect(googleNewsArticleId(`https://news.google.com/rss/articles/${NEW_ID}?oc=5`)).toBe(NEW_ID);
    expect(googleNewsArticleId(`https://news.google.com/articles/${NEW_ID}`)).toBe(NEW_ID);
    expect(googleNewsArticleId("https://www.reuters.com/x")).toBeNull();
  });

  it("decodes old-style ids offline and refuses new-style ones", () => {
    const url = "https://www.example.com/travel/new-route";
    const proto = Buffer.concat([Buffer.from([0x08, 0x13, 0x22, url.length]), Buffer.from(url), Buffer.from([0xd2, 0x01, 0x00])]);
    const oldId = proto.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(decodeOffline(oldId)).toBe(url);
    expect(decodeOffline(NEW_ID)).toBeNull();
  });

  it("reads the signature and the decode response", () => {
    expect(readSignature('<c-wiz data-n-a-sg="AbIaSL-Z" data-n-a-ts="1791527176">')).toEqual({ ts: 1791527176, sg: "AbIaSL-Z" });
    expect(parseDecodeResponse(REAL_RESPONSE)).toBe("https://www.ekapija.com/en/news/5694405/belgrade-increases-visitor-fee-tourist-tax-set-at-240-dinars-per-day");
    expect(parseDecodeResponse(")]}'\n\n[]")).toBeNull();
    expect(decodeURIComponent(buildDecodeRequest("abc", { ts: 1, sg: "s" }))).toContain('garturlreq');
  });

  it("resolves online with two requests", async () => {
    const fake = vi
      .fn()
      .mockResolvedValueOnce(new Response('<div data-n-a-sg="SIG" data-n-a-ts="123"></div>', { status: 200 }))
      .mockResolvedValueOnce(new Response(REAL_RESPONSE, { status: 200 }));
    const url = await resolveGoogleNewsUrl(`https://news.google.com/rss/articles/${NEW_ID}?oc=5`, fake as any);
    expect(url).toMatch(/^https:\/\/www\.ekapija\.com\//);
    expect(fake).toHaveBeenCalledTimes(2);
    expect(String(fake.mock.calls[1][1].body)).toContain("SIG");
  });

  it("gives up quietly when Google answers with an error", async () => {
    const fake = vi.fn().mockResolvedValue(new Response("nope", { status: 429 }));
    expect(await resolveGoogleNewsUrl(`https://news.google.com/rss/articles/${NEW_ID}`, fake as any)).toBeNull();
  });
});
