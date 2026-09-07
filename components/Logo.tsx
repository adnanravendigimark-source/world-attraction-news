import React from "react";
import Image from "next/image";

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
  const textColor = isLight ? "#FFFFFF" : "#0A192F";
  const subtextColor = isLight ? "#94A3B8" : "#475569";
  const accentRed = "#DC2626"; // Vibrant news wire red

  // The Globe & Red Plane Emblem Icon - Clean isolated crop with 0 background or frame artifacts
  const EmblemIcon = ({ sizeClass = "h-10 xs:h-11 sm:h-12 md:h-[3.25rem] lg:h-14 w-auto" }: { sizeClass?: string }) => (
    <div className={`relative shrink-0 flex items-center justify-center ${sizeClass}`}>
      <Image
        src="/images/logo-emblem.png"
        alt="World Attraction News Emblem"
        width={435}
        height={356}
        className="h-full w-auto object-contain transition-transform duration-200 group-hover:scale-105"
        priority
      />
    </div>
  );

  if (variant === "mark") {
    return <EmblemIcon sizeClass={className || "h-9 sm:h-10 w-auto"} />;
  }

  if (variant === "compact") {
    return (
      <div className={`inline-flex items-center gap-2.5 sm:gap-3 font-sans group ${className}`}>
        <EmblemIcon sizeClass="h-9 xs:h-10 sm:h-11 w-auto" />
        <div className="flex flex-col justify-center leading-none min-w-0">
          <span
            className="text-[11px] sm:text-[12.5px] font-black tracking-wider uppercase"
            style={{ color: textColor }}
          >
            WORLD
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span
              className="text-[15px] sm:text-[18px] font-black tracking-tight uppercase"
              style={{ color: textColor }}
            >
              ATTRACTION
            </span>
            <span
              className="text-[15px] sm:text-[18px] font-black tracking-tight uppercase"
              style={{ color: accentRed }}
            >
              NEWS
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (variant === "stacked") {
    return (
      <div className={`inline-flex flex-col items-center text-center font-sans group ${className}`}>
        <EmblemIcon sizeClass="h-14 xs:h-16 sm:h-20 w-auto mb-2" />
        <div className="leading-none text-center">
          <div
            className="text-[12px] sm:text-[14px] md:text-[16px] font-black tracking-widest uppercase"
            style={{ color: textColor }}
          >
            WORLD
          </div>
          <div className="flex items-center justify-center gap-1.5 sm:gap-2 mt-1">
            <span
              className="text-[18px] sm:text-[22px] md:text-[26px] font-black tracking-tight uppercase leading-none"
              style={{ color: textColor }}
            >
              ATTRACTION
            </span>
            <span
              className="text-[18px] sm:text-[22px] md:text-[26px] font-black tracking-tight uppercase leading-none"
              style={{ color: accentRed }}
            >
              NEWS
            </span>
          </div>
        </div>
        {showTagline && (
          <span
            className="text-[8px] sm:text-[9.5px] md:text-[11px] font-bold tracking-[0.14em] uppercase mt-2 max-w-[300px] leading-tight"
            style={{ color: subtextColor }}
          >
            GLOBAL LANDMARK, THEME PARK & DESTINATION WIRE
          </span>
        )}
      </div>
    );
  }

  // Horizontal variant (default) - Prominent, bold, and responsive on all screens
  return (
    <div className={`inline-flex items-center gap-2.5 sm:gap-3 md:gap-3.5 font-sans group select-none min-w-0 ${className}`}>
      <EmblemIcon sizeClass="h-10 xs:h-11 sm:h-12 md:h-[3.25rem] lg:h-14 w-auto shrink-0" />
      <div className="flex flex-col justify-center leading-none min-w-0">
        <div
          className="text-[11px] xs:text-[12px] sm:text-[13.5px] md:text-[15px] font-black tracking-[0.16em] sm:tracking-[0.18em] uppercase leading-none"
          style={{ color: textColor }}
        >
          WORLD
        </div>
        <div className="flex items-baseline gap-1 sm:gap-1.5 mt-0.5 sm:mt-1 leading-none">
          <span
            className="text-[16px] xs:text-[18px] sm:text-[21px] md:text-[24px] font-black tracking-tight uppercase leading-none"
            style={{ color: textColor }}
          >
            ATTRACTION
          </span>
          <span
            className="text-[16px] xs:text-[18px] sm:text-[21px] md:text-[24px] font-black tracking-tight uppercase leading-none"
            style={{ color: accentRed }}
          >
            NEWS
          </span>
        </div>
        {showTagline && (
          <span
            className="text-[7px] xs:text-[8px] sm:text-[9px] md:text-[9.5px] font-bold tracking-[0.10em] sm:tracking-[0.15em] uppercase mt-1 sm:mt-1.5 hidden sm:inline-block leading-none truncate max-w-[280px] md:max-w-none"
            style={{ color: subtextColor }}
          >
            GLOBAL LANDMARK, THEME PARK & DESTINATION WIRE
          </span>
        )}
      </div>
    </div>
  );
}
