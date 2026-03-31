"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  Loader2,
  AlertCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import PipelineProgress from "@/components/PipelineProgress";
import { getRecruiterStatus, extractField } from "@/lib/format";
import type {
  IntakeRequest,
  CreativeBrief,
  GeneratedAsset,
  ComputeJob,
  PipelineRun,
} from "@/lib/types";

// ─── Tag / persona palette ───────────────────────────────────────────────────

const TAG_STYLES = [
  { bg: "#f0fdf4", border: "#bbf7d0", text: "#166534" },
  { bg: "#eff6ff", border: "#bfdbfe", text: "#1e40af" },
  { bg: "#fdf4ff", border: "#e9d5ff", text: "#6b21a8" },
  { bg: "#fefce8", border: "#fde68a", text: "#854d0e" },
  { bg: "#fef2f2", border: "#fecaca", text: "#991b1b" },
];

const PERSONA_COLORS = ["#9B51E0", "#0693E3", "#22c55e", "#f59e0b"];

// ─── Props ────────────────────────────────────────────────────────────────────

interface RecruiterDetailViewProps {
  request: IntakeRequest;
  brief: CreativeBrief | null;
  assets: GeneratedAsset[];
  pipelineRuns: PipelineRun[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAssetHeadline(asset: GeneratedAsset): string {
  return (
    extractField(asset.content, "overlay_headline") ||
    extractField(asset.copy_data, "headline") ||
    ""
  );
}

function getAssetDescription(asset: GeneratedAsset): string {
  return (
    extractField(asset.copy_data, "primary_text") ||
    extractField(asset.copy_data, "description") ||
    extractField(asset.content, "overlay_sub") ||
    ""
  );
}

function formatDate(iso: string, long = false): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: long ? "long" : "short",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold text-[var(--foreground)] mb-4">
      {children}
    </h2>
  );
}

function MetaDot({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-xs text-[var(--muted-foreground)]">
      <span className="font-medium text-[var(--foreground)]">{label}:</span>{" "}
      {value}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function RecruiterDetailView({
  request,
  brief,
  assets,
  pipelineRuns,
}: RecruiterDetailViewProps) {
  const [computeJob, setComputeJob] = useState<ComputeJob | null>(null);
  const [localPipelineRuns, setLocalPipelineRuns] =
    useState<PipelineRun[]>(pipelineRuns);
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Only show assets that passed evaluation
  const approvedAssets = assets.filter((a) => a.evaluation_passed === true);

  // Unique platforms for filter pills
  const platforms = Array.from(
    new Set(approvedAssets.map((a) => a.platform).filter(Boolean))
  );

  const filteredAssets =
    platformFilter === "all"
      ? approvedAssets
      : approvedAssets.filter((a) => a.platform === platformFilter);

  // Brief data helpers
  const briefData = brief?.brief_data as Record<string, unknown> | undefined;
  const summary = extractField(briefData, "summary");
  const messagingStrategy = briefData?.messaging_strategy as
    | Record<string, unknown>
    | undefined;
  const primaryMessage = extractField(messagingStrategy, "primary_message");
  const tone = extractField(messagingStrategy, "tone");

  const rawValueProps =
    (briefData?.value_props as unknown[]) ??
    (messagingStrategy?.value_propositions as unknown[]) ??
    [];
  const valuePropTags: string[] = rawValueProps
    .map((v) => (typeof v === "string" ? v : ""))
    .filter(Boolean);

  const rawPersonas = (briefData?.personas as unknown[]) ?? [];
  const personas = rawPersonas
    .filter((p) => p && typeof p === "object")
    .map((p) => p as Record<string, unknown>);

  // Recruiter-friendly status
  const statusInfo = getRecruiterStatus(request.status);

  const isPreApproval = !["approved", "sent"].includes(request.status);
  const isPostApproval = ["approved", "sent"].includes(request.status);

  // Poll compute job while generating
  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/compute/status/${request.id}`);
      if (res.ok) {
        const { latest } = await res.json();
        setComputeJob(latest ?? null);
        if (latest?.pipeline_runs) {
          setLocalPipelineRuns(latest.pipeline_runs);
        }
      }
    } catch {
      // silently ignore
    }
  }, [request.id]);

  useEffect(() => {
    if (request.status !== "generating") return;
    pollStatus();
    const interval = setInterval(pollStatus, 5000);
    return () => clearInterval(interval);
  }, [request.status, pollStatus]);

  useEffect(() => {
    setLocalPipelineRuns(pipelineRuns);
  }, [pipelineRuns]);

  function handleDownloadAll() {
    for (const asset of approvedAssets) {
      if (asset.blob_url) window.open(asset.blob_url, "_blank");
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAFAFA]">
      {/* 1. Accent gradient stripe */}
      <div className="gradient-accent h-[3px]" />

      {/* 2. Header bar */}
      <div className="bg-white border-b border-[var(--border)] px-4 pl-14 lg:pl-6 md:pr-10 py-4 sticky top-0 z-10">
        <div className="max-w-[1100px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/"
              className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer transition-colors shrink-0"
              aria-label="Back to campaigns"
            >
              <ArrowLeft size={18} />
            </Link>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-[var(--foreground)] truncate">
                {request.title}
              </h1>
              <p className="text-sm text-[var(--muted-foreground)]">
                {request.task_type.replace(/_/g, " ")} &middot; Created{" "}
                {formatDate(request.created_at)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {/* Recruiter-friendly status badge */}
            <span
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full border"
              style={{
                color: statusInfo.color,
                background: statusInfo.bgColor,
                borderColor: statusInfo.borderColor,
              }}
            >
              {statusInfo.label}
            </span>

            {/* Download All — approved/sent only */}
            {isPostApproval && approvedAssets.length > 0 && (
              <button
                onClick={handleDownloadAll}
                className="btn-primary cursor-pointer"
              >
                <Download size={15} />
                Download All
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 md:px-6 py-6 max-w-[1100px] mx-auto space-y-6">

        {/* 3. Campaign Summary card */}
        {(summary || request.target_regions?.length > 0) && (
          <section className="card p-5 md:p-6">
            <SectionTitle>Campaign Summary</SectionTitle>
            {summary && (
              <p className="text-sm text-[var(--foreground)] leading-relaxed mb-4">
                {summary}
              </p>
            )}
            <div className="flex flex-wrap gap-4">
              {request.target_regions?.length > 0 && (
                <MetaDot
                  label="Regions"
                  value={request.target_regions.join(", ")}
                />
              )}
              {request.target_languages?.length > 0 && (
                <MetaDot
                  label="Languages"
                  value={request.target_languages.join(", ")}
                />
              )}
              {approvedAssets.length > 0 && (
                <MetaDot
                  label="Approved assets"
                  value={String(approvedAssets.length)}
                />
              )}
              {request.volume_needed != null && (
                <MetaDot
                  label="Volume"
                  value={request.volume_needed.toLocaleString()}
                />
              )}
            </div>
          </section>
        )}

        {/* 4. Status card — pre-approval only */}
        {isPreApproval && (
          <section className="card p-5 md:p-6">
            <SectionTitle>Campaign Status</SectionTitle>

            {/* Status icon + human message */}
            <div className="flex items-start gap-3 mb-5">
              {request.status === "generating" && (
                <Loader2
                  size={20}
                  className="text-blue-600 animate-spin shrink-0 mt-0.5"
                />
              )}
              {request.status === "draft" && (
                <Clock
                  size={20}
                  className="text-[var(--muted-foreground)] shrink-0 mt-0.5"
                />
              )}
              {request.status === "review" && (
                <AlertCircle
                  size={20}
                  className="text-amber-500 shrink-0 mt-0.5"
                />
              )}
              {request.status === "rejected" && (
                <XCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {statusInfo.label}
                </p>
                <p className="text-sm text-[var(--muted-foreground)] mt-0.5">
                  {statusInfo.description}
                </p>
              </div>
            </div>

            {/* Pipeline progress — only when generating or runs exist */}
            {(request.status === "generating" ||
              localPipelineRuns.length > 0) && (
              <>
                {/* Compute job banner */}
                {request.status === "generating" && (
                  <div className="mb-4">
                    {(!computeJob || computeJob.status === "pending") && (
                      <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2.5">
                        <Loader2 size={14} className="animate-spin shrink-0" />
                        <span>Queued — waiting for worker to pick up…</span>
                      </div>
                    )}
                    {computeJob?.status === "processing" && (
                      <div className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 rounded-lg px-3 py-2.5">
                        <Loader2 size={14} className="animate-spin shrink-0" />
                        <span>Generating creatives…</span>
                      </div>
                    )}
                    {computeJob?.status === "complete" && (
                      <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2.5">
                        <CheckCircle2 size={14} className="shrink-0" />
                        <span>Generation complete!</span>
                      </div>
                    )}
                  </div>
                )}

                <PipelineProgress runs={localPipelineRuns} />
              </>
            )}
          </section>
        )}

        {/* 5. Messaging Themes card — approved/sent only */}
        {isPostApproval && (primaryMessage || valuePropTags.length > 0 || tone) && (
          <section className="card p-5 md:p-6">
            <SectionTitle>Messaging Themes</SectionTitle>

            {primaryMessage && (
              <div className="mb-4">
                <p className="text-xs font-medium text-[var(--muted-foreground)] mb-1">
                  Core Message
                </p>
                <p className="text-sm text-[var(--foreground)] leading-relaxed">
                  {primaryMessage}
                </p>
              </div>
            )}

            {valuePropTags.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-medium text-[var(--muted-foreground)] mb-2">
                  Value Propositions
                </p>
                <div className="flex flex-wrap gap-2">
                  {valuePropTags.map((tag, i) => {
                    const style = TAG_STYLES[i % TAG_STYLES.length];
                    return (
                      <span
                        key={i}
                        className="text-xs font-medium px-3 py-1 rounded-full border"
                        style={{
                          background: style.bg,
                          borderColor: style.border,
                          color: style.text,
                        }}
                      >
                        {tag}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {tone && (
              <div>
                <p className="text-xs font-medium text-[var(--muted-foreground)] mb-1">
                  Tone
                </p>
                <p className="text-sm text-[var(--foreground)]">{tone}</p>
              </div>
            )}
          </section>
        )}

        {/* 6. Approved Creatives grid — approved/sent only */}
        {isPostApproval && approvedAssets.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[var(--foreground)]">
                Approved Creatives
              </h2>
              <span className="text-xs text-[var(--muted-foreground)]">
                {filteredAssets.length} of {approvedAssets.length} asset
                {approvedAssets.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Platform filter pills */}
            {platforms.length > 1 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {["all", ...platforms].map((p) => (
                  <button
                    key={p}
                    onClick={() => setPlatformFilter(p)}
                    className={[
                      "text-xs font-medium px-3 py-1 rounded-full border transition-colors cursor-pointer",
                      platformFilter === p
                        ? "bg-[#32373C] text-white border-[#32373C]"
                        : "bg-white text-[var(--muted-foreground)] border-[var(--border)] hover:border-[#32373C]",
                    ].join(" ")}
                  >
                    {p === "all" ? "All platforms" : p}
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAssets.map((asset) => {
                const headline = getAssetHeadline(asset);
                const description = getAssetDescription(asset);

                return (
                  <div key={asset.id} className="card p-4 space-y-3">
                    {/* Image preview with platform badge overlay */}
                    <div className="aspect-square rounded-[10px] bg-[var(--muted)] overflow-hidden relative flex items-center justify-center">
                      {asset.blob_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={asset.blob_url}
                          alt={headline || asset.platform || "Creative asset"}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xs text-[var(--muted-foreground)]">
                          No preview
                        </span>
                      )}

                      {/* Platform badge overlay */}
                      {asset.platform && (
                        <span className="absolute top-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-black/60 text-white backdrop-blur-sm">
                          {asset.platform}
                        </span>
                      )}
                    </div>

                    {/* Copy */}
                    <div className="space-y-1">
                      {headline && (
                        <p className="text-sm font-semibold text-[var(--foreground)] line-clamp-2">
                          {headline}
                        </p>
                      )}
                      {description && (
                        <p className="text-xs text-[var(--muted-foreground)] line-clamp-2">
                          {description}
                        </p>
                      )}
                      {!headline && !description && (
                        <p className="text-xs text-[var(--muted-foreground)]">
                          {asset.platform} &middot; {asset.format}
                        </p>
                      )}
                    </div>

                    {/* Download */}
                    {asset.blob_url && (
                      <a
                        href={asset.blob_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-secondary text-xs px-3 py-1.5 w-full cursor-pointer flex items-center justify-center gap-1.5"
                        download
                      >
                        <Download size={12} />
                        Download
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 7. Target Personas card — approved/sent only */}
        {isPostApproval && personas.length > 0 && (
          <section className="card p-5 md:p-6">
            <SectionTitle>Target Personas</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {personas.map((persona, i) => {
                const color = PERSONA_COLORS[i % PERSONA_COLORS.length];
                const name =
                  typeof persona.name === "string" ? persona.name : `Persona ${i + 1}`;
                const demographics =
                  typeof persona.demographics === "string"
                    ? persona.demographics
                    : typeof persona.age_range === "string"
                    ? persona.age_range
                    : "";
                const painPoint =
                  typeof persona.pain_point === "string"
                    ? persona.pain_point
                    : typeof persona.primary_motivation === "string"
                    ? persona.primary_motivation
                    : "";

                return (
                  <div
                    key={i}
                    className="rounded-xl p-4 border"
                    style={{
                      borderColor: `${color}33`,
                      background: `${color}08`,
                    }}
                  >
                    {/* Avatar initial */}
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold mb-3"
                      style={{ background: color }}
                    >
                      {name.charAt(0).toUpperCase()}
                    </div>

                    <p
                      className="text-sm font-semibold mb-0.5"
                      style={{ color }}
                    >
                      {name}
                    </p>

                    {demographics && (
                      <p className="text-xs text-[var(--muted-foreground)] mb-2">
                        {demographics}
                      </p>
                    )}

                    {painPoint && (
                      <p className="text-xs text-[var(--foreground)] leading-relaxed">
                        {painPoint}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 8. Request Details — collapsible */}
        <section className="card overflow-hidden">
          <button
            onClick={() => setDetailsOpen((v) => !v)}
            className="w-full flex items-center justify-between px-5 md:px-6 py-4 text-sm font-semibold text-[var(--foreground)] cursor-pointer hover:bg-[var(--muted)] transition-colors"
            aria-expanded={detailsOpen}
          >
            <span>Request Details</span>
            {detailsOpen ? (
              <ChevronUp size={16} className="text-[var(--muted-foreground)]" />
            ) : (
              <ChevronDown
                size={16}
                className="text-[var(--muted-foreground)]"
              />
            )}
          </button>

          {detailsOpen && (
            <div className="px-5 md:px-6 pb-5 border-t border-[var(--border)] pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                {request.target_languages?.length > 0 && (
                  <div>
                    <span className="block text-xs font-medium text-[var(--muted-foreground)] mb-0.5">
                      Languages
                    </span>
                    <span className="text-[var(--foreground)]">
                      {request.target_languages.join(", ")}
                    </span>
                  </div>
                )}

                {request.target_regions?.length > 0 && (
                  <div>
                    <span className="block text-xs font-medium text-[var(--muted-foreground)] mb-0.5">
                      Regions
                    </span>
                    <span className="text-[var(--foreground)]">
                      {request.target_regions.join(", ")}
                    </span>
                  </div>
                )}

                {request.volume_needed != null && (
                  <div>
                    <span className="block text-xs font-medium text-[var(--muted-foreground)] mb-0.5">
                      Volume Needed
                    </span>
                    <span className="text-[var(--foreground)]">
                      {request.volume_needed.toLocaleString()}
                    </span>
                  </div>
                )}

                <div>
                  <span className="block text-xs font-medium text-[var(--muted-foreground)] mb-0.5">
                    Task Type
                  </span>
                  <span className="text-[var(--foreground)] capitalize">
                    {request.task_type.replace(/_/g, " ")}
                  </span>
                </div>

                <div>
                  <span className="block text-xs font-medium text-[var(--muted-foreground)] mb-0.5">
                    Created
                  </span>
                  <span className="text-[var(--foreground)]">
                    {formatDate(request.created_at, true)}
                  </span>
                </div>

                <div>
                  <span className="block text-xs font-medium text-[var(--muted-foreground)] mb-0.5">
                    Urgency
                  </span>
                  <span className="text-[var(--foreground)] capitalize">
                    {request.urgency}
                  </span>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
