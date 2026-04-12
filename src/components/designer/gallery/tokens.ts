// src/components/designer/gallery/tokens.ts

export const DARK = {
  bg: "#0F0F10",
  surface: "#141416",
  card: "#1A1A1E",
  border: "#2A2A2E",
  borderHover: "#3A3A3E",
  text: "#E8E8EA",
  textMuted: "#8A8A8E",
  textDim: "#6A6A6E",
  accent: "#6D28D9",
  accentSoft: "rgba(109,40,217,0.15)",
  vqaGood: "#22c55e",
  vqaOk: "#f59e0b",
  vqaBad: "#ef4444",
} as const;

export const LIGHT = {
  bg: "#FFFFFF",
  surface: "#F7F7F8",
  card: "#FFFFFF",
  border: "#E8E8EA",
  borderHover: "#D0D0D4",
  text: "#1A1A1A",
  textMuted: "#8A8A8E",
  textDim: "#B0B0B4",
  accent: "#6D28D9",
  accentSoft: "rgba(109,40,217,0.08)",
  vqaGood: "#16a34a",
  vqaOk: "#d97706",
  vqaBad: "#dc2626",
} as const;

export type Theme = typeof DARK;

export const FONT = {
  sans: "-apple-system, system-ui, 'Segoe UI', Roboto, sans-serif",
  mono: "'SF Mono', 'Fira Code', monospace",
} as const;

// Figma logo SVG as a constant (5-color, used in multiple components)
export const FIGMA_ICON = `<svg width="13" height="13" viewBox="0 0 38 57" fill="none"><path d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0z" fill="#1ABCFE"/><path d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0z" fill="#0ACF83"/><path d="M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19z" fill="#FF7262"/><path d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5z" fill="#F24E1E"/><path d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5z" fill="#A259FF"/></svg>`;
