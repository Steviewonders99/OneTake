"use client";

import { useState } from "react";
import { Copy, Download, Check } from "lucide-react";
import { toast } from "sonner";
import { extractField } from "@/lib/format";
import type { GeneratedAsset } from "@/lib/types";

interface CreativeGridProps {
  assets: GeneratedAsset[];
  selectedAssetId: string | null;
  onSelect: (asset: GeneratedAsset) => void;
}

/** Get post-friendly caption text (organic), stripping ad-specific fields. */
function getOrganicCaption(asset: GeneratedAsset): string {
  return (
    extractField(asset.copy_data, "primary_text") ||
    extractField(asset.copy_data, "caption") ||
    extractField(asset.copy_data, "hook") ||
    extractField(asset.content, "overlay_sub") ||
    ""
  );
}

function getHeadline(asset: GeneratedAsset): string {
  return (
    extractField(asset.content, "overlay_headline") ||
    extractField(asset.copy_data, "headline") ||
    ""
  );
}

/** Split format string on "x" and return "W x H", or return raw format. */
function getFormatLabel(asset: GeneratedAsset): string {
  if (!asset.format) return "";
  const lower = asset.format.toLowerCase();
  const match = lower.match(/^(\d+)\s*x\s*(\d+)$/);
  if (match) return `${match[1]} x ${match[2]}`;
  return asset.format;
}

/** Extract persona name from content and shorten to "FirstName L." */
function getPersonaName(asset: GeneratedAsset): string {
  const raw =
    (extractField(asset.content, "persona_name") as string | undefined) ||
    (extractField(asset.content, "actor_name") as string | undefined) ||
    "";
  if (!raw) return "";
  const parts = raw.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
}

export default function CreativeGrid({ assets, selectedAssetId, onSelect }: CreativeGridProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (assets.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "48px 0", fontSize: 14, color: "#8A8A8E" }}>
        No creatives for this channel yet.
      </div>
    );
  }

  async function handleCopyCaption(e: React.MouseEvent, caption: string) {
    e.stopPropagation();
    if (!caption) {
      toast.error("No caption available for this creative");
      return;
    }
    try {
      await navigator.clipboard.writeText(caption);
      toast.success("Caption copied to clipboard");
    } catch {
      toast.error("Could not copy caption");
    }
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 12,
        padding: "16px 18px",
      }}
    >
      {assets.map((asset) => {
        const selected = asset.id === selectedAssetId;
        const hovered = hoveredId === asset.id;
        const headline = getHeadline(asset);
        const caption = getOrganicCaption(asset);
        const formatLabel = getFormatLabel(asset);
        const personaName = getPersonaName(asset);

        return (
          <div
            key={asset.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(asset)}
            onMouseEnter={() => setHoveredId(asset.id)}
            onMouseLeave={() => setHoveredId(null)}
            style={{
              textAlign: "left",
              background: "#FFFFFF",
              border: selected ? "1px solid #6D28D9" : "1px solid #E8E8EA",
              borderRadius: 10,
              overflow: "hidden",
              cursor: "pointer",
              transition: "transform 0.15s ease, box-shadow 0.15s ease",
              transform: !selected && hovered ? "translateY(-1px)" : "translateY(0)",
              boxShadow: selected
                ? "0 0 0 2px rgba(109,40,217,0.1)"
                : hovered
                ? "0 2px 10px rgba(0,0,0,0.07)"
                : "none",
              padding: 0,
            }}
          >
            {/* Thumbnail */}
            <div
              style={{
                aspectRatio: "1",
                background: "#EBEBEB",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {asset.blob_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={asset.blob_url}
                  alt={headline || "Creative"}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  loading="lazy"
                />
              ) : null}

              {/* Persona badge — top-left */}
              {personaName && (
                <div
                  style={{
                    position: "absolute",
                    top: 6,
                    left: 6,
                    background: "rgba(255,255,255,0.85)",
                    backdropFilter: "blur(4px)",
                    borderRadius: 6,
                    padding: "2px 7px",
                    fontSize: 10,
                    fontWeight: 600,
                    color: "#1A1A1A",
                    lineHeight: "16px",
                    maxWidth: "60%",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {personaName}
                </div>
              )}

              {/* Selected checkmark — top-right */}
              {selected && (
                <div
                  style={{
                    position: "absolute",
                    top: 6,
                    right: 6,
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: "#6D28D9",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Check size={13} strokeWidth={3} color="#FFFFFF" />
                </div>
              )}

              {/* Format badge — bottom-left */}
              {formatLabel && (
                <div
                  style={{
                    position: "absolute",
                    bottom: 6,
                    left: 6,
                    background: "rgba(0,0,0,0.55)",
                    backdropFilter: "blur(4px)",
                    borderRadius: 6,
                    padding: "2px 7px",
                    fontSize: 10,
                    fontWeight: 500,
                    color: "#FFFFFF",
                    lineHeight: "16px",
                  }}
                >
                  {formatLabel}
                </div>
              )}
            </div>

            {/* Card body */}
            <div style={{ padding: "10px 10px 8px" }}>
              {headline && (
                <p
                  style={{
                    margin: "0 0 8px",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#1A1A1A",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    lineHeight: "16px",
                  }}
                >
                  {headline}
                </p>
              )}

              {/* Action buttons row */}
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  onClick={(e) => handleCopyCaption(e, caption)}
                  disabled={!caption}
                  title={caption || "No caption available"}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                    fontSize: 10,
                    fontWeight: 500,
                    padding: "5px 8px",
                    borderRadius: 6,
                    border: "1px solid #E8E8EA",
                    background: "#FFFFFF",
                    color: "#8A8A8E",
                    cursor: caption ? "pointer" : "default",
                    opacity: caption ? 1 : 0.5,
                  }}
                >
                  <Copy size={11} />
                  Copy caption
                </button>

                {asset.blob_url && (
                  <a
                    href={asset.blob_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    download
                    title="Download image"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "5px 8px",
                      borderRadius: 6,
                      border: "1px solid #E8E8EA",
                      background: "#FFFFFF",
                      color: "#8A8A8E",
                      cursor: "pointer",
                      textDecoration: "none",
                    }}
                  >
                    <Download size={11} />
                  </a>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
