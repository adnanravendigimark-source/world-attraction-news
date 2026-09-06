import React from "react";

interface LogoProps {
  variant?: "mark" | "horizontal" | "stacked" | "compact";
  theme?: "dark" | "light" | "auto";
  className?: string;
  showTagline?: boolean;
}

export default function Logo({
  variant = "horizontal",
  theme = "auto",
  className = "",
  showTagline = true,
}: LogoProps) {
  const isLight = theme === "light";
  const textColor = isLight ? "#FFFFFF" : "#0F172A";
  const subtextColor = isLight ? "#94A3B8" : "#64748B";
  const badgeBorder = isLight ? "rgba(255,255,255,0.25)" : "#1E293B";
  const accentRed = "#DC2626"; // Vibrant news wire red
  const accentGold = "#F59E0B"; // Landmark gold

  // The distinctive WAT Emblem: Rounded Hexagonal Wire Emblem with Landmark Spire Beacon & Globe Grid
  const EmblemIcon = ({ sizeClass = "h-9 w-9" }: { sizeClass?: string }) => (
    <svg
      viewBox="0 0 44 44"
      className={`${sizeClass} shrink-0 transition-transform duration-200 group-hover:scale-105`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="World Attraction News Logo"
    >
      <defs>
        <linearGradient id="watGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0F172A" />
          <stop offset="100%" stopColor="#1E293B" />
        </linearGradient>
        <linearGradient id="watAccent" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#DC2626" />
          <stop offset="100%" stopColor="#991B1B" />
        </linearGradient>
      </defs>

      {/* Outer Rounded Hex/Shield Base */}
      <rect
        x="2"
        y="2"
        width="40"
        height="40"
        rx="10"
        fill="url(#watGrad)"
        stroke={badgeBorder}
        strokeWidth="1.5"
      />

      {/* Subtle Globe Grid Lines */}
      <circle cx="22" cy="22" r="15" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      <ellipse cx="22" cy="22" rx="7.5" ry="15" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      <line x1="7" y1="22" x2="37" y2="22" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />

      {/* Dynamic News Wire Spire */}
      <path
        d="M22 6L26 32H18L22 6Z"
        fill="url(#watAccent)"
      />
      <circle cx="22" cy="6.5" r="2.5" fill="#FCA5A5" />
      <circle cx="22" cy="6.5" r="1" fill="#FFFFFF" />

      {/* Gold Landmark Accent Dot */}
      <circle cx="34" cy="11" r="2" fill={accentGold} />
    </svg>
  );

  if (variant === "mark") {
    return <EmblemIcon sizeClass={className || "h-9 w-9"} />;
  }

  if (variant === "compact") {
    return (
      <div className={`inline-flex items-center gap-2 font-sans ${className}`}>
        <EmblemIcon sizeClass="h-7 w-7" />
        <div className="flex items-baseline gap-1.5 leading-none">
          <span className="text-sm font-black tracking-tight uppercase" style={{ color: textColor }}>
            World Attraction
          </span>
          <span className="text-sm font-black tracking-tight uppercase" style={{ color: accentRed }}>
            News
          </span>
        </div>
      </div>
    );
  }

  if (variant === "stacked") {
    return (
      <div className={`inline-flex flex-col items-center text-center font-sans ${className}`}>
        <EmblemIcon sizeClass="h-10 w-10 mb-1.5" />
        <div className="leading-tight">
          <div className="text-base font-black tracking-tight uppercase" style={{ color: textColor }}>
            World Attraction
          </div>
          <div className="text-base font-black tracking-tight uppercase -mt-0.5" style={{ color: accentRed }}>
            News
          </div>
        </div>
        {showTagline && (
          <span
            className="text-[9px] font-bold tracking-wider uppercase mt-1.5 max-w-[220px]"
            style={{ color: subtextColor }}
          >
            Global Landmark, Theme Park & Destination Wire
          </span>
        )}
      </div>
    );
  }

  // Horizontal variant (default)
  return (
    <div className={`inline-flex items-center gap-2.5 font-sans group ${className}`}>
      <EmblemIcon sizeClass="h-9 w-9" />
      <div className="flex flex-col justify-center">
        <div className="flex items-baseline gap-1.5 leading-none">
          <span
            className="text-[17px] sm:text-[19px] font-black tracking-tight uppercase"
            style={{ color: textColor }}
          >
            World Attraction
          </span>
          <span
            className="text-[17px] sm:text-[19px] font-black tracking-tight uppercase"
            style={{ color: accentRed }}
          >
            News
          </span>
        </div>
        {showTagline && (
          <span
            className="text-[9.5px] font-bold tracking-wider uppercase mt-1 hidden sm:inline"
            style={{ color: subtextColor }}
          >
            Global Landmark, Theme Park & Destination Wire
          </span>
        )}
      </div>
    </div>
  );
}
