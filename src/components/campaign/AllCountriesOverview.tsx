"use client";

import { useState, useMemo } from "react";
import type { CountryQuota, GeneratedAsset, ComputeJob } from "@/lib/types";

interface AllCountriesOverviewProps {
  quotas: CountryQuota[];
  jobs: ComputeJob[];
  assets: GeneratedAsset[];
  onSelectCountry: (country: string) => void;
}

type StatusFilter = "all" | "complete" | "processing" | "pending";

function getCountryStatus(country: string, jobs: ComputeJob[]): { status: string; stageTarget: number | null } {
  const job = jobs.find((j) => j.country === country && j.job_type === "generate_country");
  if (!job) return { status: "pending", stageTarget: null };
  return { status: job.status, stageTarget: job.stage_target };
}

function countAssets(country: string, assets: GeneratedAsset[], type: string): number {
  return assets.filter((a) => a.country === country && a.asset_type === type).length;
}

const STATUS_BADGES: Record<string, { bg: string; color: string; label: string }> = {
  complete: { bg: "#dcfce7", color: "#15803d", label: "DONE" },
  processing: { bg: "#dbeafe", color: "#1d4ed8", label: "GENERATING" },
  pending: { bg: "#f5f5f5", color: "#737373", label: "PENDING" },
  failed: { bg: "#fee2e2", color: "#dc2626", label: "FAILED" },
};

const FILTER_PILLS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "complete", label: "Done" },
  { key: "processing", label: "Generating" },
  { key: "pending", label: "Pending" },
];

export default function AllCountriesOverview({ quotas, jobs, assets, onSelectCountry }: AllCountriesOverviewProps) {
  const [filter, setFilter] = useState<StatusFilter>("all");

  const countryData = useMemo(() => {
    return quotas.map((q) => {
      const { status, stageTarget } = getCountryStatus(q.country, jobs);
      return {
        quota: q,
        status,
        stageTarget,
        images: countAssets(q.country, assets, "base_image"),
        creatives: countAssets(q.country, assets, "composed_creative"),
        copy: countAssets(q.country, assets, "copy"),
      };
    });
  }, [quotas, jobs, assets]);

  const filtered = filter === "all" ? countryData : countryData.filter((c) => c.status === filter);

  const statusCounts = useMemo(() => ({
    all: countryData.length,
    complete: countryData.filter((c) => c.status === "complete").length,
    processing: countryData.filter((c) => c.status === "processing").length,
    pending: countryData.filter((c) => c.status === "pending").length,
  }), [countryData]);

  const totalVolume = quotas.reduce((sum, q) => sum + q.total_volume, 0);
  const totalAssets = assets.length;
  const avgRate = quotas.length > 0 ? quotas.reduce((sum, q) => sum + q.rate, 0) / quotas.length : 0;

  return (
    <div style={{ padding: 24 }}>
      {/* Status filter pills */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {FILTER_PILLS.map((fp) => {
          const isActive = filter === fp.key;
          const count = statusCounts[fp.key];
          const pillColors: Record<string, { bg: string; color: string }> = {
            all: { bg: "#32373C", color: "#FFFFFF" },
            complete: { bg: "#dcfce7", color: "#15803d" },
            processing: { bg: "#dbeafe", color: "#1d4ed8" },
            pending: { bg: "#f5f5f5", color: "#737373" },
          };
          const c = isActive ? pillColors[fp.key] : { bg: "#F5F5F5", color: "#737373" };

          return (
            <button
              key={fp.key}
              type="button"
              onClick={() => setFilter(fp.key)}
              style={{
                padding: "6px 14px",
                fontSize: 11,
                fontWeight: isActive ? 700 : 600,
                color: isActive ? c.color : "#737373",
                background: isActive ? c.bg : "#F5F5F5",
                borderRadius: 9999,
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {fp.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Country cards grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {filtered.map((c) => {
          const badge = STATUS_BADGES[c.status] || STATUS_BADGES.pending;
          const isGenerating = c.status === "processing";
          const isPending = c.status === "pending";
          const isDone = c.status === "complete";

          return (
            <div
              key={c.quota.country}
              onClick={() => onSelectCountry(c.quota.country)}
              style={{
                border: `1px solid ${isGenerating ? "#dbeafe" : "#E5E5E5"}`,
                borderRadius: 12,
                padding: 16,
                cursor: "pointer",
                opacity: isPending ? 0.7 : 1,
                background: isGenerating ? "rgba(219,234,254,0.15)" : "#FFFFFF",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                transition: "all 0.15s",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#1A1A1A" }}>{c.quota.country}</span>
                <span
                  style={{
                    fontSize: 9,
                    padding: "3px 8px",
                    background: badge.bg,
                    color: badge.color,
                    borderRadius: 9999,
                    fontWeight: 700,
                  }}
                >
                  {isGenerating && c.stageTarget ? `STAGE ${c.stageTarget}/4` : badge.label}
                </span>
              </div>

              <div style={{ fontSize: 12, color: "#737373", marginBottom: 4 }}>
                {c.quota.total_volume.toLocaleString()} people | ${c.quota.rate.toFixed(2)}
              </div>

              {c.quota.locale && (
                <div style={{ fontSize: 12, color: "#737373", marginBottom: 8 }}>{c.quota.locale}</div>
              )}

              {isDone && (
                <div style={{ display: "flex", gap: 12, paddingTop: 8, borderTop: "1px solid #f0f0f0", fontSize: 11, color: "#737373" }}>
                  <span><strong style={{ color: "#1A1A1A" }}>{c.images}</strong> imgs</span>
                  <span><strong style={{ color: "#1A1A1A" }}>{c.creatives}</strong> creatives</span>
                  <span><strong style={{ color: "#1A1A1A" }}>{c.copy}</strong> copy</span>
                </div>
              )}

              {isGenerating && c.stageTarget && (
                <div style={{ height: 4, background: "#E5E5E5", borderRadius: 2, overflow: "hidden", marginTop: 8 }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${(c.stageTarget / 4) * 100}%`,
                      background: "linear-gradient(135deg, #0693E3, #9B51E0)",
                      borderRadius: 2,
                    }}
                  />
                </div>
              )}

              {c.quota.demographics.length > 0 && isDone && (
                <div style={{ marginTop: 6, display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {c.quota.demographics.slice(0, 2).map((d, i) => (
                    <span key={i} style={{ fontSize: 10, padding: "2px 6px", background: "#F5F5F5", borderRadius: 9999 }}>
                      {d.category} {d.percentage}%
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Aggregate stats footer */}
      <div
        style={{
          marginTop: 20,
          padding: "16px 20px",
          background: "#F5F5F5",
          borderRadius: 10,
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: 16,
          textAlign: "center",
        }}
      >
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1A1A1A" }}>{quotas.length}</div>
          <div style={{ fontSize: 11, color: "#737373" }}>Countries</div>
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1A1A1A" }}>{totalVolume.toLocaleString()}</div>
          <div style={{ fontSize: 11, color: "#737373" }}>Contributors</div>
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1A1A1A" }}>{totalAssets}</div>
          <div style={{ fontSize: 11, color: "#737373" }}>Total Assets</div>
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1A1A1A" }}>${avgRate.toFixed(2)}</div>
          <div style={{ fontSize: 11, color: "#737373" }}>Avg Rate</div>
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#15803d" }}>{statusCounts.complete}</div>
          <div style={{ fontSize: 11, color: "#737373" }}>Complete</div>
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1d4ed8" }}>{statusCounts.processing}</div>
          <div style={{ fontSize: 11, color: "#737373" }}>In Progress</div>
        </div>
      </div>
    </div>
  );
}
