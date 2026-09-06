import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = {
  width: 32,
  height: 32,
};
export const contentType = "image/png";

// Renders the exact same emblem as components/Logo.tsx as the site favicon
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
          background: "#0F172A",
          borderRadius: "7px",
          border: "1px solid #1E293B",
          overflow: "hidden",
        }}
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 44 44"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Subtle Globe Grid Lines */}
          <circle cx="22" cy="22" r="15" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
          <ellipse cx="22" cy="22" rx="7.5" ry="15" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
          <line x1="7" y1="22" x2="37" y2="22" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />

          {/* Dynamic News Wire Spire */}
          <path d="M22 6L26 32H18L22 6Z" fill="#DC2626" />
          <circle cx="22" cy="6.5" r="2.5" fill="#FCA5A5" />
          <circle cx="22" cy="6.5" r="1" fill="#FFFFFF" />

          {/* Gold Landmark Accent Dot */}
          <circle cx="34" cy="11" r="2.5" fill="#F59E0B" />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  );
}
