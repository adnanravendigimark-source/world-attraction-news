import type { Config } from "tailwindcss";

// Editorial wire-service news theme — warm paper background, near-black ink
// for text, a single crimson "signal" accent for live/breaking/latest
// markers. Deliberately different from the cool slate/navy/ocean palette
// used across the previous travel-booking sites: serif display headlines,
// warm neutrals, one accent color instead of a blue-family system.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: "#fbf9f5",
          card: "#ffffff",
          muted: "#f3efe7",
        },
        ink: {
          50: "#f6f5f3",
          100: "#e8e5df",
          200: "#d3cdc2",
          300: "#b3a99a",
          400: "#8c8072",
          500: "#6b6156",
          600: "#524a42",
          700: "#3d3730",
          800: "#26221d",
          900: "#151310",
          950: "#0a0908",
        },
        signal: {
          DEFAULT: "#b3122a",
          dark: "#8c0e21",
          light: "#fdecef",
          border: "#f3c3cb",
        },
      },
      fontFamily: {
        serif: [
          "Georgia",
          "Cambria",
          '"Times New Roman"',
          "Times",
          "serif",
        ],
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
      },
      maxWidth: {
        prose: "42rem",
        content: "80rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(21, 19, 16, 0.06), 0 1px 1px rgba(21, 19, 16, 0.04)",
        lift: "0 8px 24px -8px rgba(21, 19, 16, 0.18)",
      },
    },
  },
  plugins: [],
};

export default config;
