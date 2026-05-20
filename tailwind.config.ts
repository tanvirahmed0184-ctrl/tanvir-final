import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "brand-purple": "#6C3FC5",
        "brand-purple-dark": "#5429A8",
        "brand-purple-light": "#8B5CF6",
        "brand-teal": "#0EA5A0",
        "brand-teal-dark": "#0B8A86",
        "brand-teal-light": "#14B8B3",
        "brand-cyan": "#06B6D4",
        "brand-navy": "#0f0a2e",
        "brand-navy-light": "#1a1145",
        "dash-bg": "#f8faf9",
        "dash-surface": "#ffffff",
        "dash-border": "#e8eeeb",
        "dash-accent": "#2d7a5f",
        "dash-accent-light": "#e6f4ee",
        "dash-accent-muted": "#4a9e7e",
        "dash-sidebar": "#1b2e26",
        "dash-sidebar-hover": "#243d33",
        "dash-sidebar-active": "#2d7a5f",
        "dash-text": "#1a2b23",
        "dash-text-muted": "#5f7a6e",
        "dash-text-light": "#8fa89c",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      animation: {
        "fade-up": "fade-up 0.7s cubic-bezier(0.22,1,0.36,1) forwards",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
