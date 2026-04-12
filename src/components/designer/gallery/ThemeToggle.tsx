"use client";

import { Sun, Moon } from "lucide-react";
import type { Theme } from "./tokens";
import { DARK } from "./tokens";

interface ThemeToggleProps {
  theme: Theme;
  onToggle: () => void;
}

export default function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const isDark = theme === DARK;
  return (
    <button
      onClick={onToggle}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        border: `1px solid ${theme.border}`,
        background: theme.surface,
        color: theme.textMuted,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transition: "all 0.2s ease",
      }}
    >
      {isDark ? <Sun size={14} /> : <Moon size={14} />}
    </button>
  );
}
