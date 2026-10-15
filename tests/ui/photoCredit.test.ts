import { describe, it, expect } from "vitest";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PhotoCredit from "@/components/PhotoCredit";

// The test runner compiles the component's JSX to React.createElement.
(globalThis as any).React = React;
const html = (info: any) => renderToStaticMarkup(createElement(PhotoCredit, { info }));

describe("cover photo credit", () => {
  it("credits a licensed photo with a link and the licence", () => {
    const out = html({ sourceType: "licensed", credit: "Wouter Hagens / Wikimedia Commons", license: "CC BY-SA 4.0", sourceUrl: "https://commons.wikimedia.org/x" });
    expect(out).toContain("Photo:");
    expect(out).toContain('href="https://commons.wikimedia.org/x"');
    expect(out).toContain("Wouter Hagens / Wikimedia Commons");
    expect(out).toContain("CC BY-SA 4.0");
  });
  it("labels an AI image as illustrative", () => {
    expect(html({ sourceType: "ai", credit: "", license: "", sourceUrl: "" })).toContain("generated with AI");
  });
  it("shows nothing for an upload without a stored credit", () => {
    expect(html({ sourceType: "upload", credit: "", license: "", sourceUrl: "" })).toBe("");
    expect(html(null)).toBe("");
  });
});
