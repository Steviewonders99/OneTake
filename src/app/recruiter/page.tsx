"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { Loader2, FolderOpen, Image, FileText, Globe, ArrowRight, CheckCircle2, Clock } from "lucide-react";
import type { IntakeRequest } from "@/lib/types";

interface CampaignStats {
  id: string;
  title: string;
  status: string;
  task_type: string;
  created_at: string;
  target_regions: string[];
  pipeline_mode: string;
  imageCount: number;
  copyCount: number;
}

export default function RecruiterDashboard() {
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<CampaignStats[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/intake");
        if (!res.ok) return;
        const requests = (await res.json()) as IntakeRequest[];

        // Load asset counts per campaign
        const stats: CampaignStats[] = [];
        for (const r of requests) {
          let imageCount = 0;
          let copyCount = 0;
          try {
            const assetsRes = await fetch(`/api/generate/${r.id}/images`);
            if (assetsRes.ok) {
              const data = await assetsRes.json();
              const assets = data.assets ?? [];
              imageCount = assets.filter((a: { asset_type: string }) =>
                a.asset_type === "base_image" || a.asset_type === "composed_creative" || a.asset_type === "base_creative"
              ).length;
              copyCount = assets.filter((a: { asset_type: string }) =>
                a.asset_type === "copy" || a.asset_type === "job_portal_copy"
              ).length;
            }
          } catch { /* silent */ }

          stats.push({
            id: r.id,
            title: r.title,
            status: r.status,
            task_type: r.task_type,
            created_at: r.created_at,
            target_regions: (r.target_regions as string[]) ?? [],
            pipeline_mode: (r as Record<string, unknown>).pipeline_mode as string ?? "organic",
            imageCount,
            copyCount,
          });
        }
        setCampaigns(stats);
      } catch { /* silent */ } finally {
        setLoading(false);
      }
    })();
  }, []);

  const activeCampaigns = useMemo(() => campaigns.filter(c => c.status === "approved" || c.status === "sent"), [campaigns]);
  const pendingCampaigns = useMemo(() => campaigns.filter(c => c.status === "generating" || c.status === "review" || c.status === "draft"), [campaigns]);
  const totalImages = useMemo(() => campaigns.reduce((s, c) => s + c.imageCount, 0), [campaigns]);
  const totalCopy = useMemo(() => campaigns.reduce((s, c) => s + c.copyCount, 0), [campaigns]);
  const totalRegions = useMemo(() => new Set(campaigns.flatMap(c => c.target_regions)).size, [campaigns]);

  const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
    approved: { bg: "#ECFDF5", color: "#059669", label: "Approved" },
    sent: { bg: "#ECFDF5", color: "#059669", label: "Sent" },
    review: { bg: "#FEF9C3", color: "#CA8A04", label: "In Review" },
    generating: { bg: "#DBEAFE", color: "#2563EB", label: "Generating" },
    draft: { bg: "#F3F4F6", color: "#6B7280", label: "Draft" },
  };

  if (loading) {
    return (
      <AppShell>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", gap: 8, color: "#8A8A8E" }}>
          <Loader2 size={18} className="animate-spin" />
          <span style={{ fontSize: 14 }}>Loading campaigns...</span>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div style={{ background: "#F7F7F8", minHeight: "100%", padding: "32px 40px" }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1A1A1A", margin: 0 }}>
            Recruiter Dashboard
          </h1>
          <p style={{ fontSize: 14, color: "#8A8A8E", marginTop: 4 }}>
            Your campaigns, creatives, and copy — ready to deploy.
          </p>
        </div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
          {[
            { label: "Active Projects", value: activeCampaigns.length, icon: <FolderOpen size={18} />, color: "#6D28D9" },
            { label: "Total Creatives", value: totalImages, icon: <Image size={18} />, color: "#0693E3" },
            { label: "Copy Variants", value: totalCopy, icon: <FileText size={18} />, color: "#059669" },
            { label: "Target Regions", value: totalRegions, icon: <Globe size={18} />, color: "#EA580C" },
          ].map((stat) => (
            <div key={stat.label} style={{
              background: "#FFFFFF", borderRadius: 12, border: "1px solid #E8E8EA",
              padding: "20px 24px", display: "flex", alignItems: "center", gap: 16,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
                background: `${stat.color}10`, color: stat.color,
              }}>
                {stat.icon}
              </div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#1A1A1A" }}>{stat.value}</div>
                <div style={{ fontSize: 12, color: "#8A8A8E" }}>{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Active campaigns */}
        {activeCampaigns.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1A1A1A", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle2 size={16} style={{ color: "#059669" }} />
              Active Projects
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: 16 }}>
              {activeCampaigns.map((c) => (
                <CampaignCard key={c.id} campaign={c} statusStyles={STATUS_STYLES} />
              ))}
            </div>
          </div>
        )}

        {/* Pending campaigns */}
        {pendingCampaigns.length > 0 && (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1A1A1A", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <Clock size={16} style={{ color: "#CA8A04" }} />
              In Progress
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: 16 }}>
              {pendingCampaigns.map((c) => (
                <CampaignCard key={c.id} campaign={c} statusStyles={STATUS_STYLES} />
              ))}
            </div>
          </div>
        )}

        {campaigns.length === 0 && (
          <div style={{ textAlign: "center", padding: 64, color: "#8A8A8E" }}>
            <FolderOpen size={40} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
            <p style={{ fontSize: 15 }}>No campaigns yet. Submit an intake request to get started.</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function CampaignCard({ campaign, statusStyles }: { campaign: CampaignStats; statusStyles: Record<string, { bg: string; color: string; label: string }> }) {
  const style = statusStyles[campaign.status] ?? statusStyles.draft;
  const isReady = campaign.status === "approved" || campaign.status === "sent";

  return (
    <Link
      href={`/intake/${campaign.id}?role=recruiter`}
      style={{ textDecoration: "none", color: "inherit" }}
    >
      <div style={{
        background: "#FFFFFF", borderRadius: 12, border: "1px solid #E8E8EA",
        padding: 20, cursor: "pointer", transition: "all 0.15s",
        display: "flex", flexDirection: "column", gap: 12,
      }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "#6D28D9"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 8px rgba(109,40,217,0.08)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "#E8E8EA"; (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}
      >
        {/* Top row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1A1A1A", margin: 0, lineHeight: 1.3 }}>
              {campaign.title}
            </h3>
            <p style={{ fontSize: 12, color: "#8A8A8E", marginTop: 2 }}>
              {campaign.task_type.replace(/_/g, " ")} · {new Date(campaign.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </p>
          </div>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 9999,
            background: style.bg, color: style.color, whiteSpace: "nowrap",
          }}>
            {style.label}
          </span>
        </div>

        {/* Regions */}
        {campaign.target_regions.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {campaign.target_regions.slice(0, 5).map((r) => (
              <span key={r} style={{
                fontSize: 10, padding: "2px 8px", borderRadius: 9999,
                background: "#F3F4F6", color: "#6B7280",
              }}>
                {r}
              </span>
            ))}
            {campaign.target_regions.length > 5 && (
              <span style={{ fontSize: 10, padding: "2px 8px", color: "#8A8A8E" }}>
                +{campaign.target_regions.length - 5} more
              </span>
            )}
          </div>
        )}

        {/* Stats row */}
        <div style={{ display: "flex", gap: 16, borderTop: "1px solid #F3F4F6", paddingTop: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Image size={12} style={{ color: "#0693E3" }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#1A1A1A" }}>{campaign.imageCount}</span>
            <span style={{ fontSize: 11, color: "#8A8A8E" }}>creatives</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <FileText size={12} style={{ color: "#059669" }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#1A1A1A" }}>{campaign.copyCount}</span>
            <span style={{ fontSize: 11, color: "#8A8A8E" }}>copy</span>
          </div>
          {isReady && (
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, color: "#6D28D9", fontSize: 12, fontWeight: 600 }}>
              View Deliverables <ArrowRight size={12} />
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
