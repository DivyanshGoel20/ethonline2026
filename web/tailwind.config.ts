import type { Config } from "tailwindcss";

/**
 * Colour, type and spacing live in globals.css as the Waterline token set.
 * Tailwind is here for layout utilities only, so the theme stays empty on
 * purpose — a second source of truth for colour is how palettes drift.
 */
const config: Config = {
  content: ["./src/components/**/*.{ts,tsx}", "./src/app/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};

export default config;
