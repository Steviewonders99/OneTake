"use client";

import { useState, useMemo } from "react";
import { Copy, Check, Globe, MessageSquare } from "lucide-react";
import type { GeneratedAsset } from "@/lib/types";

interface CopyLibraryProps {
  assets: GeneratedAsset[];
}

const PLATFORM_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  linkedin_feed: "LinkedIn",
  instagram: "Instagram",
  facebook: "Facebook",
  facebook_feed: "Facebook",
  facebook_stories: "Facebook Stories",
  reddit: "Reddit",
  "Reddit communities": "Reddit",
  indeed: "Indeed",
  "Transparent job boards": "Job Boards",
  telegram_card: "Telegram",
  twitter: "Twitter/X",
};

function CopyCard({ asset }: { asset: GeneratedAsset }) {
  const [copied, setCopied] = useState<string | null>(null);
  const content = (asset.content ?? {}) as Record<string, unknown>;

  const headline = String(content.headline ?? content.overlay_headline ?? "");
  const subheadline = String(content.subheadline ?? content.body_text ?? "");
  const cta = String(content.cta_text ?? content.cta ?? "");
  const actorName = String(content.actor_name ?? "");
  const pillar = String(content.pillar ?? "");
  const lang = asset.language ?? "";

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div style={{
      background: "#FFFFFF", borderRadius: 10, border: "1px solid #E8E8EA",
      padding: 16, display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#1A1A1A" }}>{actorName}</span>
          {pillar && (
            <span style={{
              fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5,
              padding: "2px 8px", borderRadius: 9999,
              background: pillar === "earn" ? "#ECFDF5" : "#EEF2FF",
              color: pillar === "earn" ? "#059669" : "#4F46E5",
            }}>
              {pillar}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Globe size={11} style={{ color: "#8A8A8E" }} />
          <span style={{ fontSize: 11, color: "#8A8A8E" }}>{lang}</span>
        </div>
      </div>

      {headline && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, color: "#8A8A8E", marginBottom: 3 }}>
            Headline
          </div>
          <div
            onClick={() => handleCopy(headline, "headline")}
            style={{
              fontSize: 15, fontWeight: 600, color: "#1A1A1A", cursor: "pointer",
              padding: "6px 8px", borderRadius: 6, background: "#F7F7F8",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}
          >
            <span>{headline}</span>
            {copied === "headline" ? <Check size={13} color="#059669" /> : <Copy size={13} color="#8A8A8E" />}
          </div>
        </div>
      )}

      {subheadline && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, color: "#8A8A8E", marginBottom: 3 }}>
            Body
          </div>
          <div
            onClick={() => handleCopy(subheadline, "body")}
            style={{
              fontSize: 13, color: "#555", cursor: "pointer", lineHeight: 1.5,
              padding: "6px 8px", borderRadius: 6, background: "#F7F7F8",
              display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8,
            }}
          >
            <span>{subheadline}</span>
            {copied === "body" ? <Check size={13} color="#059669" style={{ flexShrink: 0, marginTop: 2 }} /> : <Copy size={13} color="#8A8A8E" style={{ flexShrink: 0, marginTop: 2 }} />}
          </div>
        </div>
      )}

      {cta && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, color: "#8A8A8E", marginBottom: 3 }}>
            CTA
          </div>
          <div
            onClick={() => handleCopy(cta, "cta")}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "5px 12px", borderRadius: 9999,
              background: "#32373C", color: "#FFFFFF",
              fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}
          >
            {cta}
            {copied === "cta" ? <Check size={11} /> : <Copy size={11} />}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CopyLibrary({ assets }: CopyLibraryProps) {
  const copyAssets = useMemo(
    () => assets.filter((a) => a.asset_type === "copy" && a.evaluation_passed === true),
    [assets],
  );

  const platforms = useMemo(() => {
    const map = new Map<string, GeneratedAsset[]>();
    for (const a of copyAssets) {
      const key = a.platform ?? "other";
      const list = map.get(key) ?? [];
      list.push(a);
      map.set(key, list);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [copyAssets]);

  const [activePlatform, setActivePlatform] = useState<string | null>(null);

  // Auto-select first platform
  const selected = activePlatform ?? platforms[0]?.[0] ?? null;

  if (copyAssets.length === 0) return null;

  const filtered = platforms.find(([k]) => k === selected)?.[1] ?? [];

  return (
    <div style={{
      background: "#FFFFFF", borderRadius: 10, border: "1px solid #E8E8EA",
      overflow: "hidden",
    }}>
      <div style={{
        padding: "14px 18px", borderBottom: "1px solid #E8E8EA",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <MessageSquare size={14} style={{ color: "#6D28D9" }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: "#1A1A1A" }}>Copy Library</span>
        <span style={{ fontSize: 11, color: "#8A8A8E" }}>{copyAssets.length} variants</span>
      </div>

      {/* Platform tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #E8E8EA", overflowX: "auto" }}>
        {platforms.map(([platform, items]) => (
          <button
            key={platform}
            type="button"
            onClick={() => setActivePlatform(platform)}
            style={{
              padding: "10px 16px", fontSize: 12, fontWeight: selected === platform ? 600 : 400,
              color: selected === platform ? "#1A1A1A" : "#8A8A8E",
              background: "none", border: "none", cursor: "pointer", fontFamily: "inherit",
              borderBottom: selected === platform ? "2px solid #32373C" : "2px solid transparent",
              whiteSpace: "nowrap",
            }}
          >
            {PLATFORM_LABELS[platform] ?? platform} ({items.length})
          </button>
        ))}
      </div>

      {/* Copy cards */}
      <div style={{ padding: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {filtered.map((asset) => (
          <CopyCard key={asset.id} asset={asset} />
        ))}
      </div>
    </div>
  );
}
