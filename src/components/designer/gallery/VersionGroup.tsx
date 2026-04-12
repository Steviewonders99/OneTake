"use client";

import { ChevronRight, Download, Zap, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { VersionGroup as VersionGroupType, FormatDef } from "@/lib/channels";
import { CHANNEL_DEFINITIONS, getThumbnailDimensions } from "@/lib/channels";
import type { GeneratedAsset } from "@/lib/types";
import type { Theme } from "./tokens";
import { FONT, FIGMA_ICON } from "./tokens";
import FormatCard from "./FormatCard";
import DesignNotes from "./DesignNotes";

interface VersionGroupProps {
  version: VersionGroupType;
  channelName: string;
  isExpanded: boolean;
  onToggle: () => void;
  theme: Theme;
  onAssetClick: (asset: GeneratedAsset) => void;
}

function getVqaColor(score: number, theme: Theme): string {
  if (score >= 0.85) return theme.vqaGood;
  if (score >= 0.70) return theme.vqaOk;
  return theme.vqaBad;
}

function matchFormat(asset: GeneratedAsset): FormatDef | null {
  const platform = asset.platform || "";
  for (const [, channelDef] of Object.entries(CHANNEL_DEFINITIONS)) {
    if (!channelDef.platforms.includes(platform)) continue;
    for (const fmt of channelDef.formats) {
      if (platform.includes(fmt.key) || platform.endsWith(`_${fmt.key}`)) {
        return fmt;
      }
    }
    // If platform matches channel but no specific format, return first format
    return channelDef.formats[0] || null;
  }
  return null;
}

function getUniquePlatformLabels(assets: GeneratedAsset[]): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const asset of assets) {
    const platform = asset.platform || "";
    if (seen.has(platform)) continue;
    seen.add(platform);
    // Derive short label from platform string
    if (platform.includes("feed")) labels.push("Feed");
    else if (platform.includes("story") || platform.includes("stories")) labels.push("Story");
    else if (platform.includes("carousel")) labels.push("Carousel");
    else if (platform.includes("card")) labels.push("Card");
    else if (platform.includes("post")) labels.push("Post");
    else if (platform.includes("banner")) labels.push("Banner");
    else if (platform.includes("display")) labels.push("Display");
    else if (platform.includes("moments")) labels.push("Moments");
    else if (platform.includes("channels")) labels.push("Channels");
  }
  return labels;
}

export default function VersionGroup({
  version,
  channelName,
  isExpanded,
  onToggle,
  theme,
  onAssetClick,
}: VersionGroupProps) {
  const platformLabels = getUniquePlatformLabels(version.assets);
  const hasVqa = version.avgVqaScore > 0;

  return (
    <div
      style={{
        border: `1px solid ${theme.border}`,
        borderRadius: 10,
        marginBottom: 10,
        overflow: "hidden",
      }}
    >
      {/* Trigger bar — always visible */}
      <button
        onClick={onToggle}
        style={{
          width: "100%",
          padding: "14px 20px",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          background: isExpanded ? theme.card : theme.surface,
          borderBottom: isExpanded ? `1px solid ${theme.border}` : "none",
          border: "none",
          cursor: "pointer",
          fontFamily: FONT.sans,
          transition: "background 0.15s ease",
        }}
        onMouseEnter={(e) => {
          if (!isExpanded) {
            (e.currentTarget as HTMLButtonElement).style.background = theme.card;
          }
        }}
        onMouseLeave={(e) => {
          if (!isExpanded) {
            (e.currentTarget as HTMLButtonElement).style.background = theme.surface;
          }
        }}
      >
        {/* 1. Chevron */}
        <ChevronRight
          size={12}
          style={{
            color: theme.textMuted,
            transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
            flexShrink: 0,
          }}
        />

        {/* 2. V-badge */}
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: theme.border,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: FONT.sans,
            fontSize: 12,
            fontWeight: 700,
            color: theme.text,
            flexShrink: 0,
          }}
        >
          {version.versionLabel}
        </div>

        {/* 3. Headline */}
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            flex: 1,
            color: theme.text,
            fontFamily: FONT.sans,
            textAlign: "left",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {version.headline}
        </span>

        {/* 4. Format pills */}
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          {platformLabels.map((label) => (
            <span
              key={label}
              style={{
                fontSize: 10,
                background: theme.border,
                borderRadius: 6,
                padding: "3px 10px",
                color: theme.textMuted,
                fontFamily: FONT.sans,
                fontWeight: 500,
                whiteSpace: "nowrap",
              }}
            >
              {label}
            </span>
          ))}
        </div>

        {/* 5. VQA score */}
        {hasVqa && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              fontFamily: FONT.mono,
              color: getVqaColor(version.avgVqaScore, theme),
              flexShrink: 0,
            }}
          >
            {Math.round(version.avgVqaScore * 100)}%
          </span>
        )}

        {/* 6. Action buttons */}
        <div
          style={{ display: "flex", gap: 4, flexShrink: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Download */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              for (const asset of version.assets) {
                if (asset.blob_url) window.open(asset.blob_url, "_blank");
              }
            }}
            title="Download all formats"
            style={{
              width: 30,
              height: 30,
              borderRadius: 6,
              background: theme.border,
              border: `1px solid ${theme.borderHover}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: theme.textMuted,
            }}
          >
            <Download size={13} />
          </button>

          {/* Edit (Zap) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toast.info("Coming soon — Edit system shipping next");
            }}
            title="Edit"
            style={{
              width: 30,
              height: 30,
              borderRadius: 6,
              background: theme.border,
              border: `1px solid ${theme.borderHover}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: theme.textMuted,
            }}
          >
            <Zap size={13} />
          </button>

          {/* Regenerate (RefreshCw) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toast.info("Coming soon — Edit system shipping next");
            }}
            title="Regenerate"
            style={{
              width: 30,
              height: 30,
              borderRadius: 6,
              background: theme.border,
              border: `1px solid ${theme.borderHover}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: theme.textMuted,
            }}
          >
            <RefreshCw size={13} />
          </button>

          {/* Figma */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toast.info("Coming soon — Edit system shipping next");
            }}
            title="Export to Figma"
            style={{
              width: 30,
              height: 30,
              borderRadius: 6,
              background: theme.border,
              border: `1px solid ${theme.borderHover}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
            dangerouslySetInnerHTML={{ __html: FIGMA_ICON }}
          />
        </div>
      </button>

      {/* Expanded body */}
      {isExpanded && (
        <div>
          {/* Format grid */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-evenly",
              flexWrap: "wrap",
              gap: 16,
              padding: 24,
              background: theme.surface,
            }}
          >
            {version.assets.map((asset) => {
              const format = matchFormat(asset);
              return (
                <FormatCard
                  key={asset.id}
                  asset={asset}
                  format={format}
                  theme={theme}
                  onClick={() => onAssetClick(asset)}
                  onDownload={() => {
                    if (asset.blob_url) window.open(asset.blob_url, "_blank");
                  }}
                  onExportFigma={() => {
                    window.open(`/api/export/figma/${asset.id}`, "_blank");
                  }}
                />
              );
            })}
          </div>

          {/* Design Notes */}
          {version.assets[0]?.content && (
            <DesignNotes
              content={version.assets[0].content as Record<string, any>}
              theme={theme}
            />
          )}
        </div>
      )}
    </div>
  );
}
