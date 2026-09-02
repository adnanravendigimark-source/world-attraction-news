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
  const towerFill = isLight ? "#FFFFFF" : "#0B1527";
  const accentRed = "#DC2626";
  const accentCyan = isLight ? "#38BDF8" : "#0284C7";

  const EmblemIcon = ({ sizeClass = "h-9 w-9" }: { sizeClass?: string }) => (
    <svg
      viewBox="0 0 48 48"
      className={`${sizeClass} shrink-0`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Attraction News Logo"
    >
      {/* Outer Triangle Spire Structure */}
      <path
        d="M24 3L39 42H32.5L28 30H20L15.5 42H9L24 3Z"
        fill={towerFill}
      />
      {/* Inner Central Spire Line */}
      <path
        d="M24 8L27 24H21L24 8Z"
        fill={accentRed}
      />
      {/* Crossbar Arch */}
      <path
        d="M18.5 30H29.5V33H18.5V30Z"
        fill={accentCyan}
      />
      {/* Orbit / Starry Accent */}
      <circle cx="36" cy="12" r="2.5" fill={accentRed} />
      <circle cx="12" cy="18" r="1.5" fill={accentCyan} />
      <circle cx="38" cy="24" r="1.5" fill={accentCyan} />
    </svg>
  );

  if (variant === "mark") {
    return <EmblemIcon sizeClass={className || "h-9 w-9"} />;
  }

  if (variant === "compact") {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        <EmblemIcon sizeClass="h-7 w-7" />
        <div className="flex items-baseline gap-1 leading-none">
          <span className="font-sans text-base font-extrabold tracking-tight" style={{ color: textColor }}>
            Attraction
          </span>
          <span className="font-sans text-base font-black tracking-tight" style={{ color: accentRed }}>
            News
          </span>
        </div>
      </div>
    );
  }

  if (variant === "stacked") {
    return (
      <div className={`inline-flex flex-col items-center text-center ${className}`}>
        <EmblemIcon sizeClass="h-10 w-10 mb-1.5" />
        <div className="leading-tight">
          <div className="font-sans text-lg font-extrabold tracking-tight" style={{ color: textColor }}>
            Attraction
          </div>
          <div className="font-sans text-lg font-black tracking-tight -mt-1" style={{ color: accentRed }}>
            News
          </div>
        </div>
        {showTagline && (
          <span
            className="text-[9px] font-medium tracking-tight mt-1"
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
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <EmblemIcon sizeClass="h-10 w-10" />
      <div className="flex flex-col">
        <div className="flex flex-col leading-none">
          <span
            className="font-sans text-[20px] font-extrabold tracking-tight"
            style={{ color: textColor }}
          >
            Attraction
          </span>
          <span
            className="font-sans text-[18px] font-black tracking-tight mt-0.5"
            style={{ color: accentRed }}
          >
            News
          </span>
        </div>
        {showTagline && (
          <span
            className="text-[9px] font-medium leading-tight mt-1 hidden sm:block whitespace-nowrap"
            style={{ color: subtextColor }}
          >
            Latest News From Attractions Around The World
          </span>
        )}
      </div>
    </div>
  );
}
