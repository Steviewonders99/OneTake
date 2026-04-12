"use client";

import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Theme, FONT } from "../gallery/tokens";

interface StatusGroupProps {
  status: "review" | "approved" | "generating" | "sent";
  label: string;
  count: number;
  isExpanded: boolean;
  onToggle: () => void;
  theme: Theme;
  children: React.ReactNode;
}

const DOT_COLORS: Record<StatusGroupProps["status"], string> = {
  review: "#f59e0b",
  approved: "#22c55e",
  generating: "#A78BFA",
  sent: "#22d3ee",
};

export default function StatusGroup({
  status,
  label,
  count,
  isExpanded,
  onToggle,
  theme,
  children,
}: StatusGroupProps) {
  const [hovered, setHovered] = useState(false);
  const dotColor = DOT_COLORS[status];
  const isPulsing = status === "generating";

  return (
    <div>
      {/* Keyframes for generating pulse */}
      {isPulsing && (
        <style>{`
          @keyframes sg-pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(1.3); }
          }
        `}</style>
      )}

      {/* Header row */}
      <button
        onClick={onToggle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          width: "100%",
          padding: "10px 32px",
          borderBottom: `1px solid ${theme.border}`,
          border: "none",
          borderBottomWidth: "1px",
          borderBottomStyle: "solid" as const,
          borderBottomColor: theme.border,
          background: hovered ? theme.surface : "transparent",
          cursor: "pointer",
          textAlign: "left" as const,
          fontFamily: FONT.sans,
          transition: "background 0.15s ease",
          boxSizing: "border-box" as const,
          outline: "none",
        }}
      >
        {/* Chevron */}
        <span
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: theme.textDim,
            transition: "transform 0.2s ease",
            transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)",
            flexShrink: 0,
          }}
        >
          <ChevronDown size={14} />
        </span>

        {/* Status dot */}
        <span
          style={{
            width: "7px",
            height: "7px",
            borderRadius: "50%",
            background: dotColor,
            flexShrink: 0,
            animation: isPulsing ? "sg-pulse 1.6s ease-in-out infinite" : undefined,
          }}
        />

        {/* Label */}
        <span
          style={{
            fontSize: "14px",
            fontWeight: 600,
            color: theme.text,
            fontFamily: FONT.sans,
            flex: 1,
          }}
        >
          {label}
        </span>

        {/* Count */}
        <span
          style={{
            fontSize: "12px",
            color: theme.textMuted,
            fontFamily: FONT.sans,
            fontWeight: 400,
          }}
        >
          {count}
        </span>
      </button>

      {/* Children — shown when expanded */}
      {isExpanded && <div>{children}</div>}
    </div>
  );
}
