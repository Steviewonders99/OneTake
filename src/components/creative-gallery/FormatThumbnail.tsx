"use client";

import type { GeneratedAsset } from "@/lib/types";

interface FormatThumbnailProps {
  asset: GeneratedAsset;
  formatLabel: string;
  width: number;
  height: number;
  dimensions: string;
  onClick: (asset: GeneratedAsset) => void;
}

export default function FormatThumbnail({
  asset,
  formatLabel,
  width,
  height,
  dimensions,
  onClick,
}: FormatThumbnailProps) {
  return (
    <div className="flex-shrink-0 text-center">
      <div
        className="rounded-xl overflow-hidden cursor-pointer transition-transform duration-150 hover:scale-[1.02]"
        style={{
          width: `${width}px`,
          height: `${height}px`,
          boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
        }}
        onClick={() => onClick(asset)}
      >
        {asset.blob_url ? (
          <img
            src={asset.blob_url}
            alt={formatLabel}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{
              background:
                "linear-gradient(135deg, #3D1059 0%, #6B21A8 40%, #E91E8C 100%)",
            }}
          >
            <span className="text-white/50 text-xs">No preview</span>
          </div>
        )}
      </div>
      <div className="mt-2 text-xs font-semibold text-[#1A1A1A]">
        {formatLabel}
      </div>
      <div className="text-[11px] text-[#999]">{dimensions}</div>
    </div>
  );
}
