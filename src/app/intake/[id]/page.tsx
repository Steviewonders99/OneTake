"use client";

import { use, useState, useEffect, useCallback, useRef } from "react";
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
import AssetCategoryTabs from "@/components/AssetCategoryTabs";
import AssetCard from "@/components/AssetCard";
import BulkActions from "@/components/BulkActions";
import RefineModal from "@/components/RefineModal";
import DesignElementPreview from "@/components/DesignElementPreview";
import MockupPreview from "@/components/MockupPreview";
import RecruiterDetailView from "@/components/RecruiterDetailView";
import PipelineNav from "@/components/PipelineNav";
import type { PipelineStage } from "@/components/PipelineNav";
import LiveSection from "@/components/LiveSection";
import RequestDetailsFormatted from "@/components/RequestDetailsFormatted";
import EditableField from "@/components/EditableField";
import type {
  IntakeRequest,
  PipelineRun,
  CreativeBrief,
  ActorProfile,
  GeneratedAsset,
  ComputeJob,
  UserRole,
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
  const [role, setRole] = useState<UserRole | null>(null);
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [outputsOpen, setOutputsOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [changesNote, setChangesNote] = useState("");
  const [showChangesModal, setShowChangesModal] = useState(false);
  const [computeJob, setComputeJob] = useState<ComputeJob | null>(null);
  const [activeAssetTab, setActiveAssetTab] = useState<'characters' | 'elements' | 'composed' | 'mockups'>('characters');
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [refineAsset, setRefineAsset] = useState<GeneratedAsset | null>(null);
  const briefSectionRef = useRef<HTMLElement>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch current user role (once — safe to re-fetch on reload)
      try {
        const meRes = await fetch("/api/auth/me");
        if (meRes.ok) {
          const me = await meRes.json();
          setRole(me.role ?? null);
        }
      } catch {
        // Role defaults to null → full view renders as fallback
      }

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

      // Fetch brief, actors, and assets from their respective endpoints
      let brief = null;
      let actors: ActorProfile[] = [];
      let assets: GeneratedAsset[] = [];

      try {
        const briefRes = await fetch(`/api/generate/${id}/brief`);
        if (briefRes.ok) {
          const briefData = await briefRes.json();
          brief = briefData.brief || null;
        }
      } catch {
        // Brief may not exist yet
      }

      try {
        const actorsRes = await fetch(`/api/generate/${id}/actors`);
        if (actorsRes.ok) {
          const actorsData = await actorsRes.json();
          actors = actorsData.actors || [];
        }
      } catch {
        // Actors may not exist yet
      }

      try {
        const assetsRes = await fetch(`/api/generate/${id}/images`);
        if (assetsRes.ok) {
          const assetsData = await assetsRes.json();
          assets = assetsData.assets || [];
        }
      } catch {
        // Assets may not exist yet
      }

      setData({
        request,
        brief,
        actors,
        assets,
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

  // Poll compute job status when generating
  useEffect(() => {
    if (data?.request?.status !== "generating") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/compute/status/${id}`);
        if (res.ok) {
          const { latest } = await res.json();
          setComputeJob(latest ?? null);
          if (latest?.status === "complete") {
            clearInterval(interval);
            loadData();
          } else if (latest?.status === "failed") {
            clearInterval(interval);
          }
        }
      } catch {
        // Silently ignore polling errors
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [data?.request?.status, id, loadData]);

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
        <div className="px-6 md:px-10 lg:px-12 xl:px-16 py-6 max-w-[1600px] mx-auto space-y-6">
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

  // Recruiter sees a simplified read-only view
  if (role === "recruiter") {
    return (
      <AppShell>
        <RecruiterDetailView
          request={request}
          assets={assets}
          pipelineRuns={pipelineRuns}
        />
      </AppShell>
    );
  }

  const hasOutputs = assets.length > 0;

  // Split assets into categories
  const characters = assets.filter(a => a.asset_type === 'base_image');
  const composed = assets.filter(a => a.asset_type === 'composed_creative' || a.asset_type === 'carousel_panel');

  const assetCounts = {
    characters: characters.length,
    elements: composed.length,
    composed: composed.length,
    mockups: composed.length,
  };

  function toggleSelect(assetId: string) {
    setSelectedAssets(prev => {
      const next = new Set(prev);
      if (next.has(assetId)) {
        next.delete(assetId);
      } else {
        next.add(assetId);
      }
      return next;
    });
  }

  function selectAllInCategory() {
    const categoryAssets =
      activeAssetTab === 'characters' ? characters : composed;
    setSelectedAssets(new Set(categoryAssets.map(a => a.id)));
  }

  function handleRetry(asset: GeneratedAsset) {
    toast.info(`Retry queued for ${asset.platform} ${asset.format}`);
  }

  function handleBulkDownload() {
    const allAssets = [...characters, ...composed];
    const selected = allAssets.filter(a => selectedAssets.has(a.id));
    for (const a of selected) {
      if (a.blob_url) window.open(a.blob_url, '_blank');
    }
    toast.success(`Downloading ${selected.length} assets`);
  }

  function handleBulkRetry() {
    toast.info(`Retry queued for ${selectedAssets.size} assets`);
  }

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
          <div className="bg-white border-b border-[var(--border)] px-6 md:px-10 lg:px-12 xl:px-16 py-4">
            <div className="max-w-[1600px] mx-auto flex items-center justify-between">
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

          {/* Sticky Pipeline Nav */}
          <PipelineNav
            stages={[
              { key: "brief", label: "Brief", status: brief ? "passed" : request.status === "generating" ? "running" : "pending" },
              { key: "research", label: "Research", status: brief?.brief_data?.cultural_research ? "passed" : brief ? "running" : "pending" },
              { key: "actors", label: "Actors", status: actors.length > 0 ? "passed" : brief ? "running" : "pending" },
              { key: "images", label: "Images", status: assets.filter(a => a.asset_type === "base_image").length > 0 ? "passed" : actors.length > 0 ? "running" : "pending" },
              { key: "creatives", label: "Creatives", status: assets.filter(a => a.asset_type === "composed_creative").length > 0 ? "passed" : assets.filter(a => a.asset_type === "base_image").length > 0 ? "running" : "pending" },
            ]}
            onNavigate={(key) => document.getElementById(`section-${key}`)?.scrollIntoView({ behavior: "smooth" })}
          />

          <div className="px-6 md:px-10 lg:px-12 xl:px-16 py-6 max-w-[1600px] mx-auto space-y-6">
            {/* Compute Job Status Banner */}
            {request.status === "generating" && (
              <div>
                {(!computeJob || computeJob.status === "pending") && (
                  <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 rounded-[var(--radius-sm)] px-4 py-3">
                    <Loader2 size={16} className="animate-spin" />
                    <span>Queued &mdash; waiting for local worker to pick up...</span>
                  </div>
                )}
                {computeJob?.status === "processing" && (
                  <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 rounded-[var(--radius-sm)] px-4 py-3">
                    <Loader2 size={16} className="animate-spin" />
                    <span>Generating creatives on local machine...</span>
                  </div>
                )}
                {computeJob?.status === "complete" && (
                  <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-[var(--radius-sm)] px-4 py-3">
                    <CheckCircle2 size={16} />
                    <span>Generation complete!</span>
                  </div>
                )}
                {computeJob?.status === "failed" && (
                  <div className="flex items-center justify-between text-sm text-red-700 bg-red-50 rounded-[var(--radius-sm)] px-4 py-3">
                    <div className="flex items-center gap-2">
                      <XCircle size={16} />
                      <span>Generation failed: {computeJob.error_message || "Unknown error"}</span>
                    </div>
                    <button
                      onClick={handleStartPipeline}
                      disabled={actionLoading === "pipeline"}
                      className="btn-secondary text-xs px-3 py-1.5 cursor-pointer ml-3 shrink-0"
                    >
                      {actionLoading === "pipeline" ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <RefreshCw size={12} />
                      )}
                      Retry
                    </button>
                  </div>
                )}
              </div>
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
              <LiveSection
                id="section-brief"
                title="Creative Brief"
                subtitle="Campaign strategy and messaging"
                accentColor="#6B21A8"
                visible={!!brief}
              >
                <section ref={briefSectionRef}>
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
              </LiveSection>
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
              <LiveSection
                id="section-actors"
                title="Actor Profiles"
                subtitle={`${actors.length} character identities generated`}
                accentColor="#E91E8C"
                visible={actors.length > 0}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {actors.map((actor) => (
                    <ActorCard key={actor.id} actor={actor} />
                  ))}
                </div>
              </LiveSection>
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

            {/* Creative Assets — 4 Category View */}
            {hasOutputs && (
              <LiveSection
                id="section-images"
                title="Generated Assets"
                subtitle={`${assets.length} assets across all stages`}
                accentColor="#22c55e"
                visible={assets.length > 0}
              >
                <AssetCategoryTabs
                  activeTab={activeAssetTab}
                  onTabChange={setActiveAssetTab}
                  counts={assetCounts}
                />

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {activeAssetTab === 'characters' && characters.map(asset => (
                    <AssetCard
                      key={asset.id}
                      imageUrl={asset.blob_url || ''}
                      title={(asset.content as Record<string, unknown>)?.actor_name as string || 'Character'}
                      subtitle={(asset.content as Record<string, unknown>)?.outfit_key as string || asset.format}
                      badges={[
                        { label: (asset.content as Record<string, unknown>)?.composition as string || '', color: 'gray' },
                        {
                          label: `${((asset.evaluation_score || 0) * 100).toFixed(0)}%`,
                          color: (asset.evaluation_score || 0) >= 0.85 ? 'green' : (asset.evaluation_score || 0) >= 0.70 ? 'yellow' : 'red',
                        },
                      ]}
                      selected={selectedAssets.has(asset.id)}
                      onSelect={() => toggleSelect(asset.id)}
                      onDownload={() => { if (asset.blob_url) window.open(asset.blob_url, '_blank'); }}
                      onRetry={() => handleRetry(asset)}
                      onRefine={() => setRefineAsset(asset)}
                    />
                  ))}

                  {activeAssetTab === 'elements' && composed.map(asset => (
                    <AssetCard
                      key={`elem-${asset.id}`}
                      imageUrl=""
                      title={(asset.content as Record<string, unknown>)?.template as string || 'Template'}
                      subtitle={(asset.copy_data as Record<string, unknown>)?.headline as string || (asset.content as Record<string, unknown>)?.headline as string || ''}
                      badges={[
                        { label: asset.platform, color: 'blue' },
                        {
                          label: `${((asset.evaluation_score || 0) * 100).toFixed(0)}%`,
                          color: (asset.evaluation_score || 0) >= 0.85 ? 'green' : (asset.evaluation_score || 0) >= 0.70 ? 'yellow' : 'red',
                        },
                      ]}
                      selected={selectedAssets.has(asset.id)}
                      onSelect={() => toggleSelect(asset.id)}
                      onDownload={() => { if (asset.blob_url) window.open(asset.blob_url, '_blank'); }}
                      onRetry={() => handleRetry(asset)}
                      onRefine={() => setRefineAsset(asset)}
                      customPreview={
                        <DesignElementPreview
                          template={(asset.content as Record<string, unknown>)?.template as string}
                          headline={(asset.copy_data as Record<string, unknown>)?.headline as string || (asset.content as Record<string, unknown>)?.headline as string}
                          subheadline={(asset.copy_data as Record<string, unknown>)?.subheadline as string || (asset.content as Record<string, unknown>)?.subheadline as string}
                          ctaText={(asset.copy_data as Record<string, unknown>)?.cta_text as string || (asset.content as Record<string, unknown>)?.cta_text as string}
                          platform={asset.platform}
                        />
                      }
                    />
                  ))}

                  {activeAssetTab === 'composed' && composed.map(asset => (
                    <AssetCard
                      key={asset.id}
                      imageUrl={asset.blob_url || ''}
                      title={(asset.content as Record<string, unknown>)?.template as string || asset.platform}
                      subtitle={asset.format}
                      badges={[
                        { label: asset.platform, color: 'blue' },
                        {
                          label: `${((asset.evaluation_score || 0) * 100).toFixed(0)}%`,
                          color: (asset.evaluation_score || 0) >= 0.85 ? 'green' : (asset.evaluation_score || 0) >= 0.70 ? 'yellow' : 'red',
                        },
                      ]}
                      selected={selectedAssets.has(asset.id)}
                      onSelect={() => toggleSelect(asset.id)}
                      onDownload={() => { if (asset.blob_url) window.open(asset.blob_url, '_blank'); }}
                      onRetry={() => handleRetry(asset)}
                      onRefine={() => setRefineAsset(asset)}
                    />
                  ))}

                  {activeAssetTab === 'mockups' && composed.map(asset => (
                    <AssetCard
                      key={`mock-${asset.id}`}
                      imageUrl=""
                      title={asset.platform}
                      subtitle={asset.format}
                      badges={[
                        { label: asset.platform, color: 'blue' },
                        {
                          label: `${((asset.evaluation_score || 0) * 100).toFixed(0)}%`,
                          color: (asset.evaluation_score || 0) >= 0.85 ? 'green' : (asset.evaluation_score || 0) >= 0.70 ? 'yellow' : 'red',
                        },
                      ]}
                      selected={selectedAssets.has(asset.id)}
                      onSelect={() => toggleSelect(asset.id)}
                      onDownload={() => { if (asset.blob_url) window.open(asset.blob_url, '_blank'); }}
                      onRetry={() => handleRetry(asset)}
                      onRefine={() => setRefineAsset(asset)}
                      customPreview={<MockupPreview asset={asset} />}
                    />
                  ))}
                </div>

                {/* Empty states */}
                {activeAssetTab === 'characters' && characters.length === 0 && (
                  <div className="text-center py-12 text-sm text-[var(--muted-foreground)]">
                    No characters generated yet
                  </div>
                )}
                {activeAssetTab === 'elements' && composed.length === 0 && (
                  <div className="text-center py-12 text-sm text-[var(--muted-foreground)]">
                    No design elements generated yet
                  </div>
                )}
                {activeAssetTab === 'composed' && composed.length === 0 && (
                  <div className="text-center py-12 text-sm text-[var(--muted-foreground)]">
                    No composed creatives generated yet
                  </div>
                )}
                {activeAssetTab === 'mockups' && composed.length === 0 && (
                  <div className="text-center py-12 text-sm text-[var(--muted-foreground)]">
                    No mockups generated yet
                  </div>
                )}

                {selectedAssets.size > 0 && (
                  <BulkActions
                    selectedCount={selectedAssets.size}
                    onDownloadSelected={handleBulkDownload}
                    onRetrySelected={handleBulkRetry}
                    onSelectAll={selectAllInCategory}
                    onDeselectAll={() => setSelectedAssets(new Set())}
                  />
                )}
              </LiveSection>
            )}

            {/* Request Details */}
            {request.form_data && Object.keys(request.form_data).length > 0 && (
              <LiveSection
                id="section-details"
                title="Request Details"
                subtitle="Campaign configuration and targeting"
                accentColor="#0693E3"
                visible={true}
              >
                <RequestDetailsFormatted
                  formData={request.form_data}
                  request={request}
                  editable={role === "admin"}
                  onFieldSave={(field, value) => {
                    toast.success(`Updated ${field}`);
                  }}
                />
              </LiveSection>
            )}

            {/* Action bar — only for review status, not generating */}
            {request.status === "review" && (
              <div className="flex items-center justify-end gap-3 mt-2">
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
          onViewBrief={() => {
            briefSectionRef.current?.scrollIntoView({ behavior: "smooth" });
          }}
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

        {/* Refine Modal */}
        {refineAsset && (
          <RefineModal
            asset={refineAsset}
            requestId={request.id}
            isOpen={!!refineAsset}
            onClose={() => setRefineAsset(null)}
            onSubmitted={() => { setRefineAsset(null); loadData(); }}
          />
        )}
      </div>
    </AppShell>
  );
}
