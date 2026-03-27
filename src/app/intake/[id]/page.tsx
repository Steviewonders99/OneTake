"use client";

import { use, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Target,
  Megaphone,
  UserCircle,
  BarChart3,
  Loader2,
  RefreshCw,
  PanelRightOpen,
  Play,
  Copy,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import { StatusBadge, UrgencyBadge } from "@/components/StatusBadge";
import PipelineProgress from "@/components/PipelineProgress";
import ChannelCard from "@/components/ChannelCard";
import ActorCard from "@/components/ActorCard";
import EvaluationScores from "@/components/EvaluationScores";
import OutputsPanel from "@/components/OutputsPanel";
import type {
  IntakeRequest,
  PipelineRun,
  CreativeBrief,
  ActorProfile,
  GeneratedAsset,
} from "@/lib/types";

interface DetailData {
  request: IntakeRequest;
  brief: CreativeBrief | null;
  actors: ActorProfile[];
  assets: GeneratedAsset[];
  pipelineRuns: PipelineRun[];
}

function SkeletonSection() {
  return (
    <div className="card p-6 space-y-3">
      <div className="skeleton h-4 w-40" />
      <div className="skeleton h-3 w-full" />
      <div className="skeleton h-3 w-3/4" />
      <div className="skeleton h-3 w-2/3" />
    </div>
  );
}

export default function IntakeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [outputsOpen, setOutputsOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [changesNote, setChangesNote] = useState("");
  const [showChangesModal, setShowChangesModal] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch request details
      const reqRes = await fetch(`/api/intake/${id}`);
      if (!reqRes.ok) throw new Error("Request not found");
      const request = await reqRes.json();

      // Fetch pipeline status
      let pipelineRuns: PipelineRun[] = [];
      try {
        const pipeRes = await fetch(`/api/generate/${id}`);
        if (pipeRes.ok) {
          const pipeData = await pipeRes.json();
          pipelineRuns = pipeData.pipeline_runs || [];
        }
      } catch {
        // Pipeline data may not exist yet
      }

      // For now, brief/actors/assets come from the pipeline data or are empty
      // In production, there would be separate API endpoints
      setData({
        request,
        brief: null,
        actors: [],
        assets: [],
        pipelineRuns,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load request");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh when generating
  useEffect(() => {
    if (data?.request.status !== "generating") return;
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [data?.request.status, loadData]);

  async function handleStartPipeline() {
    setActionLoading("pipeline");
    try {
      const res = await fetch(`/api/generate/${id}`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to start pipeline");
      }
      toast.success("Pipeline started! Generation in progress...");
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start pipeline");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleApprove() {
    setActionLoading("approve");
    try {
      const res = await fetch(`/api/approve/${id}`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to approve");
      const result = await res.json();
      toast.success("Request approved! Designer link generated.");
      if (result.magic_link_url) {
        await navigator.clipboard.writeText(window.location.origin + result.magic_link_url);
        toast.success("Designer link copied to clipboard");
      }
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRequestChanges() {
    if (!changesNote.trim()) {
      toast.error("Please provide notes about what to change");
      return;
    }
    setActionLoading("changes");
    try {
      const res = await fetch(`/api/approve/${id}/changes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: changesNote }),
      });
      if (!res.ok) throw new Error("Failed to request changes");
      toast.success("Changes requested");
      setShowChangesModal(false);
      setChangesNote("");
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to request changes");
    } finally {
      setActionLoading(null);
    }
  }

  // Loading state
  if (loading && !data) {
    return (
      <AppShell>
        <div className="px-6 lg:px-8 py-6 max-w-[1200px] mx-auto space-y-6">
          <div className="skeleton h-8 w-64 mb-4" />
          <SkeletonSection />
          <SkeletonSection />
          <SkeletonSection />
        </div>
      </AppShell>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <AlertCircle size={32} className="text-[var(--muted-foreground)] mb-3" />
          <p className="text-sm text-[var(--muted-foreground)] mb-4">
            {error || "Request not found"}
          </p>
          <div className="flex gap-3">
            <button onClick={loadData} className="btn-secondary cursor-pointer">
              <RefreshCw size={14} />
              Retry
            </button>
            <Link href="/" className="btn-primary cursor-pointer">
              Back to Pipeline
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const { request, brief, actors, assets, pipelineRuns } = data;
  const hasOutputs = assets.length > 0;

  // Parse brief data if present
  const briefData = brief?.brief_data as Record<string, unknown> | undefined;
  const channelResearch = brief?.channel_research as Record<string, unknown> | undefined;
  const evaluationData = brief?.evaluation_data as Record<string, number> | undefined;

  // Extract brief sections
  const summary = briefData?.summary as string | undefined;
  const messagingStrategy = briefData?.messaging_strategy as string[] | undefined;
  const targetAudience = briefData?.target_audience as string[] | undefined;
  const valueProps = briefData?.value_props as string[] | undefined;

  // Extract channel data
  const channels = channelResearch?.channels as Array<{
    name: string;
    effectiveness: number;
    rationale: string;
    sources?: string[];
    formats?: string[];
  }> | undefined;

  return (
    <AppShell>
      <div className="flex h-full">
        {/* Main content */}
        <div className="flex-1 overflow-y-auto">
          {/* Status banner */}
          <div className="gradient-accent h-1" />
          <div className="bg-white border-b border-[var(--border)] px-6 lg:px-8 py-4">
            <div className="max-w-[1200px] mx-auto flex items-center justify-between">
              <div className="flex items-center gap-4 min-w-0">
                <Link
                  href="/"
                  className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer transition-colors shrink-0"
                >
                  <ArrowLeft size={18} />
                </Link>
                <div className="min-w-0">
                  <h1 className="text-lg font-semibold text-[var(--foreground)] truncate">
                    {request.title}
                  </h1>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    {request.task_type.replace(/_/g, " ")} &middot; Created{" "}
                    {new Date(request.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <StatusBadge status={request.status} />
                <UrgencyBadge urgency={request.urgency} />
                {hasOutputs && (
                  <button
                    onClick={() => setOutputsOpen(true)}
                    className="btn-secondary text-xs px-3 py-1.5 cursor-pointer"
                  >
                    <PanelRightOpen size={14} />
                    Outputs
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="px-6 lg:px-8 py-6 max-w-[1200px] mx-auto space-y-6">
            {/* Pipeline Progress */}
            {(request.status === "generating" || pipelineRuns.length > 0) && (
              <section className="card p-6">
                <h2 className="text-sm font-semibold text-[var(--foreground)] mb-4">
                  Pipeline Progress
                </h2>
                <PipelineProgress runs={pipelineRuns} />
              </section>
            )}

            {/* Start Pipeline CTA for drafts */}
            {request.status === "draft" && (
              <section className="card p-6 text-center">
                <Play size={28} className="mx-auto text-[var(--muted-foreground)] mb-3" />
                <h2 className="text-base font-semibold text-[var(--foreground)] mb-2">
                  Ready to Generate
                </h2>
                <p className="text-sm text-[var(--muted-foreground)] mb-4 max-w-md mx-auto">
                  This request is in draft status. Start the AI pipeline to generate creative briefs, channel research, and ad creatives.
                </p>
                <button
                  onClick={handleStartPipeline}
                  disabled={actionLoading === "pipeline"}
                  className="btn-primary cursor-pointer"
                >
                  {actionLoading === "pipeline" ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Starting Pipeline...
                    </>
                  ) : (
                    <>
                      <Play size={16} />
                      Start Generation Pipeline
                    </>
                  )}
                </button>
              </section>
            )}

            {/* Creative Brief */}
            {(summary || messagingStrategy) && (
              <section id="brief-section" className="card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <MessageSquare size={16} className="text-[var(--muted-foreground)]" />
                  <h2 className="text-sm font-semibold text-[var(--foreground)]">
                    Creative Brief
                  </h2>
                </div>
                {summary && (
                  <p className="text-sm text-[var(--foreground)] leading-relaxed mb-4">
                    {summary}
                  </p>
                )}
                {messagingStrategy && messagingStrategy.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">
                      Messaging Strategy
                    </h3>
                    <ul className="space-y-2">
                      {messagingStrategy.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-[var(--foreground)]">
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[var(--ring)] shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {valueProps && valueProps.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">
                      Value Propositions
                    </h3>
                    <ul className="space-y-2">
                      {valueProps.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-[var(--foreground)]">
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[var(--oneforma-gradient-end)] shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}

            {/* Target Audience */}
            {targetAudience && targetAudience.length > 0 && (
              <section className="card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Target size={16} className="text-[var(--muted-foreground)]" />
                  <h2 className="text-sm font-semibold text-[var(--foreground)]">
                    Target Audience
                  </h2>
                </div>
                <ul className="space-y-2">
                  {targetAudience.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[var(--foreground)]">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[var(--ring)] shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Channel Strategy */}
            {channels && channels.length > 0 && (
              <section className="card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Megaphone size={16} className="text-[var(--muted-foreground)]" />
                  <h2 className="text-sm font-semibold text-[var(--foreground)]">
                    Channel Strategy
                  </h2>
                </div>
                <div className="space-y-3">
                  {channels.map((ch) => (
                    <ChannelCard
                      key={ch.name}
                      name={ch.name}
                      effectiveness={ch.effectiveness}
                      rationale={ch.rationale}
                      sources={ch.sources}
                      formats={ch.formats}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Actor Profiles */}
            {actors.length > 0 && (
              <section className="card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <UserCircle size={16} className="text-[var(--muted-foreground)]" />
                  <h2 className="text-sm font-semibold text-[var(--foreground)]">
                    Actor Profiles
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {actors.map((actor) => (
                    <ActorCard key={actor.id} actor={actor} />
                  ))}
                </div>
              </section>
            )}

            {/* Evaluation Scores */}
            {evaluationData && Object.keys(evaluationData).length > 0 && (
              <section className="card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 size={16} className="text-[var(--muted-foreground)]" />
                  <h2 className="text-sm font-semibold text-[var(--foreground)]">
                    Evaluation Scores
                  </h2>
                </div>
                <EvaluationScores scores={evaluationData} />
              </section>
            )}

            {/* Form Data Summary */}
            {request.form_data && Object.keys(request.form_data).length > 0 && (
              <section className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-[var(--foreground)]">
                    Request Details
                  </h2>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(request.form_data, null, 2));
                      toast.success("Copied to clipboard");
                    }}
                    className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer transition-colors flex items-center gap-1"
                  >
                    <Copy size={12} />
                    Copy JSON
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.entries(request.form_data).map(([key, value]) => (
                    <div key={key} className="text-sm">
                      <span className="font-medium text-[var(--muted-foreground)] capitalize block text-xs mb-0.5">
                        {key.replace(/_/g, " ")}
                      </span>
                      <span className="text-[var(--foreground)]">
                        {Array.isArray(value)
                          ? value.join(", ")
                          : typeof value === "object" && value !== null
                            ? JSON.stringify(value)
                            : String(value ?? "—")}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Action bar */}
            {(request.status === "review" || request.status === "generating") && (
              <div className="card p-4 flex items-center justify-between sticky bottom-4">
                <div className="flex items-center gap-3 text-sm text-[var(--muted-foreground)]">
                  <BarChart3 size={16} />
                  <span>
                    Status: <span className="font-semibold text-[var(--foreground)] capitalize">{request.status}</span>
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowChangesModal(true)}
                    disabled={!!actionLoading}
                    className="btn-warning cursor-pointer"
                  >
                    <MessageSquare size={14} />
                    Request Changes
                  </button>
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={!!actionLoading}
                    className="btn-success cursor-pointer"
                  >
                    {actionLoading === "approve" ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={14} />
                    )}
                    Approve
                  </button>
                </div>
              </div>
            )}

            {/* Approved action bar */}
            {request.status === "approved" && (
              <div className="card p-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-green-700">
                  <CheckCircle2 size={16} />
                  <span className="font-medium">This request has been approved</span>
                </div>
                <Link
                  href={`/api/export/${id}`}
                  target="_blank"
                  className="btn-primary text-xs px-4 py-2 cursor-pointer"
                >
                  Download ZIP
                </Link>
              </div>
            )}

            {/* Rejected */}
            {request.status === "rejected" && (
              <div className="card p-4 flex items-center gap-2 text-sm text-red-700">
                <XCircle size={16} />
                <span className="font-medium">This request was rejected</span>
              </div>
            )}
          </div>
        </div>

        {/* Outputs panel */}
        <OutputsPanel
          open={outputsOpen}
          onClose={() => setOutputsOpen(false)}
          assets={assets}
          requestId={id}
          evaluationData={evaluationData}
          hasBrief={!!brief}
        />

        {/* Changes Modal */}
        {showChangesModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-[var(--radius-lg)] p-6 w-full max-w-md mx-4 shadow-xl">
              <h3 className="text-base font-semibold text-[var(--foreground)] mb-3">
                Request Changes
              </h3>
              <p className="text-sm text-[var(--muted-foreground)] mb-4">
                Describe what needs to be changed or improved.
              </p>
              <textarea
                value={changesNote}
                onChange={(e) => setChangesNote(e.target.value)}
                placeholder="What changes are needed..."
                rows={4}
                className="input-base resize-none mb-4"
                autoFocus
              />
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowChangesModal(false)}
                  className="btn-secondary cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRequestChanges}
                  disabled={actionLoading === "changes"}
                  className="btn-warning cursor-pointer"
                >
                  {actionLoading === "changes" ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <MessageSquare size={14} />
                  )}
                  Submit Changes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
