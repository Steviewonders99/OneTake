"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Eye } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import PipelineProgress from "@/components/PipelineProgress";
import type { IntakeRequest, PipelineRun } from "@/lib/types";

interface ProgressData {
  request: IntakeRequest;
  actors: unknown[];
  assets: unknown[];
  composed: unknown[];
  characters: unknown[];
  copy_assets: unknown[];
  job: { status: string } | null;
  sections: Record<string, string>;
}

interface CampaignPreviewPanelProps {
  requestId: string;
}

function StatPill({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex flex-col items-center px-5 py-3 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] min-w-[80px]">
      <span className="text-lg font-semibold text-[#1a1a1a] leading-none">{value}</span>
      <span className="text-[11px] text-[#737373] mt-1 whitespace-nowrap">{label}</span>
    </div>
  );
}

export default function CampaignPreviewPanel({ requestId }: CampaignPreviewPanelProps) {
  const [request, setRequest] = useState<IntakeRequest | null>(null);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [reqRes, progRes] = await Promise.all([
          fetch(`/api/intake/${requestId}`),
          fetch(`/api/intake/${requestId}/progress`),
        ]);

        if (!reqRes.ok) throw new Error("Failed to load campaign");
        const reqData: IntakeRequest = await reqRes.json();

        let progData: ProgressData | null = null;
        if (progRes.ok) {
          progData = await progRes.json();
        }

        if (!cancelled) {
          setRequest(reqData);
          setProgress(progData);
          // Extract pipeline_runs if available on the progress response
          if (progData && (progData as unknown as { pipeline_runs?: PipelineRun[] }).pipeline_runs) {
            setRuns((progData as unknown as { pipeline_runs: PipelineRun[] }).pipeline_runs);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Something went wrong");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [requestId]);

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <div className="skeleton h-7 w-2/3 rounded-lg" />
        <div className="skeleton h-5 w-24 rounded-full" />
        <div className="skeleton h-12 w-full rounded-xl" />
        <div className="flex gap-3">
          <div className="skeleton h-16 w-20 rounded-xl" />
          <div className="skeleton h-16 w-20 rounded-xl" />
          <div className="skeleton h-16 w-20 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="flex items-center justify-center h-full text-[#737373] text-sm">
        {error ?? "Campaign not found"}
      </div>
    );
  }

  const totalCreatives = progress
    ? (progress.composed?.length ?? 0) + (progress.characters?.length ?? 0)
    : 0;
  const actorCount = progress?.actors?.length ?? 0;
  const assetCount = progress?.assets?.length ?? 0;

  return (
    <div className="p-8 max-w-2xl">
      {/* Title + status */}
      <div className="flex items-start gap-3 mb-1">
        <h2 className="text-xl font-semibold text-[#1a1a1a] leading-snug flex-1 min-w-0">
          {request.title}
        </h2>
        <StatusBadge status={request.status} />
      </div>
      <p className="text-sm text-[#737373] mb-6">
        {request.task_type
          .split("_")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ")}
        {request.target_regions.length > 0 && (
          <span> &middot; {request.target_regions.slice(0, 3).join(", ")}
            {request.target_regions.length > 3 && ` +${request.target_regions.length - 3}`}
          </span>
        )}
      </p>

      {/* Pipeline progress */}
      <div className="card p-5 mb-6">
        <p className="text-xs font-semibold text-[#737373] uppercase tracking-wide mb-4">
          Pipeline Progress
        </p>
        <PipelineProgress runs={runs} />
      </div>

      {/* Quick stats */}
      <div className="flex flex-wrap gap-3 mb-8">
        <StatPill label="Creatives" value={totalCreatives} />
        <StatPill label="Actors" value={actorCount} />
        <StatPill label="Assets" value={assetCount} />
        {request.target_languages.length > 0 && (
          <StatPill label="Languages" value={request.target_languages.length} />
        )}
        {request.volume_needed != null && (
          <StatPill label="Volume" value={request.volume_needed.toLocaleString()} />
        )}
      </div>

      {/* CTA */}
      <div className="flex items-center gap-3">
        <Link
          href={`/intake/${request.id}`}
          className="btn-primary cursor-pointer"
        >
          <Eye size={15} />
          View Full Details
          <ArrowRight size={15} />
        </Link>
      </div>
    </div>
  );
}
