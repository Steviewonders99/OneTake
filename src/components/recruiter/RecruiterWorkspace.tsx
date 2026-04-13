"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Image, LayoutDashboard } from "lucide-react";
import { getRecruiterStatus } from "@/lib/format";
import CreativeLibrary from "./CreativeLibrary";
import LinkBuilderBar from "./LinkBuilderBar";
import DashboardTab from "./DashboardTab";
import MessagingAccordion from "./MessagingAccordion";
import { StatsRow } from "./StatsRow";
import type {
  IntakeRequest,
  CreativeBrief,
  GeneratedAsset,
  PipelineRun,
  TrackedLinksSummary,
} from "@/lib/types";

type TabKey = "creatives" | "dashboard";

interface RecruiterWorkspaceProps {
  request: IntakeRequest;
  brief: CreativeBrief | null;
  assets: GeneratedAsset[];
  pipelineRuns?: PipelineRun[];
}

export default function RecruiterWorkspace({
  request,
  brief,
  assets,
  pipelineRuns,
}: RecruiterWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("creatives");
  const [selectedAsset, setSelectedAsset] = useState<GeneratedAsset | null>(null);
  const [recruiterInitials, setRecruiterInitials] = useState<string>("??");
  const [summary, setSummary] = useState<TrackedLinksSummary | null>(null);

  const statusInfo = getRecruiterStatus(request.status);
  const isApproved = request.status === "approved" || request.status === "sent";

  const approvedAssets = useMemo(
    () => assets.filter((a) => a.asset_type === "composed_creative" && a.evaluation_passed === true && a.blob_url),
    [assets]
  );

  const channelCount = useMemo(
    () => new Set(approvedAssets.map((a) => a.platform?.toLowerCase()).filter(Boolean)).size,
    [approvedAssets]
  );

  // Fetch recruiter initials on mount
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.initials) setRecruiterInitials(data.initials);
      })
      .catch(() => {});
  }, []);

  // Fetch tracked links summary every 30s (only when approved)
  useEffect(() => {
    if (!isApproved) return;

    function fetchSummary() {
      fetch(`/api/tracked-links?request_id=${request.id}&limit=0`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.summary) setSummary(data.summary);
        })
        .catch(() => {});
    }

    fetchSummary();
    const interval = setInterval(fetchSummary, 30000);
    return () => clearInterval(interval);
  }, [isApproved, request.id]);

  const handleDownloadAll = useCallback(() => {
    for (const asset of approvedAssets) {
      if (asset.blob_url) window.open(asset.blob_url, "_blank");
    }
  }, [approvedAssets]);

  const handleAssetSelect = useCallback((asset: GeneratedAsset | null) => {
    setSelectedAsset(asset);
  }, []);

  // Pre-approval: no tabs, just a status message
  if (!isApproved) {
    return (
      <div style={{ flex: 1, overflowY: "auto", background: "#F7F7F8" }}>
        <div style={{ height: 2, background: "linear-gradient(135deg, #7C3AED, #6D28D9)" }} />
        <HeaderBar
          request={request}
          statusInfo={statusInfo}
          showDownloadAll={false}
          approvedCount={0}
        />
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "64px 32px", textAlign: "center" }}>
          <Image size={40} style={{ color: "#8A8A8E", margin: "0 auto 16px" }} />
          <div style={{ fontSize: 16, fontWeight: 600, color: "#1A1A1A", marginBottom: 8 }}>Campaign is being prepared</div>
          <div style={{ fontSize: 13, color: "#8A8A8E", maxWidth: 400, margin: "0 auto" }}>
            The marketing team is generating creatives for this campaign. You&apos;ll be notified when assets are ready for distribution.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", background: "#F7F7F8" }}>
      {/* Gradient bar */}
      <div style={{ height: 2, background: "linear-gradient(135deg, #7C3AED, #6D28D9)" }} />

      {/* Header */}
      <HeaderBar
        request={request}
        statusInfo={statusInfo}
        showDownloadAll
        approvedCount={approvedAssets.length}
        onDownloadAll={handleDownloadAll}
      />

      {/* Tab bar — sticky */}
      <div style={{ background: "#FFFFFF", borderBottom: "1px solid #E8E8EA", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px", display: "flex", gap: 0 }}>
          <TabButton active={activeTab === "creatives"} onClick={() => setActiveTab("creatives")} icon={<Image size={14} />} label="Assets & Creatives" />
          <TabButton active={activeTab === "dashboard"} onClick={() => setActiveTab("dashboard")} icon={<LayoutDashboard size={14} />} label="Dashboard" />
        </div>
      </div>

      {/* Tab content */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 32px" }}>
        {activeTab === "creatives" && (
          <>
            <StatsRow approvedCount={approvedAssets.length} channelCount={channelCount} summary={summary} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 18, alignItems: "start" }}>
              {/* Left column */}
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <MessagingAccordion brief={brief} />
                <div style={{ background: "#FFFFFF", borderRadius: 10, border: "1px solid #E8E8EA", overflow: "hidden" }}>
                  <div style={{ padding: "14px 18px", borderBottom: "1px solid #E8E8EA", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#1A1A1A" }}>Creative Library</span>
                    <span style={{ fontSize: 11, color: "#8A8A8E" }}>{approvedAssets.length} approved</span>
                  </div>
                  <CreativeLibrary
                    requestId={request.id}
                    campaignSlug={request.campaign_slug}
                    brief={brief}
                    assets={assets}
                    onAssetSelect={handleAssetSelect}
                  />
                </div>
              </div>
              {/* Right column — sticky link builder */}
              <div style={{ position: "sticky", top: 56, alignSelf: "start", maxHeight: "calc(100vh - 72px)", overflowY: "auto" }}>
                <LinkBuilderBar
                  requestId={request.id}
                  campaignSlug={request.campaign_slug}
                  activeChannel=""
                  selectedAsset={selectedAsset}
                  recruiterInitials={recruiterInitials}
                  onDetachCreative={() => setSelectedAsset(null)}
                />
              </div>
            </div>
          </>
        )}
        {activeTab === "dashboard" && <DashboardTab requestId={request.id} />}
      </div>
    </div>
  );
}

/* ─── HeaderBar (internal) ─── */

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
    <div style={{ background: "#FFFFFF", borderBottom: "1px solid #E8E8EA", padding: "18px 32px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <Link
            href="/"
            style={{ color: "#8A8A8E", display: "flex", alignItems: "center" }}
            aria-label="Back to campaigns"
          >
            <ArrowLeft size={18} />
          </Link>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: 17, fontWeight: 700, color: "#1A1A1A", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {request.title}
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
              {request.campaign_slug && (
                <span style={{ fontFamily: "monospace", fontSize: 11, color: "#8A8A8E", background: "#F3F3F5", padding: "2px 7px", borderRadius: 4 }}>
                  {request.campaign_slug}
                </span>
              )}
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "2px 10px",
                  borderRadius: 9999,
                  color: statusInfo.color,
                  background: statusInfo.bgColor,
                  border: `1px solid ${statusInfo.borderColor}`,
                }}
              >
                {statusInfo.label}
              </span>
            </div>
          </div>
        </div>
        {showDownloadAll && approvedCount > 0 && onDownloadAll && (
          <button
            onClick={onDownloadAll}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "9px 18px",
              borderRadius: 9999,
              background: "#32373C",
              color: "#FFFFFF",
              fontSize: 13,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
            }}
          >
            <Download size={14} />
            Download All
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── TabButton (internal) ─── */

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
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "11px 18px",
        fontSize: 13,
        fontWeight: 600,
        color: active ? "#1A1A1A" : "#8A8A8E",
        borderBottom: active ? "2px solid #32373C" : "2px solid transparent",
        background: "none",
        border: "none",
        borderBottomStyle: "solid",
        borderBottomWidth: 2,
        borderBottomColor: active ? "#32373C" : "transparent",
        cursor: "pointer",
        transition: "color 0.15s ease",
      }}
    >
      {icon}
      {label}
    </button>
  );
}
