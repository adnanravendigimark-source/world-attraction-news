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
  const textColor = isLight ? "#FFFFFF" : "#0B1527";
  const subtextColor = isLight ? "#94A3B8" : "#64748B";
  const emblemFill = isLight ? "#FFFFFF" : "#0B1527";
  const accentRed = "#DC2626";
  const accentCyan = isLight ? "#38BDF8" : "#0284C7";

  const EmblemIcon = ({ sizeClass = "h-8 w-8" }: { sizeClass?: string }) => (
    <svg
      viewBox="0 0 48 48"
      className={`${sizeClass} shrink-0`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="World Attraction News Logo"
    >
      {/* Outer Globe Ring / Arc */}
      <circle cx="24" cy="24" r="21" stroke={emblemFill} strokeWidth="3" opacity="0.9" />
      <path
        d="M6 24C6 24 13 18 24 18C35 18 42 24 42 24"
        stroke={emblemFill}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M7 31C7 31 14 26 24 26C34 26 41 31 41 31"
        stroke={emblemFill}
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.6"
      />
      {/* Central Spire Landmark */}
      <path
        d="M24 6L28.5 38H19.5L24 6Z"
        fill={accentRed}
      />
      {/* Crossbar Pinnacle */}
      <path
        d="M17 28H31V31H17V28Z"
        fill={emblemFill}
      />
      {/* Signal Beacon Point */}
      <circle cx="24" cy="6" r="3" fill={accentRed} />
      <circle cx="36" cy="14" r="2" fill={accentCyan} />
    </svg>
  );

  if (variant === "mark") {
    return <EmblemIcon sizeClass={className || "h-8 w-8"} />;
  }

  if (variant === "compact") {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        <EmblemIcon sizeClass="h-7 w-7" />
        <div className="flex items-baseline gap-1 leading-none font-sans">
          <span className="text-sm font-black tracking-tight" style={{ color: textColor }}>
            World Attraction
          </span>
          <span className="text-sm font-black tracking-tight" style={{ color: accentRed }}>
            News
          </span>
        </div>
      </div>
    );
  }

  if (variant === "stacked") {
    return (
      <div className={`inline-flex flex-col items-center text-center font-sans ${className}`}>
        <EmblemIcon sizeClass="h-9 w-9 mb-1" />
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
            className="text-[9px] font-bold tracking-wider uppercase mt-1"
            style={{ color: subtextColor }}
          >
            Latest News From Attractions Around The World
          </span>
        )}
      </div>
    );
  }

  // Horizontal variant (default)
  return (
    <div className={`inline-flex items-center gap-2.5 font-sans ${className}`}>
      <EmblemIcon sizeClass="h-8 w-8" />
      <div className="flex flex-col justify-center">
        <div className="flex items-baseline gap-1.5 leading-none">
          <span
            className="text-[17px] sm:text-[18px] font-black tracking-tight uppercase"
            style={{ color: textColor }}
          >
            World Attraction
          </span>
          <span
            className="text-[17px] sm:text-[18px] font-black tracking-tight uppercase"
            style={{ color: accentRed }}
          >
            News
          </span>
        </div>
        {showTagline && (
          <span
            className="text-[9px] font-bold tracking-wider uppercase mt-0.5 hidden sm:inline"
            style={{ color: subtextColor }}
          >
            Latest News From Attractions Around The World
          </span>
        )}
      </div>
    </div>
  );
}
