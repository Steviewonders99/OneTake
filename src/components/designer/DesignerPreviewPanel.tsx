"use client";

import { useEffect, useState, useCallback } from "react";
import { Download, ImageOff, AlertCircle, RefreshCw } from "lucide-react";
import type { IntakeRequest, CreativeBrief, GeneratedAsset } from "@/lib/types";
import CampaignContextCard from "@/components/designer/CampaignContextCard";
import DownloadKit from "@/components/designer/DownloadKit";
import { StatusBadge } from "@/components/StatusBadge";

interface DesignerPreviewPanelProps {
  requestId: string;
}

type TabFilter = "all" | "characters" | "composed";

// ─── Skeleton ────────────────────────────────────────────────────────────────

function SkeletonRect({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-[#F5F5F5] ${className ?? ""}`}
    />
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <SkeletonRect className="h-16 w-full" />
      <SkeletonRect className="h-40 w-full" />
      <SkeletonRect className="h-24 w-full" />
    </div>
  );
}

// ─── Empty (no requestId) ─────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[320px] gap-3 text-center">
      <ImageOff size={36} className="text-[#D4D4D4]" />
      <p className="text-sm font-medium text-[#737373]">Select a campaign</p>
      <p className="text-xs text-[#A3A3A3] max-w-[220px]">
        Choose a campaign from the list to preview its creative workspace.
      </p>
    </div>
  );
}

// ─── Error state ─────────────────────────────────────────────────────────────

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[320px] gap-3 text-center">
      <AlertCircle size={32} className="text-red-400" />
      <p className="text-sm font-medium text-[#1A1A1A]">Failed to load campaign</p>
      <p className="text-xs text-[#737373] max-w-[260px]">{message}</p>
      <button
        onClick={onRetry}
        className="flex items-center gap-1.5 text-xs font-medium text-[#1A1A1A] border border-[#E5E5E5] px-3 py-1.5 rounded-full hover:bg-[#F5F5F5] transition-colors cursor-pointer"
      >
        <RefreshCw size={12} />
        Retry
      </button>
    </div>
  );
}

// ─── Asset card ───────────────────────────────────────────────────────────────

function AssetCard({ asset }: { asset: GeneratedAsset }) {
  const headline =
    (asset.copy_data as Record<string, unknown> | null)?.headline as string | undefined;
  const hasImage = Boolean(asset.blob_url);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-white overflow-hidden group cursor-pointer hover:shadow-[0_4px_16px_rgba(0,0,0,0.10)] transition-shadow">
      {/* Image area */}
      <div className="relative aspect-square bg-[#F5F5F5] overflow-hidden">
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.blob_url!}
            alt={headline ?? `${asset.platform} ${asset.format}`}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full">
            <ImageOff size={24} className="text-[#D4D4D4]" />
          </div>
        )}

        {/* Platform badge overlay */}
        <span className="absolute top-2 right-2 text-[12px] font-semibold uppercase tracking-wide bg-black/60 text-white px-1.5 py-0.5 rounded-md leading-tight">
          {asset.platform}
        </span>

        {/* Download on hover */}
        {hasImage && (
          <a
            href={asset.blob_url!}
            download
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 hover:bg-white rounded-full p-1.5 cursor-pointer shadow-sm"
            title="Download"
          >
            <Download size={13} className="text-[#1A1A1A]" />
          </a>
        )}
      </div>

      {/* Info below image */}
      <div className="px-3 py-2.5 space-y-0.5">
        {headline && (
          <p className="text-xs font-medium text-[#1A1A1A] line-clamp-2 leading-snug">
            {headline}
          </p>
        )}
        <p className="text-[12px] text-[#737373] uppercase tracking-wide">
          {asset.format}
          {asset.language ? ` · ${asset.language}` : ""}
        </p>
      </div>
    </div>
  );
}

// ─── Tab pills ────────────────────────────────────────────────────────────────

function TabPills({
  active,
  onChange,
  counts,
}: {
  active: TabFilter;
  onChange: (t: TabFilter) => void;
  counts: Record<TabFilter, number>;
}) {
  const tabs: { key: TabFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "characters", label: "Characters" },
    { key: "composed", label: "Composed" },
  ];

  return (
    <div className="flex items-center gap-1.5">
      {tabs.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
            active === key
              ? "bg-[#32373C] text-white"
              : "bg-[#F5F5F5] text-[#737373] hover:bg-[#E5E5E5] hover:text-[#1A1A1A]"
          }`}
        >
          {label}
          <span
            className={`text-[12px] tabular-nums ${
              active === key ? "text-white/70" : "text-[#A3A3A3]"
            }`}
          >
            {counts[key]}
          </span>
        </button>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DesignerPreviewPanel({ requestId }: DesignerPreviewPanelProps) {
  const [request, setRequest] = useState<IntakeRequest | null>(null);
  const [brief, setBrief] = useState<CreativeBrief | null>(null);
  const [assets, setAssets] = useState<GeneratedAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabFilter>("all");

  const load = useCallback(async () => {
    if (!requestId) return;
    setLoading(true);
    setError(null);

    try {
      const [reqRes, briefRes, imgRes] = await Promise.all([
        fetch(`/api/intake/${requestId}`),
        fetch(`/api/generate/${requestId}/brief`),
        fetch(`/api/generate/${requestId}/images`),
      ]);

      if (!reqRes.ok) throw new Error(`Failed to load campaign (${reqRes.status})`);

      const reqData = await reqRes.json();
      setRequest(reqData as IntakeRequest);

      if (briefRes.ok) {
        const briefData = await briefRes.json();
        setBrief((briefData as { brief: CreativeBrief | null }).brief ?? null);
      } else {
        setBrief(null);
      }

      if (imgRes.ok) {
        const imgData = await imgRes.json();
        setAssets((imgData as { assets: GeneratedAsset[] }).assets ?? []);
      } else {
        setAssets([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    setRequest(null);
    setBrief(null);
    setAssets([]);
    setActiveTab("all");
    load();
  }, [load]);

  // ── Filter assets by tab
  const filteredAssets = assets.filter((a) => {
    if (activeTab === "characters") return a.asset_type === "base_image";
    if (activeTab === "composed")
      return a.asset_type === "composed_creative" || a.asset_type === "carousel_panel";
    return true;
  });

  const counts: Record<TabFilter, number> = {
    all: assets.length,
    characters: assets.filter((a) => a.asset_type === "base_image").length,
    composed: assets.filter(
      (a) => a.asset_type === "composed_creative" || a.asset_type === "carousel_panel"
    ).length,
  };

  const hasAssets = assets.length > 0;

  // ── No request selected
  if (!requestId) return <EmptyState />;

  // ── Loading
  if (loading) {
    return (
      <div className="overflow-y-auto px-6 md:px-8 py-6">
        <LoadingSkeleton />
      </div>
    );
  }

  // ── Error
  if (error) {
    return (
      <div className="overflow-y-auto px-6 md:px-8 py-6">
        <ErrorState message={error} onRetry={load} />
      </div>
    );
  }

  // ── No request found (404 / null)
  if (!request) {
    return (
      <div className="overflow-y-auto px-6 md:px-8 py-6">
        <EmptyState />
      </div>
    );
  }

  const formattedDate = new Date(request.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const taskTypeLabel = request.task_type
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return (
    <div className="overflow-y-auto px-6 md:px-8 py-6 space-y-6">
      {/* ── 1. Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-[#1A1A1A] leading-snug truncate">
            {request.title}
          </h1>
          <p className="text-xs text-[#737373] mt-0.5">
            {taskTypeLabel} &middot; {formattedDate}
          </p>
        </div>
        <StatusBadge status={request.status} />
      </div>

      {/* ── 2. Campaign Context Card */}
      <CampaignContextCard request={request} brief={brief} />

      {/* ── 3. Download Kit */}
      <DownloadKit requestId={requestId} token="" hasAssets={hasAssets} />

      {/* ── 4. Asset Grid */}
      <div className="space-y-3">
        {/* Section header */}
        <div className="flex items-center justify-between gap-4">
          <p className="text-[14px] font-bold uppercase tracking-[0.06em] text-[var(--muted-foreground)]">
            Creative Assets
          </p>
          <TabPills active={activeTab} onChange={setActiveTab} counts={counts} />
        </div>

        {filteredAssets.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredAssets.map((asset) => (
              <AssetCard key={asset.id} asset={asset} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 gap-2 border border-[#E5E5E5] rounded-xl bg-[#FAFAFA]">
            <ImageOff size={28} className="text-[#D4D4D4]" />
            <p className="text-sm text-[#737373]">
              {hasAssets
                ? "No assets in this category"
                : "No assets generated yet"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
