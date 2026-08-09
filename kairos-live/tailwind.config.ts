import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        night: "#0E0B22",
        "night-2": "#171232",
        candle: "#F5C451",
        ember: "#FF6B5E",
        violet: "#7B6CF6",
        lilac: "#B8AEDC",
        parchment: "#F4EFE6",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        halo: "0 0 40px -8px rgba(245,196,81,0.55)",
        "halo-lg": "0 0 90px -10px rgba(245,196,81,0.5)",
      },
    },
  },
  plugins: [],
};
export default config;
