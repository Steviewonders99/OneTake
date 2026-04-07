"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Globe,
  Users,
  Layers,
  Target,
  Loader2,
  AlertCircle,
  MessageSquare,
  Check,
} from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import LandingPagesCard from "@/components/LandingPagesCard";
import CampaignSlugField from "@/components/CampaignSlugField";
import type { IntakeRequest } from "@/lib/types";

interface ProgressData {
  request: IntakeRequest;
  actors: Record<string, any>[];
  assets: Record<string, any>[];
  composed: Record<string, any>[];
  characters: Record<string, any>[];
  copy_assets: Record<string, any>[];
  brief?: Record<string, any>;
  job: { status: string } | null;
  sections: Record<string, string>;
}

interface CampaignPreviewPanelProps {
  requestId: string;
  canEdit?: boolean;
}

export default function CampaignPreviewPanel({ requestId, canEdit = false }: CampaignPreviewPanelProps) {
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

  const composedAssets: Record<string, any>[] = (progress?.composed || []) as Record<string, any>[];
  const characters: Record<string, any>[] = (progress?.characters || []) as Record<string, any>[];
  const actors: Record<string, any>[] = (progress?.actors || []) as Record<string, any>[];
  const hasBrief = !!progress?.brief;
  const isGenerating = request.status === "generating";

  const formData = (request.form_data || {}) as Record<string, any>;
  const regions = (request.target_regions || []) as string[];
  const languages = (request.target_languages || []) as string[];

  const briefData = progress?.brief || {};
  const messaging = briefData.messaging_strategy || {};
  const channels = briefData.channels || {};
  const personas = briefData.personas || [];
  const goalText = String(formData.goal || formData.description || "");

  // Pipeline stage statuses for segmented bar
  const stageList = [
    { key: "brief", label: "Brief", status: hasBrief ? "passed" : isGenerating ? "running" : "pending" },
    { key: "actors", label: "Actors", status: actors.length > 0 ? "passed" : hasBrief ? (isGenerating ? "running" : "pending") : "pending" },
    { key: "images", label: "Images", status: characters.length > 0 ? "passed" : actors.length > 0 ? (isGenerating ? "running" : "pending") : "pending" },
    { key: "creatives", label: "Creatives", status: composedAssets.length > 0 ? "passed" : characters.length > 0 ? (isGenerating ? "running" : "pending") : "pending" },
  ] as const;

  return (
    <div className="h-full overflow-y-auto">
      {/* Sticky campaign strip */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-[var(--border)]">
        <div className="px-6 pt-5 pb-4">
          {/* Row 1: Title */}
          <div className="flex items-start justify-between gap-4 mb-1">
            <h2 className="text-lg font-semibold text-[var(--foreground)] tracking-tight line-clamp-2 flex-1 min-w-0">
              {request.title}
            </h2>
            <div className="flex items-center gap-2 flex-shrink-0">
              <StatusBadge status={request.status} />
              <Link
                href={`/intake/${request.id}`}
                className="w-8 h-8 rounded-full bg-[var(--foreground)] text-white flex items-center justify-center hover:bg-[#32373c] transition-colors cursor-pointer"
                title="View full details"
              >
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>

          {/* Row 2: Meta */}
          <p className="text-[12px] text-[var(--muted-foreground)]">
            {String(request.task_type || "").replace(/_/g, " ")}
            {regions.length > 0 && (
              <span>
                {" "}&middot;{" "}
                {regions.slice(0, 3).join(", ")}
                {regions.length > 3 && ` +${regions.length - 3}`}
              </span>
            )}
          </p>

          {/* Row 2b: Campaign tracking slug (admin inline editor) */}
          <div className="mt-1">
            <CampaignSlugField
              requestId={request.id}
              initialValue={request.campaign_slug ?? null}
              canEdit={canEdit}
            />
          </div>

          {/* Row 3: Goal one-liner */}
          {goalText && (
            <p className="text-[12px] text-[var(--muted-foreground)] mt-1 line-clamp-1">
              {goalText}
            </p>
          )}
        </div>

        {/* Segmented progress bar */}
        <div className="px-6 pb-4">
          <div className="flex gap-1.5">
            {stageList.map((stage) => (
              <div key={stage.key} className="flex-1 min-w-0">
                <div
                  className={[
                    "h-1.5 rounded-full transition-all duration-500",
                    stage.status === "passed" ? "bg-[#22c55e]" : "",
                    stage.status === "running" ? "bg-[#2563eb] animate-pulse" : "",
                    stage.status === "pending" ? "bg-[#e5e5e5]" : "",
                  ].join(" ")}
                />
                <div className="flex items-center gap-1 mt-1.5">
                  {stage.status === "passed" && <Check size={10} className="text-[#22c55e] flex-shrink-0" />}
                  {stage.status === "running" && <Loader2 size={10} className="text-[#2563eb] animate-spin flex-shrink-0" />}
                  <span
                    className={[
                      "text-[11px] font-medium truncate",
                      stage.status === "passed" ? "text-[var(--foreground)]" : "",
                      stage.status === "running" ? "text-[#2563eb]" : "",
                      stage.status === "pending" ? "text-[#d4d4d8]" : "",
                    ].join(" ")}
                  >
                    {stage.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="p-6 space-y-5">

        {/* Compact stats row */}
        <div className="flex gap-4 flex-wrap">
          {[
            { label: "Creatives", value: composedAssets.length, Icon: Layers, color: "#6B21A8" },
            { label: "Characters", value: characters.length, Icon: Users, color: "#E91E8C" },
            { label: "Actors", value: actors.length, Icon: Target, color: "#0693E3" },
            { label: "Languages", value: languages.length, Icon: Globe, color: "#22c55e" },
          ].filter(s => s.value > 0 || s.label === "Languages").map((s) => (
            <div key={s.label} className="flex items-center gap-2">
              <s.Icon size={13} style={{ color: s.color }} />
              <span className="text-sm font-semibold text-[var(--foreground)]">{s.value}</span>
              <span className="text-[11px] text-[var(--muted-foreground)]">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Intel strip — messaging + channels summary */}
        {hasBrief && (messaging.primary_message || channels.primary?.length > 0) && (
          <div className="bg-[#F5F5F5] rounded-xl p-4 space-y-2.5">
            {messaging.primary_message && (
              <div className="flex gap-2.5">
                <MessageSquare size={14} className="text-[#737373] flex-shrink-0 mt-0.5" />
                <p className="text-[13px] text-[var(--foreground)] leading-relaxed line-clamp-2">
                  {messaging.primary_message}
                </p>
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <div className="flex gap-1.5 flex-wrap min-w-0">
                {(channels.primary || []).slice(0, 3).map((ch: string) => {
                  const cleaned = ch.replace(/\s*\(.*$/, "").trim();
                  return (
                    <span
                      key={ch}
                      className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#0693E3]/8 text-[#0693E3] border border-[#0693E3]/12"
                    >
                      {cleaned}
                    </span>
                  );
                })}
                {(channels.primary || []).length > 3 && (
                  <span className="text-[10px] text-[#737373]">
                    +{channels.primary.length - 3}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-[11px] text-[#737373] flex-shrink-0">
                {personas.length > 0 && (
                  <span>{personas.length} persona{personas.length !== 1 ? "s" : ""}</span>
                )}
                {languages.length > 0 && (
                  <span>{languages.length} lang{languages.length !== 1 ? "s" : ""}</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Landing Pages — shared between marketing + designer views */}
        <LandingPagesCard requestId={request.id} canEdit={canEdit} />

        {/* Live creative thumbnails */}
        {composedAssets.length > 0 && (
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-2">
              Latest Creatives
            </span>
            <div className="grid grid-cols-3 gap-2">
              {composedAssets.slice(0, 6).map((asset: Record<string, any>, i: number) => (
                <div
                  key={asset.id || i}
                  className="rounded-lg overflow-hidden border border-[var(--border)] bg-[#F5F5F5] relative hover:scale-[1.02] hover:shadow-md transition-all duration-150"
                  style={{ aspectRatio: "4/3" }}
                >
                  {asset.blob_url ? (
                    <img
                      src={asset.blob_url}
                      alt={asset.content?.overlay_headline || "Creative"}
                      className="absolute inset-0 w-full h-full object-contain"
                      loading="lazy"
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
              {characters.slice(0, 8).map((asset: Record<string, any>, i: number) => (
                <div
                  key={asset.id || i}
                  className="rounded-lg overflow-hidden border border-[var(--border)] bg-[#F5F5F5] relative hover:scale-[1.02] hover:shadow-md transition-all duration-150"
                  style={{ aspectRatio: "4/3" }}
                >
                  {asset.blob_url ? (
                    <img
                      src={asset.blob_url}
                      alt="Character"
                      className="absolute inset-0 w-full h-full object-contain"
                      loading="lazy"
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
                Assets will appear here as they&apos;re generated. Auto-refreshing every 5s.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
