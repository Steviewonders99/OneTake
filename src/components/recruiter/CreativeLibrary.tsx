"use client";

import { useState, useMemo, useEffect } from "react";
import CreativeGrid from "./CreativeGrid";
import type { CreativeBrief, GeneratedAsset } from "@/lib/types";

interface CreativeLibraryProps {
  requestId: string;
  campaignSlug: string | null;
  brief: CreativeBrief | null;
  assets: GeneratedAsset[];
  onAssetSelect: (asset: GeneratedAsset | null) => void;
}

const CHANNEL_ORDER = ["linkedin", "facebook", "instagram", "reddit"];

function sortChannels(a: string, b: string): number {
  const ai = CHANNEL_ORDER.indexOf(a.toLowerCase());
  const bi = CHANNEL_ORDER.indexOf(b.toLowerCase());
  if (ai === -1 && bi === -1) return a.localeCompare(b);
  if (ai === -1) return 1;
  if (bi === -1) return -1;
  return ai - bi;
}

const CHANNEL_LABEL: Record<string, string> = {
  linkedin: "LinkedIn",
  facebook: "Facebook",
  instagram: "Instagram",
  reddit: "Reddit",
};

export default function CreativeLibrary({
  requestId,
  campaignSlug,
  brief,
  assets,
  onAssetSelect,
}: CreativeLibraryProps) {
  const approvedAssets = useMemo(
    () =>
      assets.filter(
        (a) =>
          (a.asset_type === "composed_creative" || a.asset_type === "base_creative" || a.asset_type === "base_image") &&
          a.evaluation_passed === true &&
          a.blob_url
      ),
    [assets]
  );

  const channels = useMemo(() => {
    const unique = new Set(
      approvedAssets
        .map((a) => a.platform?.toLowerCase())
        .filter(Boolean) as string[]
    );
    return [...unique].sort(sortChannels);
  }, [approvedAssets]);

  const [activeChannel, setActiveChannel] = useState<string>(() => channels[0] ?? "");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  // Keep active channel valid when channels list changes
  useEffect(() => {
    if (channels.length === 0) return;
    if (!channels.includes(activeChannel)) {
      setActiveChannel(channels[0]);
    }
  }, [channels, activeChannel]);

  // Filter assets for the active channel
  const channelAssets = useMemo(
    () =>
      approvedAssets.filter((a) => a.platform?.toLowerCase() === activeChannel),
    [approvedAssets, activeChannel]
  );

  // Auto-select first asset when channel changes or assets update
  useEffect(() => {
    if (channelAssets.length === 0) {
      setSelectedAssetId(null);
      return;
    }
    if (!selectedAssetId || !channelAssets.some((a) => a.id === selectedAssetId)) {
      setSelectedAssetId(channelAssets[0].id);
    }
  }, [channelAssets, selectedAssetId]);

  const selectedAsset =
    channelAssets.find((a) => a.id === selectedAssetId) ?? null;

  // Notify parent when selectedAsset changes
  useEffect(() => {
    onAssetSelect(selectedAsset);
  }, [selectedAsset, onAssetSelect]);

  if (channels.length === 0) {
    return (
      <div className="px-4 md:px-6 py-12 max-w-[1100px] mx-auto text-center text-sm text-[var(--muted-foreground)]">
        No approved creatives yet. Waiting for marketing to approve assets.
      </div>
    );
  }

  return (
    <div className="px-4 md:px-6 py-6 max-w-[1100px] mx-auto">
      {/* Channel sub-tabs */}
      <div className="flex gap-2 flex-wrap mb-5">
        {channels.map((ch) => {
          const label = CHANNEL_LABEL[ch] ?? ch;
          const count = approvedAssets.filter(
            (a) => a.platform?.toLowerCase() === ch
          ).length;
          const active = activeChannel === ch;
          return (
            <button
              key={ch}
              onClick={() => setActiveChannel(ch)}
              className={[
                "text-xs font-medium px-4 py-2 rounded-full border transition-colors cursor-pointer",
                active
                  ? "bg-[#32373C] text-white border-[#32373C]"
                  : "bg-white text-[var(--muted-foreground)] border-[var(--border)] hover:border-[#32373C]",
              ].join(" ")}
            >
              {label} · {count}
            </button>
          );
        })}
      </div>

      <CreativeGrid
        assets={channelAssets}
        selectedAssetId={selectedAssetId}
        onSelect={(a) => setSelectedAssetId(a.id)}
      />
    </div>
  );
}
