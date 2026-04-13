"use client";

import { useState } from "react";
import { Image as ImageIcon, Clock, ChevronRight } from "lucide-react";
import { IntakeRequest } from "@/lib/types";
import { Theme, FONT } from "../gallery/tokens";

interface PersonaChip {
  name: string;
  initial: string;
  color: string;
}

interface WorkItemRowProps {
  campaign: IntakeRequest;
  creativeCount: number;
  personaCount: number;
  personas: PersonaChip[];
  avgVqa: number;
  progress: number; // 0-100
  priority: "urgent" | "high" | "medium" | "low";
  theme: Theme;
  onClick: () => void;
  dimmed?: boolean;
}

const PRIORITY_COLORS: Record<WorkItemRowProps["priority"], string> = {
  urgent: "#ef4444",
  high: "#f59e0b",
  medium: "#3b82f6",
  low: "#5A5A5E",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getVqaColor(vqa: number, theme: Theme): string {
  if (vqa >= 85) return theme.vqaGood;
  if (vqa >= 70) return theme.vqaOk;
  return theme.vqaBad;
}

function getProgressColor(progress: number): string {
  if (progress >= 80) return "#22c55e";
  if (progress >= 40) return "#A78BFA";
  return "#f59e0b";
}

export default function WorkItemRow({
  campaign,
  creativeCount,
  personaCount: _personaCount,
  personas,
  avgVqa,
  progress,
  priority,
  theme,
  onClick,
  dimmed = false,
}: WorkItemRowProps) {
  const [hovered, setHovered] = useState(false);

  const priorityColor = PRIORITY_COLORS[priority];
  const progressColor = getProgressColor(progress);

  const title = campaign.title || "Untitled Campaign";
  const slug = campaign.campaign_slug ?? campaign.id.slice(0, 8);
  const taskType = campaign.task_type ?? "—";

  return (
    <div
      onClick={dimmed ? undefined : onClick}
      onMouseEnter={() => !dimmed && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "grid",
        gridTemplateColumns: "24px 1fr 120px 80px 80px 100px 130px 40px",
        gap: "12px",
        padding: "12px 32px",
        alignItems: "center",
        background: hovered ? theme.rowHover : "transparent",
        opacity: dimmed ? 0.6 : 1,
        cursor: dimmed ? "default" : "pointer",
        transition: "background 0.15s ease, opacity 0.15s ease",
        borderBottom: `1px solid ${theme.border}`,
        boxSizing: "border-box" as const,
        fontFamily: FONT.sans,
      }}
    >
      {/* 1. Priority bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: "4px",
            height: "28px",
            borderRadius: "2px",
            background: priorityColor,
            flexShrink: 0,
          }}
        />
      </div>

      {/* 2. Campaign info */}
      <div style={{ minWidth: 0, overflow: "hidden" }}>
        <div
          style={{
            fontSize: "15px",
            fontWeight: 700,
            color: theme.text,
            fontFamily: FONT.sans,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            lineHeight: 1.3,
          }}
        >
          {title}
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              padding: "2px 6px",
              borderRadius: 9999,
              background: "rgba(232,75,165,0.1)",
              color: "#E84BA5",
              textTransform: "uppercase" as const,
              letterSpacing: "0.04em",
              marginLeft: 6,
              verticalAlign: "middle",
            }}
          >
            ORGANIC
          </span>
        </div>
        <div
          style={{
            fontSize: "12px",
            color: theme.textMuted,
            fontFamily: FONT.sans,
            marginTop: "2px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {slug} · {taskType}
        </div>
      </div>

      {/* 3. Persona chips */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          position: "relative" as const,
          height: "22px",
        }}
      >
        {personas.slice(0, 4).map((p, i) => (
          <div
            key={i}
            title={p.name}
            style={{
              width: "22px",
              height: "22px",
              borderRadius: "50%",
              background: p.color,
              border: `2px solid ${theme.bg}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "9px",
              fontWeight: 700,
              color: "#fff",
              fontFamily: FONT.sans,
              flexShrink: 0,
              position: "absolute" as const,
              left: `${i * 14}px`,
              zIndex: personas.length - i,
              boxSizing: "border-box" as const,
            }}
          >
            {p.initial}
          </div>
        ))}
        {personas.length === 0 && (
          <span style={{ fontSize: "12px", color: theme.textDim }}>—</span>
        )}
      </div>

      {/* 4. Creative count */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "5px",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontSize: "14px",
            fontWeight: 700,
            color: theme.text,
            fontFamily: FONT.sans,
          }}
        >
          {creativeCount}
        </span>
        <ImageIcon size={13} color={theme.textMuted} />
      </div>

      {/* 5. VQA score */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        {avgVqa > 0 ? (
          <span
            style={{
              fontSize: "13px",
              fontWeight: 700,
              color: getVqaColor(avgVqa, theme),
              fontFamily: FONT.sans,
            }}
          >
            {avgVqa}%
          </span>
        ) : (
          <span
            style={{
              fontSize: "13px",
              color: theme.textDim,
              fontFamily: FONT.sans,
            }}
          >
            —
          </span>
        )}
      </div>

      {/* 6. Created date */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          justifyContent: "center",
        }}
      >
        <Clock size={11} color={theme.textMuted} />
        <span
          style={{
            fontSize: "13px",
            color: theme.textMuted,
            fontFamily: FONT.sans,
          }}
        >
          {formatDate(campaign.created_at)}
        </span>
      </div>

      {/* 7. Progress bar */}
      <div
        style={{
          display: "flex",
          flexDirection: "column" as const,
          gap: "4px",
        }}
      >
        <div
          style={{
            height: "4px",
            borderRadius: "2px",
            background: theme.border,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${Math.min(100, Math.max(0, progress))}%`,
              background: progressColor,
              borderRadius: "2px",
              transition: "width 0.3s ease",
            }}
          />
        </div>
        <span
          style={{
            fontSize: "11px",
            color: theme.textMuted,
            fontFamily: FONT.sans,
            textAlign: "right" as const,
          }}
        >
          {progress}%
        </span>
      </div>

      {/* 8. Arrow */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: hovered ? theme.textMuted : theme.textDim,
          transition: "color 0.15s ease",
        }}
      >
        <ChevronRight size={16} />
      </div>
    </div>
  );
}
