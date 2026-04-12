"use client";

import { useState } from "react";
import { Download, Zap } from "lucide-react";
import type { GeneratedAsset } from "@/lib/types";
import type { FormatDef } from "@/lib/channels";
import { getThumbnailDimensions } from "@/lib/channels";
import type { Theme } from "./tokens";
import { FONT, FIGMA_ICON } from "./tokens";

interface FormatCardProps {
  asset: GeneratedAsset;
  format: FormatDef | null;
  theme: Theme;
  onClick: () => void;
  onDownload: () => void;
  onExportFigma: () => void;
  onEdit?: () => void;
}

function getVqaColor(score: number, theme: Theme): string {
  if (score >= 0.85) return theme.vqaGood;
  if (score >= 0.70) return theme.vqaOk;
  return theme.vqaBad;
}

function getVqaBg(score: number, theme: Theme): string {
  const color = getVqaColor(score, theme);
  return `${color}33`; // 20% opacity hex
}

function deriveFormatLabel(asset: GeneratedAsset): string {
  const platform = asset.platform || "";
  if (platform.includes("feed")) return "Feed";
  if (platform.includes("story") || platform.includes("stories")) return "Story";
  if (platform.includes("carousel")) return "Carousel";
  if (platform.includes("card")) return "Card";
  if (platform.includes("post")) return "Post";
  if (platform.includes("banner")) return "Banner";
  if (platform.includes("display")) return "Display";
  if (platform.includes("moments")) return "Moments";
  if (platform.includes("channels")) return "Channels";
  return "Creative";
}

export default function FormatCard({
  asset,
  format,
  theme,
  onClick,
  onDownload,
  onExportFigma,
  onEdit,
}: FormatCardProps) {
  const [hovered, setHovered] = useState(false);

  // Compute dimensions
  const dims = format
    ? getThumbnailDimensions(format, 180)
    : { width: 180, height: 180 };

  // Format label + ratio
  const label = format
    ? `${format.label} ${format.ratio}`
    : deriveFormatLabel(asset);

  // Dimensions text (real pixel dimensions from format def)
  const dimsText = format
    ? `${format.width} \u00D7 ${format.height}`
    : `${dims.width} \u00D7 ${dims.height}`;

  // VQA score
  const vqaScore = asset.evaluation_score;
  const hasVqa = vqaScore != null && vqaScore > 0;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: 6,
        borderRadius: 12,
        border: `1px solid ${hovered ? theme.borderHover : theme.border}`,
        background: theme.card,
        cursor: "pointer",
        transition: "all 150ms ease",
        transform: hovered ? "scale(1.02)" : "scale(1)",
        boxShadow: hovered ? "0 8px 24px rgba(0,0,0,0.4)" : "none",
      }}
    >
      {/* Image area */}
      <div
        style={{
          position: "relative",
          width: dims.width,
          height: dims.height,
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        {/* Image or placeholder */}
        {asset.blob_url ? (
          <img
            src={asset.blob_url}
            alt={label}
            loading="lazy"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              background: "linear-gradient(135deg, #2A2A2E, #1A1A1E)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontSize: 14,
                color: theme.textMuted,
                opacity: 0.08,
                fontWeight: 700,
                fontFamily: FONT.mono,
              }}
            >
              {format ? format.ratio : "1:1"}
            </span>
          </div>
        )}

        {/* Platform badge (top-left) */}
        <div
          style={{
            position: "absolute",
            top: 6,
            left: 6,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            borderRadius: 4,
            padding: "3px 6px",
            fontSize: 9,
            fontWeight: 700,
            color: "#FFFFFF",
            fontFamily: FONT.sans,
            lineHeight: 1,
          }}
        >
          {label}
        </div>

        {/* VQA score badge (top-right) */}
        {hasVqa && (
          <div
            style={{
              position: "absolute",
              top: 6,
              right: 6,
              background: getVqaBg(vqaScore, theme),
              borderRadius: 4,
              padding: "3px 6px",
              fontSize: 10,
              fontWeight: 700,
              color: getVqaColor(vqaScore, theme),
              fontFamily: FONT.mono,
              lineHeight: 1,
            }}
          >
            {Math.round(vqaScore * 100)}%
          </div>
        )}

        {/* Hover overlay with action buttons */}
        {hovered && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.5)",
              backdropFilter: "blur(2px)",
              WebkitBackdropFilter: "blur(2px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {/* Download button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDownload();
              }}
              title="Download"
              style={{
                width: 36,
                height: 36,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(255,255,255,0.15)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 8,
                cursor: "pointer",
                color: "#FFFFFF",
              }}
            >
              <Download size={16} />
            </button>

            {/* Edit button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.();
              }}
              title="Edit"
              style={{
                width: 36,
                height: 36,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(255,255,255,0.15)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 8,
                cursor: "pointer",
                color: "#FFFFFF",
              }}
            >
              <Zap size={16} />
            </button>

            {/* Figma button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onExportFigma();
              }}
              title="Export to Figma"
              style={{
                width: 36,
                height: 36,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(255,255,255,0.15)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 8,
                cursor: "pointer",
              }}
              dangerouslySetInnerHTML={{ __html: FIGMA_ICON }}
            />
          </div>
        )}
      </div>

      {/* Dimensions text below image */}
      <div
        style={{
          fontSize: 10,
          fontFamily: FONT.mono,
          color: theme.textMuted,
          padding: "8px 4px 2px",
        }}
      >
        {dimsText}
      </div>
    </div>
  );
}
