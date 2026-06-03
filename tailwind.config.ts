import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "mm-primary": "#3730a3",
        "mm-primary-700": "#312e81",
        "mm-primary-50": "#e0e7ff",
        "mm-accent": "#6d28d9",
        "mm-success": "#10B981",
        "mm-warning": "#F59E0B",
        "mm-danger": "#DC2626",
        "mm-info": "#06B6D4",
        "mm-bg-dark": "#0A0A0F",
        "mm-bg-dark-2": "#111827",
      },
      fontFamily: {
        pretendard: [
          "Pretendard",
          "Pretendard Variable",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Inter",
          "Roboto",
          "sans-serif",
        ],
      },
      backgroundImage: {
        "mm-grad": "linear-gradient(135deg, #3730a3 0%, #6d28d9 100%)",
        "mm-grad-soft": "linear-gradient(135deg, #e0e7ff 0%, #F5F3FF 100%)",
      },
      keyframes: {
        "marker-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(55,48,163,0.50), 0 0 0 3px white" },
          "50%": { boxShadow: "0 0 0 10px rgba(55,48,163,0), 0 0 0 3px white" },
        },
        "hl-pulse": {
          "0%, 100%": {
            boxShadow: "0 0 0 1px rgba(255,255,255,0.4) inset, 0 0 16px rgba(245,158,11,0.50), 0 0 0 0 rgba(245,158,11,0.55)",
          },
          "50%": {
            boxShadow: "0 0 0 1px rgba(255,255,255,0.4) inset, 0 0 24px rgba(245,158,11,0.7), 0 0 0 8px rgba(245,158,11,0)",
          },
        },
        "tts-bar": {
          "0%, 100%": { height: "4px" },
          "50%": { height: "12px" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-100% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "marker-pulse": "marker-pulse 1.8s ease-in-out infinite",
        "hl-pulse": "hl-pulse 1.6s ease-in-out infinite",
        "tts-bar": "tts-bar 0.9s ease-in-out infinite",
        shimmer: "shimmer 1.4s linear infinite",
      },
    },
  },
  plugins: [],
};
export default config;
