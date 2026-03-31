"use client";

import { useState, useMemo } from "react";
import { Search, ImageIcon, GripVertical } from "lucide-react";
import ImageLoader from "@/components/ui/image-loading";
import FilterTabs from "@/components/FilterTabs";
import type { GeneratedAsset, IntakeRequest } from "@/lib/types";

// ── Types ────────────────────────────────────────────────────────

export interface AssetWithCampaign extends GeneratedAsset {
  campaign_title?: string;
}

interface AssetBrowserProps {
  assets: AssetWithCampaign[];
  campaigns: IntakeRequest[];
  onAssetSelect: (asset: AssetWithCampaign) => void;
  selectedAssetId?: string;
}

// ── Filter types ─────────────────────────────────────────────────

type AssetFilter = "all" | "characters" | "creatives" | "raw";

// ── Component ────────────────────────────────────────────────────

export default function AssetBrowser({
  assets,
  campaigns,
  onAssetSelect,
  selectedAssetId,
}: AssetBrowserProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<AssetFilter>("all");
  const [campaignFilter, setCampaignFilter] = useState<string>("all");

  // ── Counts ──────────────────────────────────────────────────
  const counts = useMemo(() => {
    const chars = assets.filter((a) => a.asset_type === "base_image").length;
    const composed = assets.filter(
      (a) => a.asset_type === "composed_creative" || a.asset_type === "carousel_panel"
    ).length;
    return { all: assets.length, characters: chars, creatives: composed, raw: chars };
  }, [assets]);

  const filterTabs = [
    { value: "all", label: "All", count: counts.all },
    { value: "characters", label: "Characters", count: counts.characters },
    { value: "creatives", label: "Creatives", count: counts.creatives },
    { value: "raw", label: "Raw", count: counts.raw },
  ];

  // ── Filtered list ───────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = assets;

    // Campaign filter
    if (campaignFilter !== "all") {
      result = result.filter((a) => a.request_id === campaignFilter);
    }

    // Type filter
    switch (filter) {
      case "characters":
        result = result.filter((a) => a.asset_type === "base_image");
        break;
      case "creatives":
        result = result.filter(
          (a) => a.asset_type === "composed_creative" || a.asset_type === "carousel_panel"
        );
        break;
      case "raw":
        result = result.filter((a) => a.asset_type === "base_image");
        break;
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.platform.toLowerCase().includes(q) ||
          a.format.toLowerCase().includes(q) ||
          a.language.toLowerCase().includes(q) ||
          (a.campaign_title?.toLowerCase().includes(q) ?? false)
      );
    }

    return result;
  }, [assets, filter, campaignFilter, search]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border)] space-y-3">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">Assets</h3>

        {/* Search */}
        <div className="relative">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
          />
          <input
            type="text"
            placeholder="Search assets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-[8px] border border-[var(--border)] bg-white text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--oneforma-charcoal)]/20"
          />
        </div>

        {/* Filter pills */}
        <FilterTabs
          tabs={filterTabs}
          value={filter}
          onChange={(v) => setFilter(v as AssetFilter)}
        />

        {/* Campaign dropdown */}
        {campaigns.length > 1 && (
          <select
            value={campaignFilter}
            onChange={(e) => setCampaignFilter(e.target.value)}
            className="w-full px-3 py-1.5 text-xs rounded-[8px] border border-[var(--border)] bg-white text-[var(--foreground)] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--oneforma-charcoal)]/20"
          >
            <option value="all">All campaigns</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Asset grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {filtered.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {filtered.map((asset) => (
              <div
                key={asset.id}
                draggable="true"
                onDragStart={(e) => {
                  e.dataTransfer.setData(
                    "application/json",
                    JSON.stringify({
                      id: asset.id,
                      blob_url: asset.blob_url,
                      platform: asset.platform,
                      format: asset.format,
                      asset_type: asset.asset_type,
                    })
                  );
                  e.dataTransfer.effectAllowed = "copy";
                }}
                onClick={() => onAssetSelect(asset)}
                className={`
                  relative rounded-[10px] overflow-hidden border cursor-pointer transition-all group
                  ${
                    selectedAssetId === asset.id
                      ? "border-[var(--oneforma-charcoal)] ring-2 ring-[var(--oneforma-charcoal)]/20"
                      : "border-[var(--border)] hover:border-[var(--oneforma-charcoal)]/40"
                  }
                `}
              >
                {/* Image */}
                <div className="aspect-square bg-[var(--muted)] relative">
                  {asset.blob_url ? (
                    <img
                      src={asset.blob_url}
                      alt={`${asset.platform} ${asset.format}`}
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <ImageIcon size={20} className="text-[var(--muted-foreground)] opacity-30" />
                    </div>
                  )}

                  {/* Drag handle hint */}
                  <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <GripVertical size={14} className="text-white drop-shadow-md" />
                  </div>

                  {/* VQA score */}
                  {asset.evaluation_score !== null && asset.evaluation_score !== undefined && (
                    <span
                      className={`absolute bottom-1 left-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                        asset.evaluation_score >= 0.8
                          ? "bg-green-50 text-green-700"
                          : asset.evaluation_score >= 0.6
                            ? "bg-yellow-50 text-yellow-700"
                            : "bg-red-50 text-red-700"
                      }`}
                    >
                      {(asset.evaluation_score * 100).toFixed(0)}%
                    </span>
                  )}
                </div>

                {/* Label */}
                <div className="px-2 py-1.5">
                  <p className="text-[10px] font-medium text-[var(--foreground)] truncate">
                    {asset.platform}
                  </p>
                  <p className="text-[9px] text-[var(--muted-foreground)] truncate">
                    {asset.format.replace(/_/g, " ")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12">
            <ImageIcon size={24} className="text-[var(--muted-foreground)] mb-2 opacity-40" />
            <p className="text-xs text-[var(--muted-foreground)]">No assets found</p>
          </div>
        )}
      </div>
    </div>
  );
}
