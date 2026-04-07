"use client";

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

export default function CreativeGrid({ assets, selectedAssetId, onSelect }: CreativeGridProps) {
  if (assets.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-[var(--muted-foreground)]">
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
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
      {assets.map((asset) => {
        const selected = asset.id === selectedAssetId;
        const headline = getHeadline(asset);
        const caption = getOrganicCaption(asset);

        return (
          <button
            key={asset.id}
            onClick={() => onSelect(asset)}
            className={[
              "group text-left bg-white border rounded-xl overflow-hidden cursor-pointer transition-all",
              selected
                ? "border-[#9B51E0] ring-2 ring-[#9B51E0]/20 shadow-md"
                : "border-[var(--border)] hover:border-[#32373C]",
            ].join(" ")}
          >
            <div className="aspect-square bg-[var(--muted)] relative overflow-hidden">
              {asset.blob_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={asset.blob_url}
                  alt={headline || "Creative"}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-[var(--muted-foreground)]">
                  No preview
                </div>
              )}
              {selected && (
                <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#9B51E0] text-white flex items-center justify-center shadow-sm">
                  <Check size={14} strokeWidth={3} />
                </div>
              )}
            </div>
            <div className="p-3 space-y-2">
              {headline && (
                <p className="text-xs font-semibold text-[var(--foreground)] line-clamp-2">{headline}</p>
              )}
              <div className="flex items-center gap-1 pt-1">
                <button
                  type="button"
                  onClick={(e) => handleCopyCaption(e, caption)}
                  className="flex-1 flex items-center justify-center gap-1 text-[10px] font-medium px-2 py-1.5 rounded-md border border-[var(--border)] hover:bg-[var(--muted)] cursor-pointer"
                  disabled={!caption}
                  title={caption || "No caption available"}
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
                    className="flex items-center justify-center gap-1 text-[10px] font-medium px-2 py-1.5 rounded-md border border-[var(--border)] hover:bg-[var(--muted)] cursor-pointer"
                    title="Download image"
                  >
                    <Download size={11} />
                  </a>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
