import type { Config } from "tailwindcss";

// Tokens declarados em src/app/globals.css (spec 003, FR-001) e expostos aqui por nome.
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: { 900: token("brand-900"), 700: token("brand-700"), 100: token("brand-100") },
        primary: { 700: token("primary-700"), 600: token("primary-600"), 100: token("primary-100") },
        accent: { 900: token("accent-900"), 700: token("accent-700"), 600: token("accent-600"), 100: token("accent-100") },
        surface: token("surface"),
        canvas: token("canvas"),
        ink: { 900: token("ink-900"), 600: token("ink-600"), 400: token("ink-400") },
        danger: { 600: token("danger-600") },
        warning: { 500: token("warning-500") },
      },
      borderRadius: {
        field: "var(--radius-field)",
        card: "var(--radius-card)",
      },
      boxShadow: {
        header: "var(--shadow-header)",
        popover: "var(--shadow-popover)",
      },
      fontFamily: {
        sans: ["var(--font-body)", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        display: ["var(--font-display)", "var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      fontSize: {
        display: ["30px", { lineHeight: "36px", fontWeight: "600", letterSpacing: "-0.02em" }],
        h2: ["20px", { lineHeight: "28px", fontWeight: "600", letterSpacing: "-0.01em" }],
        h3: ["16px", { lineHeight: "24px", fontWeight: "600" }],
        body: ["14px", { lineHeight: "20px" }],
        label: ["12px", { lineHeight: "16px", fontWeight: "500" }],
      },
      maxWidth: {
        content: "1280px",
      },
      transitionDuration: {
        DEFAULT: "150ms",
      },
    },
  },
  plugins: [],
};

export default config;
