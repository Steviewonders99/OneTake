"use client";

import type { CountryQuota } from "@/lib/types";

interface AssetCounts {
  images: number;
  creatives: number;
  copy: number;
  videos: number;
}

interface CountryHeaderProps {
  quota: CountryQuota;
  status: "pending" | "processing" | "complete" | "failed";
  assetCounts: AssetCounts;
  languages: string[];
}

const STATUS_LABELS: Record<string, { bg: string; color: string; label: string }> = {
  complete: { bg: "#dcfce7", color: "#15803d", label: "COMPLETE" },
  processing: { bg: "#dbeafe", color: "#1d4ed8", label: "GENERATING" },
  pending: { bg: "#f5f5f5", color: "#737373", label: "PENDING" },
  failed: { bg: "#fee2e2", color: "#dc2626", label: "FAILED" },
};

export default function CountryHeader({ quota, status, assetCounts, languages }: CountryHeaderProps) {
  const badge = STATUS_LABELS[status] || STATUS_LABELS.pending;

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 20,
        padding: "16px 20px",
        background: "#F5F5F5",
        borderRadius: 10,
      }}
    >
      <div>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#1A1A1A" }}>
          {quota.country}
        </div>
        <div style={{ fontSize: 12, color: "#737373", marginTop: 2 }}>
          {quota.total_volume.toLocaleString()} contributors | ${quota.rate.toFixed(2)}/person | {languages.join(", ") || "—"}
        </div>
        {quota.demographics.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
            {quota.demographics.map((d, i) => (
              <span
                key={i}
                style={{
                  fontSize: 11,
                  padding: "4px 10px",
                  background: "#FFFFFF",
                  borderRadius: 9999,
                  color: "#1A1A1A",
                }}
              >
                {d.category}: {d.value} {d.percentage}%
              </span>
            ))}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        {status === "complete" && (
          <>
            <div style={{ textAlign: "center", fontSize: 12, color: "#737373" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#1A1A1A" }}>{assetCounts.images}</div>
              Images
            </div>
            <div style={{ textAlign: "center", fontSize: 12, color: "#737373" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#1A1A1A" }}>{assetCounts.creatives}</div>
              Creatives
            </div>
            <div style={{ textAlign: "center", fontSize: 12, color: "#737373" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#1A1A1A" }}>{assetCounts.copy}</div>
              Copy
            </div>
            {assetCounts.videos > 0 && (
              <div style={{ textAlign: "center", fontSize: 12, color: "#737373" }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#1A1A1A" }}>{assetCounts.videos}</div>
                Videos
              </div>
            )}
          </>
        )}
        <span
          style={{
            fontSize: 10,
            padding: "4px 10px",
            background: badge.bg,
            color: badge.color,
            borderRadius: 9999,
            fontWeight: 700,
          }}
        >
          {badge.label}
        </span>
      </div>
    </div>
  );
}
