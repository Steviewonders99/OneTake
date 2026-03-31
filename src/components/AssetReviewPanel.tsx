"use client";

import { useState, useMemo } from "react";
import {
  Star,
  Users,
  Layers,
  Monitor,
  Film,
  Filter,
  Search,
  Download,
  RefreshCw,
  Pencil,
  ChevronDown,
} from "lucide-react";
import MiniTabs from "@/components/MiniTabs";
import MockupPreview from "@/components/MockupPreview";
import { extractField } from "@/lib/format";
import type { GeneratedAsset } from "@/lib/types";

interface AssetReviewPanelProps {
  assets: GeneratedAsset[];
  onRefine?: (asset: GeneratedAsset) => void;
  onRetry?: (asset: GeneratedAsset) => void;
}

// ── Filter Dropdown ──────────────────────────────────

function FilterDropdown({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative inline-flex">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-[var(--muted)] border border-[var(--border)] rounded-lg px-3 py-1.5 pr-7 text-[11px] text-[var(--foreground)] cursor-pointer focus:outline-none focus:border-[#6B21A8]/30"
      >
        <option value="all">All {label}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt.replace(/_/g, " ")}
          </option>
        ))}
      </select>
      <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] pointer-events-none" />
    </div>
  );
}

// ── Asset Thumbnail ──────────────────────────────────

function AssetThumb({
  asset,
  onRefine,
  onRetry,
  showPlatform = false,
  showScore = true,
}: {
  asset: GeneratedAsset;
  onRefine?: (asset: GeneratedAsset) => void;
  onRetry?: (asset: GeneratedAsset) => void;
  showPlatform?: boolean;
  showScore?: boolean;
}) {
  const score = asset.evaluation_score || 0;
  const scoreColor = score >= 0.85 ? "#22c55e" : score >= 0.70 ? "#f59e0b" : "#ef4444";
  const content = (asset.content || {}) as Record<string, any>;
  const copyData = (asset.copy_data || {}) as Record<string, any>;

  return (
    <div className="group border border-[var(--border)] rounded-xl overflow-hidden bg-white hover:shadow-md transition-shadow">
      {/* Image */}
      <div className="relative aspect-square bg-[var(--muted)]">
        {asset.blob_url ? (
          <img
            src={asset.blob_url}
            alt={extractField(asset.content, "actor_name", "Asset")}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[var(--muted-foreground)]">
            <Layers size={20} className="opacity-30" />
          </div>
        )}

        {/* Score badge */}
        {showScore && score > 0 && (
          <div
            className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md text-[10px] font-bold text-white"
            style={{ backgroundColor: scoreColor }}
          >
            {(score * 100).toFixed(0)}%
          </div>
        )}

        {/* Platform badge */}
        {showPlatform && asset.platform && (
          <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-black/60 text-white backdrop-blur-sm">
            {asset.platform.replace(/_/g, " ")}
          </div>
        )}

        {/* Hover actions */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
          {onRefine && (
            <button
              onClick={(e) => { e.stopPropagation(); onRefine(asset); }}
              className="p-2 bg-white rounded-lg text-[var(--foreground)] hover:bg-[var(--muted)] cursor-pointer transition-colors"
              title="Request revision"
            >
              <Pencil size={14} />
            </button>
          )}
          {asset.blob_url && (
            <button
              onClick={(e) => { e.stopPropagation(); window.open(asset.blob_url!, "_blank"); }}
              className="p-2 bg-white rounded-lg text-[var(--foreground)] hover:bg-[var(--muted)] cursor-pointer transition-colors"
              title="Download"
            >
              <Download size={14} />
            </button>
          )}
          {onRetry && (
            <button
              onClick={(e) => { e.stopPropagation(); onRetry(asset); }}
              className="p-2 bg-white rounded-lg text-[var(--foreground)] hover:bg-[var(--muted)] cursor-pointer transition-colors"
              title="Regenerate"
            >
              <RefreshCw size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="px-3 py-2">
        <p className="text-[12px] font-medium text-[var(--foreground)] truncate">
          {extractField(asset.content, "actor_name", "") || extractField(asset.content, "overlay_headline", "") || asset.platform?.replace(/_/g, " ") || "Asset"}
        </p>
        <p className="text-[10px] text-[var(--muted-foreground)] truncate">
          {extractField(asset.content, "outfit_key", "").replace(/_/g, " ") || asset.format || ""}
          {copyData.headline ? ` · ${copyData.headline}` : ""}
        </p>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────

export default function AssetReviewPanel({
  assets,
  onRefine,
  onRetry,
}: AssetReviewPanelProps) {
  const [actorFilter, setActorFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");

  // Categorize assets
  const characters = useMemo(
    () => assets.filter((a) => a.asset_type === "base_image"),
    [assets]
  );
  const creatives = useMemo(
    () => assets.filter((a) => a.asset_type === "composed_creative"),
    [assets]
  );
  const videos = useMemo(
    () => assets.filter((a) => (a.asset_type as string) === "video"),
    [assets]
  );

  // Top scored for overview
  const topScored = useMemo(
    () =>
      [...characters]
        .filter((a) => (a.evaluation_score || 0) >= 0.85 && a.blob_url)
        .sort((a, b) => (b.evaluation_score || 0) - (a.evaluation_score || 0))
        .slice(0, 9),
    [characters]
  );

  // Unique actor names and platforms for filters
  const actorNames = useMemo(() => {
    const names = new Set<string>();
    characters.forEach((a) => {
      const name = extractField(a.content, "actor_name", "");
      if (name) names.add(name);
    });
    return Array.from(names).sort();
  }, [characters]);

  const platforms = useMemo(() => {
    const plats = new Set<string>();
    creatives.forEach((a) => {
      if (a.platform) plats.add(a.platform);
    });
    return Array.from(plats).sort();
  }, [creatives]);

  // Filtered views
  const filteredCharacters = useMemo(() => {
    if (actorFilter === "all") return characters;
    return characters.filter(
      (a) => extractField(a.content, "actor_name", "") === actorFilter
    );
  }, [characters, actorFilter]);

  const filteredCreatives = useMemo(() => {
    if (platformFilter === "all") return creatives;
    return creatives.filter((a) => a.platform === platformFilter);
  }, [creatives, platformFilter]);

  return (
    <MiniTabs
      defaultTab="overview"
      tabs={[
        // Tab 1: Overview — top scored
        {
          key: "overview",
          label: "Overview",
          count: topScored.length,
          content: (
            <div>
              <p className="text-[12px] text-[var(--muted-foreground)] mb-3">
                Top-scoring character images (85%+ VQA score)
              </p>
              {topScored.length > 0 ? (
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {topScored.map((asset) => (
                    <AssetThumb
                      key={asset.id}
                      asset={asset}
                      onRefine={onRefine}
                      onRetry={onRetry}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-[13px] text-[var(--muted-foreground)] py-8 text-center">
                  No images with 85%+ score yet. Assets will appear as they pass VQA.
                </p>
              )}
            </div>
          ),
        },

        // Tab 2: Actors + Variations
        ...(characters.length > 0
          ? [
              {
                key: "actors",
                label: "Actors",
                count: characters.length,
                content: (
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <FilterDropdown
                        label="Actors"
                        options={actorNames}
                        value={actorFilter}
                        onChange={setActorFilter}
                      />
                      <span className="text-[11px] text-[var(--muted-foreground)]">
                        {filteredCharacters.length} images
                      </span>
                    </div>
                    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {filteredCharacters.map((asset) => (
                        <AssetThumb
                          key={asset.id}
                          asset={asset}
                          onRefine={onRefine}
                          onRetry={onRetry}
                        />
                      ))}
                    </div>
                  </div>
                ),
              },
            ]
          : []),

        // Tab 3: Creatives — filterable by platform
        ...(creatives.length > 0
          ? [
              {
                key: "creatives",
                label: "Creatives",
                count: creatives.length,
                content: (
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <FilterDropdown
                        label="Platforms"
                        options={platforms}
                        value={platformFilter}
                        onChange={setPlatformFilter}
                      />
                      <span className="text-[11px] text-[var(--muted-foreground)]">
                        {filteredCreatives.length} creatives
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {filteredCreatives.map((asset) => (
                        <AssetThumb
                          key={asset.id}
                          asset={asset}
                          onRefine={onRefine}
                          onRetry={onRetry}
                          showPlatform
                        />
                      ))}
                    </div>
                  </div>
                ),
              },
            ]
          : []),

        // Tab 4: Ad Mockups — full platform frames with ad copy
        ...(creatives.length > 0
          ? [
              {
                key: "mockups",
                label: "Ad Mockups",
                content: (
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <FilterDropdown
                        label="Platforms"
                        options={platforms}
                        value={platformFilter}
                        onChange={setPlatformFilter}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredCreatives.slice(0, 12).map((asset) => {
                        const content = (asset.content || {}) as Record<string, any>;
                        const copyData = (asset.copy_data || {}) as Record<string, any>;
                        return (
                          <div
                            key={`mock-${asset.id}`}
                            className="border border-[var(--border)] rounded-xl overflow-hidden bg-white group"
                          >
                            {/* Mockup */}
                            <div className="bg-[#1a1a1a] p-3 relative">
                              <MockupPreview asset={asset} />
                              {/* Hover revision button */}
                              {onRefine && (
                                <button
                                  onClick={() => onRefine(asset)}
                                  className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                  title="Request revision"
                                >
                                  <Pencil size={12} />
                                </button>
                              )}
                            </div>
                            {/* Ad Copy */}
                            <div className="p-3 space-y-1.5">
                              <div className="flex items-center gap-2">
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-[#0693E308] text-[#0693E3] border border-[#0693E315]">
                                  {asset.platform?.replace(/_/g, " ")}
                                </span>
                                <span className="text-[10px] text-[var(--muted-foreground)]">
                                  {asset.format}
                                </span>
                              </div>
                              {(content.overlay_headline || copyData.headline) && (
                                <div>
                                  <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Headline</span>
                                  <p className="text-[12px] font-semibold text-[var(--foreground)]">
                                    {content.overlay_headline || copyData.headline}
                                  </p>
                                </div>
                              )}
                              {(copyData.primary_text || copyData.description) && (
                                <div>
                                  <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Copy</span>
                                  <p className="text-[11px] text-[var(--muted-foreground)] line-clamp-2">
                                    {copyData.primary_text || copyData.description}
                                  </p>
                                </div>
                              )}
                              {(content.overlay_cta || copyData.cta) && (
                                <div>
                                  <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">CTA</span>
                                  <p className="text-[12px] font-medium text-[#6B21A8]">
                                    {content.overlay_cta || copyData.cta}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ),
              },
            ]
          : []),

        // Videos moved to own parent LiveSection
      ]}
    />
  );
}
