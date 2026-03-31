"use client";

import { useState, useMemo } from "react";
import {
  Monitor,
  Type,
  MousePointer,
  Copy,
  Check,
} from "lucide-react";
import { PlacementPreviewFrame } from "@/components/platform-mockups/PlacementPreviewFrame";
import FilterTabs from "@/components/FilterTabs";
import type { MockupCreative } from "@/lib/mockup-types";
import type { GeneratedAsset } from "@/lib/types";

// ── Types ────────────────────────────────────────────────────────

interface PlatformPreviewWithCopyProps {
  assets: GeneratedAsset[];
  brandName?: string;
}

interface CopyBlock {
  headline?: string;
  primaryText?: string;
  ctaText?: string;
  description?: string;
}

// ── Helpers ──────────────────────────────────────────────────────

const PLATFORMS = ["all", "instagram", "facebook", "linkedin", "tiktok", "telegram"];

function extractCopyData(asset: GeneratedAsset): CopyBlock {
  const copy = asset.copy_data as Record<string, unknown> | null;
  const content = asset.content as Record<string, unknown> | null;

  const block: CopyBlock = {};

  if (copy) {
    if (typeof copy.headline === "string") block.headline = copy.headline;
    if (typeof copy.primary_text === "string") block.primaryText = copy.primary_text;
    if (typeof copy.primaryText === "string") block.primaryText = copy.primaryText;
    if (typeof copy.cta_text === "string") block.ctaText = copy.cta_text;
    if (typeof copy.ctaText === "string") block.ctaText = copy.ctaText;
    if (typeof copy.description === "string") block.description = copy.description;
  }

  // Fallback to content fields
  if (content && !block.headline) {
    if (typeof content.headline === "string") block.headline = content.headline;
    if (typeof content.primary_text === "string" && !block.primaryText)
      block.primaryText = content.primary_text;
    if (typeof content.cta_text === "string" && !block.ctaText)
      block.ctaText = content.cta_text;
  }

  return block;
}

function assetToCreative(asset: GeneratedAsset, brandName: string): MockupCreative {
  const copy = extractCopyData(asset);
  return {
    platform: asset.platform,
    placement: asset.format.includes("story")
      ? "stories"
      : asset.format.includes("reel")
        ? "reels"
        : "feed",
    imageUrl: asset.blob_url ?? undefined,
    headline: copy.headline,
    description: copy.description,
    primaryText: copy.primaryText,
    ctaText: copy.ctaText ?? "Learn More",
    brandName,
  };
}

// ── CopyLine sub-component ───────────────────────────────────────

function CopyLine({ label, value, icon: Icon }: { label: string; value: string; icon: React.ComponentType<{ size?: number; className?: string }> }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="flex items-start gap-2 group">
      <Icon size={12} className="text-[var(--muted-foreground)] mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-medium text-[var(--muted-foreground)] uppercase tracking-wide mb-0.5">
          {label}
        </p>
        <p className="text-xs text-[var(--foreground)] leading-relaxed">{value}</p>
      </div>
      <button
        onClick={handleCopy}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded cursor-pointer hover:bg-[var(--muted)]"
        title="Copy to clipboard"
      >
        {copied ? (
          <Check size={11} className="text-green-600" />
        ) : (
          <Copy size={11} className="text-[var(--muted-foreground)]" />
        )}
      </button>
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────

export default function PlatformPreviewWithCopy({
  assets,
  brandName = "OneForma",
}: PlatformPreviewWithCopyProps) {
  const [platformFilter, setPlatformFilter] = useState("all");

  // Only composed creatives and carousel panels have copy data
  const composedAssets = useMemo(
    () =>
      assets.filter(
        (a) =>
          (a.asset_type === "composed_creative" || a.asset_type === "carousel_panel") &&
          a.blob_url
      ),
    [assets]
  );

  // Platform tabs with counts
  const platformTabs = useMemo(() => {
    const countMap = new Map<string, number>();
    for (const a of composedAssets) {
      const p = a.platform.toLowerCase();
      countMap.set(p, (countMap.get(p) ?? 0) + 1);
    }
    return PLATFORMS.filter(
      (p) => p === "all" || countMap.has(p)
    ).map((p) => ({
      value: p,
      label: p === "all" ? "All" : p.charAt(0).toUpperCase() + p.slice(1),
      count: p === "all" ? composedAssets.length : (countMap.get(p) ?? 0),
    }));
  }, [composedAssets]);

  // Filtered list
  const filtered = useMemo(() => {
    if (platformFilter === "all") return composedAssets;
    return composedAssets.filter(
      (a) => a.platform.toLowerCase() === platformFilter
    );
  }, [composedAssets, platformFilter]);

  if (composedAssets.length === 0) {
    return (
      <div className="card p-6">
        <div className="text-center py-8">
          <Monitor size={28} className="mx-auto text-[var(--muted-foreground)] mb-2 opacity-40" />
          <p className="text-sm text-[var(--muted-foreground)]">
            No composed creatives with copy data available
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-base font-semibold text-[var(--foreground)]">
          Platform Preview with Copy
        </h2>
        <span className="text-xs text-[var(--muted-foreground)]">
          {filtered.length} creative{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Platform filter pills */}
      <FilterTabs
        tabs={platformTabs}
        value={platformFilter}
        onChange={setPlatformFilter}
      />

      {/* Preview grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filtered.map((asset) => {
          const creative = assetToCreative(asset, brandName);
          const copy = extractCopyData(asset);
          const hasCopy = copy.headline || copy.primaryText || copy.ctaText;

          return (
            <div key={asset.id} className="card overflow-hidden">
              {/* Platform mockup */}
              <PlacementPreviewFrame creative={creative} />

              {/* Copy section */}
              {hasCopy && (
                <div className="p-4 space-y-2.5 border-t border-[var(--border)]">
                  {copy.headline && (
                    <CopyLine label="Headline" value={copy.headline} icon={Type} />
                  )}
                  {copy.primaryText && (
                    <CopyLine label="Primary Text" value={copy.primaryText} icon={Type} />
                  )}
                  {copy.ctaText && (
                    <CopyLine label="CTA" value={copy.ctaText} icon={MousePointer} />
                  )}
                  {copy.description && (
                    <CopyLine label="Description" value={copy.description} icon={Type} />
                  )}
                </div>
              )}

              {/* Meta footer */}
              <div className="px-4 py-2.5 bg-[var(--muted)] text-[10px] text-[var(--muted-foreground)] flex items-center justify-between">
                <span>{asset.platform} / {asset.format.replace(/_/g, " ")}</span>
                <span>{asset.language}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
