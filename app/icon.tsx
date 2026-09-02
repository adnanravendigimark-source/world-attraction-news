import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = {
  width: 32,
  height: 32,
};
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 16,
          background: "#0B1527",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          borderRadius: "8px",
          fontWeight: 900,
          fontFamily: "sans-serif",
          border: "1.5px solid #DC2626",
        }}
      >
        <span style={{ color: "#FFFFFF" }}>W</span>
        <span style={{ color: "#DC2626" }}>A</span>
        <span style={{ color: "#38BDF8" }}>N</span>
      </div>
    ),
    {
      ...size,
    }
  );
}
