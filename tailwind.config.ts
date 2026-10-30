import type { Config } from "tailwindcss";

// Tokens por intenção declarados (claro e escuro) em src/app/globals.css (spec 003, FR-001) e expostos aqui por nome.
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        "page": token("page"),
        "surface": token("surface"),
        "raised": token("raised"),
        "fg": token("fg"),
        "fg-muted": token("fg-muted"),
        "fg-subtle": token("fg-subtle"),
        "line": token("line"),
        "action": token("action"),
        "action-hover": token("action-hover"),
        "action-soft": token("action-soft"),
        "link": token("link"),
        "focus": token("focus"),
        "success": token("success"),
        "success-strong": token("success-strong"),
        "success-soft": token("success-soft"),
        "success-ink": token("success-ink"),
        "warning": token("warning"),
        "danger": token("danger"),
        "inverse": token("inverse"),
        "inverse-raised": token("inverse-raised"),
        "on-color": token("on-color"),
        "on-color-muted": token("on-color-muted"),
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
