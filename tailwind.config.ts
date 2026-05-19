import type { Config } from "tailwindcss";

// Echoes the public site's theme (sansiwebsite) so the back office feels like
// the same brand — calmer, since this is a working tool, not editorial.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ivory: "rgb(var(--ivory) / <alpha-value>)",
        paper: "rgb(var(--paper) / <alpha-value>)",
        "ivory-deep": "rgb(var(--ivory-deep) / <alpha-value>)",
        gold: "rgb(var(--gold) / <alpha-value>)",
        "gold-deep": "rgb(var(--gold-deep) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        "ink-mute": "rgb(var(--ink-mute) / <alpha-value>)",
        ash: "rgb(var(--ash) / <alpha-value>)",
        hairline: "rgb(var(--hairline) / <alpha-value>)",
      },
      fontFamily: {
        serif: ["var(--font-display)", "Cormorant Garamond", "Garamond", "serif"],
        sans: ["var(--font-ui)", "Mulish", "system-ui", "sans-serif"],
      },
      fontSize: {
        eyebrow: ["0.6875rem", { lineHeight: "1", letterSpacing: "0.22em" }],
      },
      borderColor: { DEFAULT: "rgb(var(--hairline) / 1)" },
    },
  },
  plugins: [],
};

export default config;
