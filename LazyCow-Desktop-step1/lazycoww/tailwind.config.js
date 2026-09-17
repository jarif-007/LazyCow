/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // This tells Tailwind to scan your React files
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))",
        "card-light": "hsl(var(--card-light))",
        "card-light-fg": "hsl(var(--card-light-fg))",
        "card-medium": "hsl(var(--card-medium))",
        "card-medium-fg": "hsl(var(--card-medium-fg))",
        "card-dark": "hsl(var(--card-dark))",
        "card-dark-fg": "hsl(var(--card-dark-fg))",
        border: "hsl(var(--border))",
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        accent: "hsl(var(--accent))",
        "accent-foreground": "hsl(var(--accent-foreground))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))"
      },
      borderRadius: {
        DEFAULT: "0.125rem",
        lg: "0.25rem",
        xl: "0.5rem",
        full: "0.75rem"
      },
      spacing: {
        "stack-sm": "8px",
        gutter: "24px",
        "stack-lg": "32px",
        base: "4px",
        "container-max": "1200px",
        "sidebar-width": "260px",
        "stack-xs": "4px",
        "stack-md": "16px",
        "margin-page": "40px"
      },
      fontFamily: {
        "label-caps": ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
        "body-md": ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
        "title-sm": ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
        "body-sm": ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
        "headline-md": ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
        "display-lg": ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
        "code-sm": ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"]
      },
      fontSize: {
        "label-caps": ["11px", { lineHeight: "1", letterSpacing: "0.05em", fontWeight: "500" }],
        "body-md": ["15px", { lineHeight: "1.6", fontWeight: "400" }],
        "title-sm": ["18px", { lineHeight: "1.4", fontWeight: "600" }],
        "body-sm": ["13px", { lineHeight: "1.5", fontWeight: "400" }],
        "headline-md": ["24px", { lineHeight: "1.3", fontWeight: "600" }],
        "display-lg": ["48px", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "700" }],
        "code-sm": ["13px", { lineHeight: "1.5", fontWeight: "400" }]
      }
    },
  },
  plugins: [],
}