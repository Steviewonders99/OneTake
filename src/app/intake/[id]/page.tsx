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
  Loader2,
  RefreshCw,
  Clock,
  Copy,
  AlertCircle,
  Globe,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import { StatusBadge, UrgencyBadge, PipelineModeBadge } from "@/components/StatusBadge";
import { EditMode } from "@/components/campaign/EditMode";
import { OrganicMaterials } from "@/components/campaign/OrganicMaterials";
import PipelineProgress from "@/components/PipelineProgress";
import ChannelCard from "@/components/ChannelCard";
import ActorCard from "@/components/ActorCard";
import AssetCategoryTabs from "@/components/AssetCategoryTabs";
import AssetCard from "@/components/AssetCard";
import BulkActions from "@/components/BulkActions";
import RefineModal from "@/components/RefineModal";
import RevisionModal from "@/components/RevisionModal";
import DesignElementPreview from "@/components/DesignElementPreview";
import MockupPreview from "@/components/MockupPreview";
import RecruiterDetailView from "@/components/RecruiterDetailView";
import RecruiterWorkspace from "@/components/recruiter/RecruiterWorkspace";
import BriefExecutive from "@/components/BriefExecutive";
import AssetReviewPanel from "@/components/AssetReviewPanel";
import CampaignWorkspace from "@/components/CampaignWorkspace";
import LandingPagesCard from "@/components/LandingPagesCard";
import LocaleLinksTable from "@/components/LocaleLinksTable";
import ResearchPanel from "@/components/ResearchPanel";
import { extractField, formatLabel } from "@/lib/format";
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
  CountryQuota,
} from "@/lib/types";

interface CampaignStrategy {
  id: string;
  country: string;
  tier: number;
  monthly_budget: number;
  budget_mode: string;
  strategy_data: Record<string, any>;
}

interface DetailData {
  request: IntakeRequest;
  brief: CreativeBrief | null;
  actors: ActorProfile[];
  assets: GeneratedAsset[];
  pipelineRuns: PipelineRun[];
  campaignStrategies: CampaignStrategy[];
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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [changesNote, setChangesNote] = useState("");
  const [showChangesModal, setShowChangesModal] = useState(false);
  const [computeJob, setComputeJob] = useState<ComputeJob | null>(null);
  const [viewMode, setViewMode] = useState<"marketing" | "recruiter">("marketing");
  const [allComputeJobs, setAllComputeJobs] = useState<ComputeJob[]>([]);
  const [activeAssetTab, setActiveAssetTab] = useState<'characters' | 'elements' | 'composed' | 'mockups'>('characters');
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [refineAsset, setRefineAsset] = useState<GeneratedAsset | null>(null);
  const briefSectionRef = useRef<HTMLElement>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Dev-only: ?role=recruiter or ?demo=true override for UI testing
      const params = new URLSearchParams(window.location.search);
      const isDemo = params.get("demo") === "true";
      const roleOverride = params.get("role") as UserRole | null;
      if (isDemo) {
        setRole("admin");
      } else if (roleOverride) { setRole(roleOverride); } else {
        try {
          const meRes = await fetch("/api/auth/me");
          if (meRes.ok) {
            const me = await meRes.json();
            setRole(me.role ?? null);
            setCurrentUserId(me.userId ?? null);
          }
        } catch {
          // Role defaults to null → full view renders as fallback
        }
      }

      // Fetch request details
      const demoQ = isDemo ? "?demo=true" : "";
      const demoAmp = isDemo ? "&demo=true" : "";
      const reqRes = await fetch(`/api/intake/${id}${demoQ}`);
      if (!reqRes.ok) throw new Error("Request not found");
      const request = await reqRes.json();

      // Fetch pipeline status
      let pipelineRuns: PipelineRun[] = [];
      try {
        const pipeRes = await fetch(`/api/generate/${id}${demoQ}`);
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
        const briefRes = await fetch(`/api/generate/${id}/brief${demoQ}`);
        if (briefRes.ok) {
          const briefData = await briefRes.json();
          brief = briefData.brief || null;
        }
      } catch {
        // Brief may not exist yet
      }

      try {
        const actorsRes = await fetch(`/api/generate/${id}/actors${demoQ}`);
        if (actorsRes.ok) {
          const actorsData = await actorsRes.json();
          actors = actorsData.actors || [];
        }
      } catch {
        // Actors may not exist yet
      }

      try {
        const assetsRes = await fetch(`/api/generate/${id}/images${demoQ}`);
        if (assetsRes.ok) {
          const assetsData = await assetsRes.json();
          assets = assetsData.assets || [];
        }
      } catch {
        // Assets may not exist yet
      }

      let campaignStrategies: CampaignStrategy[] = [];
      try {
        const stratRes = await fetch(`/api/generate/${id}/strategy${demoQ}`);
        if (stratRes.ok) {
          const stratData = await stratRes.json();
          campaignStrategies = stratData.strategies || [];
        }
      } catch {
        // Strategies may not exist yet
      }

      setData({
        request,
        brief,
        actors,
        assets,
        pipelineRuns,
        campaignStrategies,
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
          const { latest, jobs: allJobs } = await res.json();
          setComputeJob(latest ?? null);
          if (allJobs) setAllComputeJobs(allJobs);
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

  async function handleRequestPaid() {
    setActionLoading("paid");
    try {
      const res = await fetch(`/api/intake/${id}/request-paid`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to request paid media");
      }
      toast.success("Paid media upgrade requested! Pipeline will re-run with full mode.");
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to request paid media");
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

  // Compute canEdit client-side (mirrors canEditCampaign from permissions.ts)
  const canEdit = (() => {
    if (!['review', 'approved', 'sent'].includes(request.status)) return false;
    if (role === 'admin') return true;
    if (role === 'lead_recruiter') return true;
    if (role === 'recruiter') return request.created_by === currentUserId;
    return false;
  })();

  const allAssetIds = assets.map((a) => a.id);

  const countryQuotas = (request?.form_data?.country_quotas as CountryQuota[] | undefined) ?? [];

  const pipelineMode = request.pipeline_mode ?? 'full';
  const isOrganic = pipelineMode === 'organic';

  const organicAssetTypes = ['wp_job_post', 'job_portal_copy', 'flyer', 'flyer_copy', 'social_caption', 'social_graphic'];
  const organicAssets = assets.filter(a => organicAssetTypes.includes(a.asset_type));

  const canUpgradeToPaid =
    isOrganic &&
    (request.status === 'review' || request.status === 'approved') &&
    (role === 'lead_recruiter' || role === 'admin');

  // Recruiter sees a simplified read-only view
  if (role === "recruiter") {
    return (
      <AppShell>
        <RecruiterWorkspace
          request={request}
          brief={brief}
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

  async function handleDeleteAsset(asset: GeneratedAsset) {
    if (!confirm(`Delete this ${asset.asset_type.replace(/_/g, " ")}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/assets/${asset.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to delete asset");
        return;
      }
      toast.success("Asset deleted");
      // Remove from local state
      if (data) {
        setData({
          ...data,
          assets: data.assets.filter(a => a.id !== asset.id),
        });
      }
    } catch {
      toast.error("Failed to delete asset");
    }
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
          <div className="bg-white border-b border-[var(--border)] px-4 pl-14 md:pl-14 lg:pl-12 xl:pl-16 md:pr-10 lg:pr-12 xl:pr-16 py-4">
            <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
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
              <div className="flex items-center gap-2 sm:gap-3 shrink-0 flex-wrap">
                <StatusBadge status={request.status} />
                <UrgencyBadge urgency={request.urgency} />
                <PipelineModeBadge mode={pipelineMode === 'full' ? 'full' : 'organic'} />
                {isOrganic && role === "admin" && (
                  <div style={{ display: "flex", background: "#F3F4F6", borderRadius: 9999, padding: 2 }}>
                    <button
                      type="button"
                      onClick={() => setViewMode("marketing")}
                      style={{
                        padding: "4px 12px", borderRadius: 9999, fontSize: 12, fontWeight: 600,
                        background: viewMode === "marketing" ? "#32373C" : "transparent",
                        color: viewMode === "marketing" ? "#fff" : "#6B7280",
                        border: "none", cursor: "pointer", fontFamily: "inherit",
                      }}
                    >
                      Marketing
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("recruiter")}
                      style={{
                        padding: "4px 12px", borderRadius: 9999, fontSize: 12, fontWeight: 600,
                        background: viewMode === "recruiter" ? "#32373C" : "transparent",
                        color: viewMode === "recruiter" ? "#fff" : "#6B7280",
                        border: "none", cursor: "pointer", fontFamily: "inherit",
                      }}
                    >
                      Recruiter
                    </button>
                  </div>
                )}
                {canEdit && (
                  <EditMode
                    requestId={request.id}
                    campaignTitle={request.title}
                    allAssetIds={allAssetIds}
                    onEditComplete={() => window.location.reload()}
                  />
                )}
                {canUpgradeToPaid && (
                  <button
                    onClick={handleRequestPaid}
                    disabled={actionLoading === "paid"}
                    className="btn-primary flex items-center gap-2 cursor-pointer"
                  >
                    {actionLoading === "paid" ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <TrendingUp size={16} />
                    )}
                    Request Paid Media
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Recruiter view mode — full RecruiterWorkspace */}
          {viewMode === "recruiter" && isOrganic && (
            <RecruiterWorkspace
              request={request}
              brief={brief}
              assets={assets}
              pipelineRuns={pipelineRuns}
            />
          )}

          {/* Marketing view mode — full admin pipeline view */}
          <div style={{ display: viewMode === "marketing" ? "block" : "none" }}>
          {/* Sticky Pipeline Nav */}
          <PipelineNav
            stages={[
              { key: "workspace", label: "Brief", status: brief ? "passed" : request.status === "generating" ? "running" : "pending" },
              { key: "images", label: "Images", status: assets.filter(a => a.asset_type === "base_image" || a.asset_type === "composed_creative").length > 0 ? "passed" : actors.length > 0 ? "running" : "pending" },
              { key: "videos", label: "Videos", status: assets.filter(a => (a.asset_type as string) === "video").length > 0 ? "passed" : assets.filter(a => a.asset_type === "composed_creative").length > 0 ? "running" : "pending" },
              { key: "details", label: "Details", status: "passed" },
            ]}
            onNavigate={(key) => document.getElementById(`section-${key}`)?.scrollIntoView({ behavior: "smooth" })}
          />

          <div className="px-4 md:px-10 lg:px-12 xl:px-16 py-4 md:py-6 max-w-[1600px] mx-auto space-y-4 md:space-y-6">
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

            {/* Draft/generating status — recruiter sees human team message, admin gets retry */}
            {(request.status === "draft" || request.status === "generating") && role !== "admin" && role !== "designer" && role !== null && (
              <section className="card p-6 text-center">
                <CheckCircle2 size={28} className="mx-auto text-[#22c55e] mb-3" />
                <h2 className="text-base font-semibold text-[var(--foreground)] mb-2">
                  Thanks for Your Submission!
                </h2>
                <p className="text-sm text-[var(--muted-foreground)] mb-2 max-w-md mx-auto">
                  Marketing &amp; Design are now working on the strategy &amp; creative assets for your campaign.
                </p>
                <p className="text-sm text-[var(--muted-foreground)] max-w-md mx-auto">
                  We&apos;ll ping you via Teams once everything is ready for your review.
                </p>
              </section>
            )}
            {request.status === "draft" && (role === "admin" || role === "designer" || role === null) && (
              <section className="card p-6 text-center">
                <Clock size={28} className="mx-auto text-[var(--muted-foreground)] mb-3" />
                <h2 className="text-base font-semibold text-[var(--foreground)] mb-2">
                  Pipeline Queued
                </h2>
                <p className="text-sm text-[var(--muted-foreground)] mb-4 max-w-md mx-auto">
                  Waiting for the worker to pick up this job.
                </p>
                {role === "admin" && (
                <button
                  onClick={handleStartPipeline}
                  disabled={actionLoading === "pipeline"}
                  className="btn-secondary cursor-pointer"
                >
                  {actionLoading === "pipeline" ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Starting Pipeline...
                    </>
                  ) : (
                    <>
                      <RefreshCw size={16} />
                      Retry Pipeline
                    </>
                  )}
                </button>
                )}
              </section>
            )}

            {/* Research — raw intelligence per region */}
            {channelResearch && (
              <LiveSection
                id="section-research"
                title="Market Research"
                subtitle="Cultural intelligence, platform data, and demographics"
                accentColor="#0693E3"
                visible={!!channelResearch}
              >
                <ResearchPanel
                  channelResearch={channelResearch as Record<string, any>}
                  culturalResearch={briefData?.cultural_research as Record<string, any> | undefined}
                  regions={request.target_regions as string[]}
                  editable={role === "admin"}
                  onFieldSave={(path, value) => {
                    toast.success(`Updated research: ${path}`);
                  }}
                />
              </LiveSection>
            )}

            {/* ═══ Recruiter Workspace — creatives, copy, UTM links (organic campaigns) ═══ */}
            {isOrganic && (role === "admin" || role === "designer" || role === null) && (
              <LiveSection
                id="section-recruiter-workspace"
                title="Recruiter Workspace"
                subtitle={`${assets.filter(a => a.asset_type === 'base_image').length} images · ${assets.filter(a => a.asset_type === 'copy').length} copy variants`}
                accentColor="#6D28D9"
                visible
              >
                <RecruiterWorkspace
                  request={request}
                  brief={brief}
                  assets={assets}
                  pipelineRuns={pipelineRuns}
                />
              </LiveSection>
            )}

            {/* ═══ Organic Materials — job posts, social, flyers ═══ */}
            {(role === "admin" || role === "designer" || role === null) && (
              <LiveSection
                id="section-organic"
                title="Organic Materials"
                subtitle="Job posts, social content, and print-ready flyers"
                accentColor="#22c55e"
                visible
              >
                <OrganicMaterials assets={organicAssets} requestId={id} />
              </LiveSection>
            )}

            {/* ═══ Campaign Brief — Strategy, media, regional intel ═══ */}
            {!isOrganic && brief && briefData && (role === "admin" || role === "designer" || role === null) && (
              <LiveSection
                id="section-workspace"
                title="Campaign Workspace"
                subtitle="Strategy, media planning, and regional intelligence"
                accentColor="#6B21A8"
                visible={!!brief}
              >
                <section ref={briefSectionRef}>
                  <CampaignWorkspace
                    briefData={briefData}
                    channelResearch={brief.channel_research as Record<string, any> | null}
                    designDirection={brief.design_direction as Record<string, any> | null}
                    campaignStrategies={data.campaignStrategies}
                    actors={data.actors}
                    assets={assets}
                    editable={role === "admin"}
                    requestId={id}
                    onRefine={(asset) => setRefineAsset(asset)}
                    onRetry={(asset) => handleRetry(asset)}
                    onDelete={handleDeleteAsset}
                    section="brief"
                    computeJobs={allComputeJobs.length > 0 ? allComputeJobs : computeJob ? [computeJob] : []}
                    countryQuotas={countryQuotas}
                  />
                </section>
              </LiveSection>
            )}

            {/* ═══ Personas & Creatives — Persona cards with channel gallery ═══ */}
            {!isOrganic && brief && briefData && (role === "admin" || role === "designer" || role === null) && (
              <LiveSection
                id="section-images"
                title="Personas & Creatives"
                subtitle={`${data.actors.length} actors · ${assets.filter(a => a.asset_type === "composed_creative").length} creatives`}
                accentColor="#E91E8C"
                visible={assets.length > 0 || data.actors.length > 0}
              >
                <CampaignWorkspace
                  briefData={briefData}
                  channelResearch={brief.channel_research as Record<string, any> | null}
                  designDirection={brief.design_direction as Record<string, any> | null}
                  campaignStrategies={data.campaignStrategies}
                  actors={data.actors}
                  assets={assets}
                  editable={role === "admin"}
                  requestId={id}
                  onRefine={(asset) => setRefineAsset(asset)}
                  onRetry={(asset) => handleRetry(asset)}
                  onDelete={handleDeleteAsset}
                  section="personas"
                  computeJobs={allComputeJobs.length > 0 ? allComputeJobs : computeJob ? [computeJob] : []}
                  countryQuotas={countryQuotas}
                />
              </LiveSection>
            )}

            {/* ═══ Landing Pages — URL entry for tracked links ═══ */}
            {(role === "admin" || role === "designer" || role === null) && (
              <LiveSection
                id="section-landing-pages"
                title="Landing Pages"
                subtitle="Job posting, landing page, and form URLs for tracked links"
                accentColor="#0693E3"
                visible
              >
                <LandingPagesCard requestId={id} canEdit={role === "admin"} />
                {/* Locale links from intake spreadsheet */}
                {Array.isArray((request.form_data as Record<string, unknown>)?.locale_links) &&
                  ((request.form_data as Record<string, unknown>).locale_links as unknown[]).length > 0 ? (
                  <div style={{ marginTop: 16 }}>
                    <LocaleLinksTable links={(request.form_data as Record<string, unknown>).locale_links as any[]} />
                  </div>
                ) : null}
              </LiveSection>
            )}

            {/* Fallback: Original Brief + Assets for non-marketing roles */}
            {brief && briefData && role !== "admin" && role !== "designer" && role !== null && (
              <LiveSection
                id="section-brief"
                title="Creative Brief"
                subtitle="Campaign strategy, messaging, and cultural guardrails"
                accentColor="#6B21A8"
                visible={!!brief}
              >
                <BriefExecutive
                  briefData={briefData}
                  channelResearch={brief.channel_research as Record<string, any> | null}
                  designDirection={brief.design_direction as Record<string, any> | null}
                  campaignStrategies={data.campaignStrategies}
                  editable={false}
                />
              </LiveSection>
            )}


            {/* Separate Assets panel only for recruiter role (marketing uses CampaignWorkspace) */}
            {hasOutputs && role !== "admin" && role !== "designer" && role !== null && (
              <LiveSection
                id="section-images"
                title="Generated Assets"
                subtitle={`${assets.length} assets across all stages`}
                accentColor="#22c55e"
                visible={assets.length > 0}
              >
                <AssetReviewPanel
                  assets={assets}
                  onRefine={(asset) => setRefineAsset(asset)}
                  onRetry={(asset) => handleRetry(asset)}
                />
              </LiveSection>
            )}

            {/* Video Assets — paid mode only */}
            {!isOrganic && assets.filter(a => (a.asset_type as string) === "video").length > 0 && (
              <LiveSection
                id="section-videos"
                title="Video Assets"
                subtitle={`${assets.filter(a => (a.asset_type as string) === "video").length} videos generated`}
                accentColor="#E91E8C"
                visible={assets.filter(a => (a.asset_type as string) === "video").length > 0}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {assets.filter(a => (a.asset_type as string) === "video").map((asset) => {
                    const content = (asset.content || {}) as Record<string, any>;
                    return (
                      <div key={asset.id} className="border border-[var(--border)] rounded-xl overflow-hidden bg-white group">
                        <div className="relative aspect-video bg-black">
                          {asset.blob_url ? (
                            <video
                              src={asset.blob_url}
                              controls
                              className="absolute inset-0 w-full h-full object-contain"
                              poster={content.thumbnail_url}
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Loader2 size={24} className="text-white/30 animate-spin" />
                            </div>
                          )}
                        </div>
                        <div className="px-4 py-3 space-y-1">
                          <div className="flex items-center justify-between">
                            <p className="text-[13px] font-medium text-[var(--foreground)]">
                              {extractField(asset.content, "actor_name", "Video")}
                            </p>
                            {asset.evaluation_score && (
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                asset.evaluation_score >= 0.85 ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"
                              }`}>
                                {(asset.evaluation_score * 100).toFixed(0)}%
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[var(--muted-foreground)]">
                            {extractField(asset.content, "template", "").replace(/_/g, " ")}
                            {asset.language ? ` · ${asset.language}` : ""}
                            {content.estimated_duration_s ? ` · ${content.estimated_duration_s}s` : ""}
                          </p>
                          {content.script_hook && (
                            <p className="text-[11px] text-[var(--foreground)] italic line-clamp-1">
                              &ldquo;{content.script_hook}&rdquo;
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
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
            {(request.status === "approved" || request.status === "sent") && (
              <div className="card p-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-green-700">
                  <CheckCircle2 size={16} />
                  <span className="font-medium">
                    {request.status === "sent" ? "Sent to agency" : "Approved — ready for agency"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/api/export/${id}`}
                    target="_blank"
                    className="btn-secondary text-xs px-4 py-2 cursor-pointer"
                  >
                    Download ZIP
                  </Link>
                  <button
                    onClick={async () => {
                      try {
                        setActionLoading("agency");
                        // Generate agency magic link (reuses approve endpoint for token)
                        const res = await fetch(`/api/approve/${id}`, { method: "POST" });
                        const result = await res.json();
                        if (result.magic_link_url) {
                          const agencyUrl = window.location.origin + result.magic_link_url.replace("/designer/", "/agency/");
                          await navigator.clipboard.writeText(agencyUrl);
                          toast.success("Agency link copied! Share with your paid media agency.");
                          // Update status to sent
                          await fetch(`/api/intake/${id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ status: "sent" }),
                          });
                          loadData();
                        }
                      } catch {
                        toast.error("Failed to generate agency link");
                      } finally {
                        setActionLoading(null);
                      }
                    }}
                    disabled={actionLoading === "agency"}
                    className="btn-primary text-xs px-4 py-2 cursor-pointer flex items-center gap-1.5"
                  >
                    {actionLoading === "agency" ? <Loader2 size={12} className="animate-spin" /> : <Globe size={12} />}
                    Send to Agency
                  </button>
                </div>
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

        {/* Smart Revision Modal — routes to Seedream (image) / Gemma (copy) / GLM-5 (creative) */}
        {refineAsset && (
          <RevisionModal
            asset={refineAsset}
            onClose={() => setRefineAsset(null)}
            onRevisionComplete={() => { setRefineAsset(null); loadData(); }}
          />
        )}
      </div>
      </div>
    </AppShell>
  );
}
