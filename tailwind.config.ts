import type { Config } from "tailwindcss";

// Landmark Wire editorial theme:
// Warm, premium newsprint paper backgrounds, rich obsidian/carbon ink for readable longform typography,
// and vibrant editorial signal accents (crimson wire alerts, warm amber scores, emerald published badges).
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: "#FAF9F5",
          50: "#FCFBF8",
          100: "#F5F3EB",
          200: "#EAE5D9",
          300: "#DDD6C5",
          card: "#FFFFFF",
          muted: "#F4F1EA",
        },
        ink: {
          50: "#F6F7F9",
          100: "#ECEEF2",
          200: "#D6D9E0",
          300: "#B0B6C3",
          400: "#7E8799",
          500: "#5A6273",
          600: "#414756",
          700: "#2B303C",
          800: "#1C1F27",
          900: "#111318",
          950: "#0A0B0E",
        },
        signal: {
          DEFAULT: "#C22938",
          dark: "#9E1D2A",
          light: "#FDF2F3",
          border: "#FAC5CA",
          amber: "#D97706",
          emerald: "#059669",
          blue: "#2563EB",
        },
      },
      fontFamily: {
        serif: [
          '"Newsreader"',
          '"Playfair Display"',
          "Georgia",
          "Cambria",
          '"Times New Roman"',
          "Times",
          "serif",
        ],
        sans: [
          '"Plus Jakarta Sans"',
          '"Inter"',
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
        mono: [
          '"JetBrains Mono"',
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      maxWidth: {
        prose: "46rem",
        content: "84rem",
      },
      boxShadow: {
        subtle: "0 1px 2px 0 rgba(16, 24, 40, 0.04)",
        card: "0 1px 3px 0 rgba(16, 24, 40, 0.06), 0 1px 2px -1px rgba(16, 24, 40, 0.06)",
        lift: "0 12px 28px -6px rgba(17, 19, 24, 0.12), 0 4px 10px -2px rgba(17, 19, 24, 0.04)",
        dropdown: "0 10px 30px -4px rgba(17, 19, 24, 0.14)",
      },
      letterSpacing: {
        tightest: "-0.035em",
        tighter: "-0.025em",
        tight: "-0.015em",
        widest: "0.15em",
      },
    },
  },
  plugins: [],
};

export default config;
