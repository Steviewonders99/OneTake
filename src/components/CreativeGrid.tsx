"use client";

import { useState } from "react";
import CreativeCard from "./CreativeCard";
import FilterTabs from "./FilterTabs";
import type { GeneratedAsset } from "@/lib/types";

interface CreativeGridProps {
  assets: GeneratedAsset[];
  onDownload?: (asset: GeneratedAsset) => void;
  onRegenerate?: (asset: GeneratedAsset) => void;
}

export default function CreativeGrid({ assets, onDownload, onRegenerate }: CreativeGridProps) {
  const [platformFilter, setPlatformFilter] = useState("all");

  const platforms = Array.from(new Set(assets.map((a) => a.platform)));
  const tabs = [
    { value: "all", label: "All", count: assets.length },
    ...platforms.map((p) => ({
      value: p,
      label: p,
      count: assets.filter((a) => a.platform === p).length,
    })),
  ];

  const filtered =
    platformFilter === "all"
      ? assets
      : assets.filter((a) => a.platform === platformFilter);

  const passed = assets.filter((a) => a.evaluation_passed).length;

  return (
    <div className="space-y-4">
      <FilterTabs tabs={tabs} value={platformFilter} onChange={setPlatformFilter} />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {filtered.map((asset) => (
          <CreativeCard
            key={asset.id}
            asset={asset}
            onDownload={onDownload}
            onRegenerate={onRegenerate}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-8 text-sm text-[var(--muted-foreground)]">
          No creatives for this filter
        </div>
      )}

      {/* Progress */}
      <div className="text-xs text-[var(--muted-foreground)] text-center pt-2">
        {passed} of {assets.length} completed
      </div>
    </div>
  );
}
