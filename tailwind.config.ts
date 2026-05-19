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
      },
    },
  },
  plugins: [],
} satisfies Config;
