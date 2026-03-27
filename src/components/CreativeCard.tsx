"use client";

import { Download, RefreshCw, ImageIcon } from "lucide-react";
import type { GeneratedAsset } from "@/lib/types";

interface CreativeCardProps {
  asset: GeneratedAsset;
  onDownload?: (asset: GeneratedAsset) => void;
  onRegenerate?: (asset: GeneratedAsset) => void;
}

function getAspectRatio(format: string): string {
  if (format.includes("story") || format.includes("9:16") || format.includes("9x16")) return "9/16";
  if (format.includes("banner") || format.includes("16:9") || format.includes("16x9")) return "16/9";
  if (format.includes("4:5") || format.includes("4x5")) return "4/5";
  return "1/1";
}

function platformColor(platform: string): string {
  const colors: Record<string, string> = {
    linkedin: "#0A66C2",
    facebook: "#1877F2",
    instagram: "#E4405F",
    twitter: "#1DA1F2",
    telegram: "#0088CC",
    tiktok: "#000000",
  };
  return colors[platform.toLowerCase()] ?? "var(--oneforma-charcoal)";
}

export default function CreativeCard({ asset, onDownload, onRegenerate }: CreativeCardProps) {
  const score = asset.evaluation_score;

  return (
    <div className="group relative rounded-xl overflow-hidden border border-[var(--border)] bg-white transition-all duration-150 hover:shadow-lg">
      {/* Image area */}
      <div
        className="relative bg-[var(--muted)] flex items-center justify-center overflow-hidden"
        style={{ aspectRatio: getAspectRatio(asset.format) }}
      >
        {asset.blob_url ? (
          <img
            src={asset.blob_url}
            alt={`${asset.platform} ${asset.format}`}
            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
          />
        ) : (
          <ImageIcon size={32} className="text-[var(--muted-foreground)] opacity-30" />
        )}

        {/* Platform badge */}
        <span
          className="absolute top-2 right-2 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{ background: platformColor(asset.platform) }}
        >
          {asset.platform}
        </span>

        {/* Hover actions */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
          {onDownload && (
            <button
              onClick={(e) => { e.preventDefault(); onDownload(asset); }}
              className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center cursor-pointer hover:bg-white transition-colors"
              title="Download"
            >
              <Download size={16} className="text-[var(--foreground)]" />
            </button>
          )}
          {onRegenerate && (
            <button
              onClick={(e) => { e.preventDefault(); onRegenerate(asset); }}
              className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center cursor-pointer hover:bg-white transition-colors"
              title="Regenerate"
            >
              <RefreshCw size={16} className="text-[var(--foreground)]" />
            </button>
          )}
        </div>
      </div>

      {/* Meta */}
      <div className="p-2.5">
        <p className="text-xs font-medium text-[var(--foreground)] truncate">
          {asset.format.replace(/_/g, " ")}
        </p>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] text-[var(--muted-foreground)]">{asset.language}</span>
          {score !== null && score !== undefined && (
            <span
              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                score >= 0.8
                  ? "bg-green-50 text-green-700"
                  : score >= 0.6
                    ? "bg-yellow-50 text-yellow-700"
                    : "bg-red-50 text-red-700"
              }`}
            >
              {(score * 100).toFixed(0)}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
