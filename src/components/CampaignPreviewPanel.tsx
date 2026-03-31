"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Eye,
  Globe,
  Users,
  Image as ImageIcon,
  Layers,
  Target,
  Clock,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Bell,
} from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import PipelineNav from "@/components/PipelineNav";
import type { PipelineStage } from "@/components/PipelineNav";
import ImageLoader from "@/components/ui/image-loading";
import type { IntakeRequest, PipelineRun, GeneratedAsset } from "@/lib/types";

interface ProgressData {
  request: IntakeRequest;
  actors: any[];
  assets: any[];
  composed: any[];
  characters: any[];
  copy_assets: any[];
  brief?: any;
  job: { status: string } | null;
  sections: Record<string, string>;
}

interface CampaignPreviewPanelProps {
  requestId: string;
}

export default function CampaignPreviewPanel({ requestId }: CampaignPreviewPanelProps) {
  const [request, setRequest] = useState<IntakeRequest | null>(null);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval>;

    async function load() {
      try {
        const [reqRes, progRes] = await Promise.all([
          fetch(`/api/intake/${requestId}`),
          fetch(`/api/intake/${requestId}/progress`),
        ]);

        if (!reqRes.ok) throw new Error("Failed to load campaign");
        const reqData: IntakeRequest = await reqRes.json();
        let progData: ProgressData | null = null;
        if (progRes.ok) progData = await progRes.json();

        if (!cancelled) {
          setRequest(reqData);
          setProgress(progData);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Something went wrong");
          setLoading(false);
        }
      }
    }

    load();
    // Poll every 5s for generating campaigns
    interval = setInterval(load, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [requestId]);

  if (loading) {
    return (
      <div className="p-6 space-y-4 animate-pulse">
        <div className="skeleton h-6 w-2/3 rounded" />
        <div className="skeleton h-4 w-1/3 rounded" />
        <div className="skeleton h-24 w-full rounded-xl" />
        <div className="grid grid-cols-4 gap-3">
          <div className="skeleton h-16 rounded-xl" />
          <div className="skeleton h-16 rounded-xl" />
          <div className="skeleton h-16 rounded-xl" />
          <div className="skeleton h-16 rounded-xl" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="skeleton h-32 rounded-xl" />
          <div className="skeleton h-32 rounded-xl" />
          <div className="skeleton h-32 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="flex items-center justify-center h-full text-[#737373] text-sm p-8">
        <AlertCircle size={16} className="mr-2" />
        {error ?? "Campaign not found"}
      </div>
    );
  }

  const composedAssets = (progress?.composed || []) as any[];
  const characters = (progress?.characters || []) as any[];
  const actors = progress?.actors || [];
  const allAssets = (progress?.assets || []) as any[];
  const hasBrief = !!progress?.brief;
  const isGenerating = request.status === "generating";

  // Build pipeline stages from actual data
  const stages: PipelineStage[] = [
    { key: "brief", label: "Brief", status: hasBrief ? "passed" : isGenerating ? "running" : "pending" },
    { key: "actors", label: "Actors", status: actors.length > 0 ? "passed" : hasBrief ? (isGenerating ? "running" : "pending") : "pending" },
    { key: "images", label: "Images", status: characters.length > 0 ? "passed" : actors.length > 0 ? (isGenerating ? "running" : "pending") : "pending" },
    { key: "creatives", label: "Creatives", status: composedAssets.length > 0 ? "passed" : characters.length > 0 ? (isGenerating ? "running" : "pending") : "pending" },
  ];

  const formData = request.form_data || {};
  const regions = request.target_regions || [];
  const languages = request.target_languages || [];

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-[var(--border)]">
        <div className="flex items-start justify-between gap-4 mb-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-[var(--foreground)] tracking-tight truncate">
              {request.title}
            </h2>
            <p className="text-[12px] text-[var(--muted-foreground)] mt-0.5">
              {String(request.task_type || "").replace(/_/g, " ")}
              {regions.length > 0 && (
                <span>
                  {" "}&middot;{" "}
                  {regions.slice(0, 3).join(", ")}
                  {regions.length > 3 && ` +${regions.length - 3}`}
                </span>
              )}
            </p>
          </div>
          <StatusBadge status={request.status} />
        </div>

        {/* Compact pipeline nav */}
        <div className="mt-3">
          <PipelineNav stages={stages} />
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-px bg-[var(--border)]">
        <div className="bg-white px-4 py-3 text-center">
          <div className="text-xl font-bold text-[var(--foreground)] tracking-tight">{composedAssets.length}</div>
          <div className="text-[10px] text-[var(--muted-foreground)] mt-0.5 flex items-center justify-center gap-1">
            <Layers size={10} className="text-[#6B21A8]" />Creatives
          </div>
        </div>
        <div className="bg-white px-4 py-3 text-center">
          <div className="text-xl font-bold text-[var(--foreground)] tracking-tight">{characters.length}</div>
          <div className="text-[10px] text-[var(--muted-foreground)] mt-0.5 flex items-center justify-center gap-1">
            <Users size={10} className="text-[#E91E8C]" />Characters
          </div>
        </div>
        <div className="bg-white px-4 py-3 text-center">
          <div className="text-xl font-bold text-[var(--foreground)] tracking-tight">{actors.length}</div>
          <div className="text-[10px] text-[var(--muted-foreground)] mt-0.5 flex items-center justify-center gap-1">
            <Target size={10} className="text-[#0693E3]" />Actors
          </div>
        </div>
        <div className="bg-white px-4 py-3 text-center">
          <div className="text-xl font-bold text-[var(--foreground)] tracking-tight">{languages.length}</div>
          <div className="text-[10px] text-[var(--muted-foreground)] mt-0.5 flex items-center justify-center gap-1">
            <Globe size={10} className="text-[#22c55e]" />Languages
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="p-6 space-y-5">

        {/* Quick info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-1">
              Regions
            </span>
            <div className="flex flex-wrap gap-1">
              {regions.map((r: string, i: number) => (
                <span key={i} className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#0693E3]/5 text-[#0693E3] border border-[#0693E3]/10">
                  {r}
                </span>
              ))}
            </div>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-1">
              Languages
            </span>
            <div className="flex flex-wrap gap-1">
              {languages.map((l: string, i: number) => (
                <span key={i} className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#9B51E0]/5 text-[#9B51E0] border border-[#9B51E0]/10">
                  {l}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Live creative thumbnails */}
        {composedAssets.length > 0 && (
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-2">
              Latest Creatives
            </span>
            <div className="grid grid-cols-3 gap-2">
              {composedAssets.slice(0, 6).map((asset: any, i: number) => (
                <div
                  key={asset.id || i}
                  className="rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--muted)]"
                  style={{ aspectRatio: "1" }}
                >
                  {asset.blob_url ? (
                    <ImageLoader
                      src={asset.blob_url}
                      alt={asset.content?.overlay_headline || "Creative"}
                      width={200}
                      height={200}
                      gridSize={8}
                      cellGap={1}
                      loadingDelay={300}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Loader2 size={16} className="text-[var(--muted-foreground)] animate-spin" />
                    </div>
                  )}
                </div>
              ))}
            </div>
            {composedAssets.length > 6 && (
              <p className="text-[11px] text-[var(--muted-foreground)] mt-1.5 text-center">
                +{composedAssets.length - 6} more creatives
              </p>
            )}
          </div>
        )}

        {/* Character thumbnails */}
        {characters.length > 0 && composedAssets.length === 0 && (
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-2">
              Generated Characters
            </span>
            <div className="grid grid-cols-4 gap-2">
              {characters.slice(0, 8).map((asset: any, i: number) => (
                <div
                  key={asset.id || i}
                  className="rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--muted)]"
                  style={{ aspectRatio: "1" }}
                >
                  {asset.blob_url ? (
                    <ImageLoader
                      src={asset.blob_url}
                      alt="Character"
                      width={120}
                      height={120}
                      gridSize={6}
                      cellGap={1}
                      loadingDelay={200}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Loader2 size={14} className="text-[var(--muted-foreground)] animate-spin" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Generating state — show what's happening */}
        {isGenerating && composedAssets.length === 0 && characters.length === 0 && (
          <div className="bg-[#0693E3]/5 border border-[#0693E3]/10 rounded-xl px-4 py-3 flex items-center gap-3">
            <Loader2 size={16} className="text-[#0693E3] animate-spin flex-shrink-0" />
            <div>
              <p className="text-[13px] font-medium text-[var(--foreground)]">
                Pipeline is running...
              </p>
              <p className="text-[11px] text-[var(--muted-foreground)]">
                Assets will appear here as they're generated. Auto-refreshing every 5s.
              </p>
            </div>
          </div>
        )}

        {/* Goal snippet */}
        {(formData.goal || formData.description) && (
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-1">
              Goal
            </span>
            <p className="text-[13px] text-[var(--foreground)] leading-relaxed line-clamp-3">
              {String(formData.goal || formData.description)}
            </p>
          </div>
        )}

        {/* CTA */}
        <Link
          href={`/intake/${request.id}`}
          className="btn-primary cursor-pointer inline-flex items-center gap-2 text-sm"
        >
          <Eye size={14} />
          View Full Details
          <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
