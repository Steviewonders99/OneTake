"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Package, BarChart3, Info } from "lucide-react";
import { getRecruiterStatus } from "@/lib/format";
import { RecruiterOverviewTab } from "@/components/RecruiterDetailView";
import type {
  IntakeRequest,
  CreativeBrief,
  GeneratedAsset,
  PipelineRun,
} from "@/lib/types";

type TabKey = "creatives" | "performance" | "overview";

interface RecruiterWorkspaceProps {
  request: IntakeRequest;
  brief: CreativeBrief | null;
  assets: GeneratedAsset[];
  pipelineRuns: PipelineRun[];
}

export default function RecruiterWorkspace({
  request,
  brief,
  assets,
  pipelineRuns,
}: RecruiterWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("creatives");
  const statusInfo = getRecruiterStatus(request.status);
  const isApproved = request.status === "approved" || request.status === "sent";
  const approvedAssets = assets.filter((a) => a.evaluation_passed === true);

  function handleDownloadAll() {
    for (const asset of approvedAssets) {
      if (asset.blob_url) window.open(asset.blob_url, "_blank");
    }
  }

  // Pre-approval: no tab bar, just render the overview body (which contains
  // the pipeline progress UI). Tabs only make sense once creatives are approved.
  if (!isApproved) {
    return (
      <div className="flex-1 overflow-y-auto bg-[#FAFAFA]">
        <div className="gradient-accent h-[3px]" />
        <HeaderBar
          request={request}
          statusInfo={statusInfo}
          showDownloadAll={false}
          approvedCount={0}
        />
        <RecruiterOverviewTab
          request={request}
          brief={brief}
          assets={assets}
          pipelineRuns={pipelineRuns}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAFAFA]">
      <div className="gradient-accent h-[3px]" />
      <HeaderBar
        request={request}
        statusInfo={statusInfo}
        showDownloadAll
        approvedCount={approvedAssets.length}
        onDownloadAll={handleDownloadAll}
      />

      {/* Tab bar */}
      <div className="bg-white border-b border-[var(--border)] sticky top-0 z-10">
        <div className="max-w-[1100px] mx-auto px-4 md:px-6 flex items-center gap-1">
          <TabButton
            active={activeTab === "creatives"}
            onClick={() => setActiveTab("creatives")}
            icon={<Package size={15} />}
            label="Creatives"
          />
          <TabButton
            active={activeTab === "performance"}
            onClick={() => setActiveTab("performance")}
            icon={<BarChart3 size={15} />}
            label="Performance"
          />
          <TabButton
            active={activeTab === "overview"}
            onClick={() => setActiveTab("overview")}
            icon={<Info size={15} />}
            label="Overview"
          />
        </div>
      </div>

      {/* Active tab body */}
      {activeTab === "creatives" && (
        <div className="px-4 md:px-6 py-6 max-w-[1100px] mx-auto">
          <p className="text-sm text-[var(--muted-foreground)]">
            Creatives tab — placeholder until Task 16.
          </p>
        </div>
      )}
      {activeTab === "performance" && (
        <div className="px-4 md:px-6 py-6 max-w-[1100px] mx-auto">
          <p className="text-sm text-[var(--muted-foreground)]">
            Performance tab — placeholder until Task 17.
          </p>
        </div>
      )}
      {activeTab === "overview" && (
        <RecruiterOverviewTab
          request={request}
          brief={brief}
          assets={assets}
          pipelineRuns={pipelineRuns}
        />
      )}
    </div>
  );
}

function HeaderBar({
  request,
  statusInfo,
  showDownloadAll,
  approvedCount,
  onDownloadAll,
}: {
  request: IntakeRequest;
  statusInfo: ReturnType<typeof getRecruiterStatus>;
  showDownloadAll: boolean;
  approvedCount: number;
  onDownloadAll?: () => void;
}) {
  return (
    <div className="bg-white border-b border-[var(--border)] px-4 pl-14 lg:pl-6 md:pr-10 py-4">
      <div className="max-w-[1100px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/"
            className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer shrink-0"
            aria-label="Back to campaigns"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-[var(--foreground)] truncate">
              {request.title}
            </h1>
            <p className="text-sm text-[var(--muted-foreground)]">
              {request.campaign_slug && (
                <span className="font-mono text-xs mr-2">{request.campaign_slug}</span>
              )}
              {request.task_type.replace(/_/g, " ")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
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
          {showDownloadAll && approvedCount > 0 && onDownloadAll && (
            <button onClick={onDownloadAll} className="btn-primary cursor-pointer">
              <Download size={15} />
              Download All
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 cursor-pointer transition-colors",
        active
          ? "text-[var(--foreground)] border-[#32373C]"
          : "text-[var(--muted-foreground)] border-transparent hover:text-[var(--foreground)]",
      ].join(" ")}
    >
      {icon}
      {label}
    </button>
  );
}
