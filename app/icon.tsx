import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = {
  width: 32,
  height: 32,
};
export const contentType = "image/png";

// Renders the exact same emblem as components/Logo.tsx's EmblemIcon (the
// globe arcs + landmark spire mark used everywhere the site shows its logo)
// as a favicon, so the browser tab icon actually matches the site's real
// logo instead of an unrelated "WAN" lettermark. Next's file convention
// (app/icon.tsx) applies this to every route under the root layout — Public,
// Contributor, and Admin all share one root layout with no per-segment
// icon.tsx override, so this single file is the site-wide favicon.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0B1527",
          borderRadius: "6px",
        }}
      >
        <svg
          width="26"
          height="26"
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="24" cy="24" r="21" stroke="#FFFFFF" strokeWidth="3" opacity="0.9" />
          <path
            d="M6 24C6 24 13 18 24 18C35 18 42 24 42 24"
            stroke="#FFFFFF"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d="M7 31C7 31 14 26 24 26C34 26 41 31 41 31"
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.6"
          />
          <path d="M24 6L28.5 38H19.5L24 6Z" fill="#DC2626" />
          <path d="M17 28H31V31H17V28Z" fill="#FFFFFF" />
          <circle cx="24" cy="6" r="3" fill="#DC2626" />
          <circle cx="36" cy="14" r="2" fill="#38BDF8" />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  );
}
