"use client";

import { useState, useMemo } from "react";
import { Copy, Check, Globe, MessageSquare } from "lucide-react";
import type { GeneratedAsset } from "@/lib/types";

interface CopyLibraryProps {
  assets: GeneratedAsset[];
}

const LOCALE_REVERSE: Record<string, string> = {
  "United Kingdom": "en-GB", "Australia": "en-AU", "India": "en-IN",
  "New Zealand": "en-NZ", "South Africa": "en-ZA", "Ireland": "en-IE", "Singapore": "en-SG",
};

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
  const subheadline = String(content.full_description ?? content.body_text ?? content.subheadline ?? "");
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
  const [activeCountry, setActiveCountry] = useState<string>("all");
  const [activeType, setActiveType] = useState<"social" | "portal">("social");

  const allCopy = useMemo(
    () => assets.filter((a) =>
      (a.asset_type === "copy" || a.asset_type === "job_portal_copy") &&
      a.evaluation_passed === true
    ),
    [assets],
  );

  const socialCopy = useMemo(() => allCopy.filter(a => a.asset_type === "copy"), [allCopy]);
  const portalCopy = useMemo(() => allCopy.filter(a => a.asset_type === "job_portal_copy"), [allCopy]);

  const activeCopy = activeType === "social" ? socialCopy : portalCopy;

  // Get unique countries from portal copy
  const countries = useMemo(() => {
    const set = new Set<string>();
    for (const a of allCopy) {
      const content = (a.content ?? {}) as Record<string, unknown>;
      const country = String(content.country ?? (a as Record<string, unknown>).country ?? "");
      if (country && country !== "undefined") set.add(country);
    }
    return Array.from(set).sort();
  }, [allCopy]);

  // Filter by country
  const countryFiltered = useMemo(() => {
    if (activeCountry === "all") return activeCopy;
    return activeCopy.filter(a => {
      const content = (a.content ?? {}) as Record<string, unknown>;
      return String(content.country ?? a.country ?? "") === activeCountry ||
        a.language === LOCALE_REVERSE[activeCountry];
    });
  }, [activeCopy, activeCountry]);

  const platforms = useMemo(() => {
    const map = new Map<string, GeneratedAsset[]>();
    for (const a of countryFiltered) {
      const key = a.platform ?? "other";
      const list = map.get(key) ?? [];
      list.push(a);
      map.set(key, list);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [countryFiltered]);

  const [activePlatform, setActivePlatform] = useState<string | null>(null);

  // Auto-select first platform
  const selected = activePlatform ?? platforms[0]?.[0] ?? null;

  if (allCopy.length === 0) return null;

  const filtered = platforms.find(([k]) => k === selected)?.[1] ?? [];

  return (
    <div style={{
      background: "#FFFFFF", borderRadius: 10, border: "1px solid #E8E8EA",
      overflow: "hidden",
    }}>
      {/* Type toggle + country filter */}
      <div style={{ padding: "12px 18px", borderBottom: "1px solid #E8E8EA", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        {/* Social / Portal toggle */}
        <div style={{ display: "flex", background: "#F3F4F6", borderRadius: 9999, padding: 2 }}>
          <button type="button" onClick={() => { setActiveType("social"); setActivePlatform(null); }}
            style={{ padding: "4px 12px", borderRadius: 9999, fontSize: 11, fontWeight: 600,
              background: activeType === "social" ? "#32373C" : "transparent",
              color: activeType === "social" ? "#fff" : "#6B7280",
              border: "none", cursor: "pointer", fontFamily: "inherit" }}>
            Social ({socialCopy.length})
          </button>
          <button type="button" onClick={() => { setActiveType("portal"); setActivePlatform(null); }}
            style={{ padding: "4px 12px", borderRadius: 9999, fontSize: 11, fontWeight: 600,
              background: activeType === "portal" ? "#32373C" : "transparent",
              color: activeType === "portal" ? "#fff" : "#6B7280",
              border: "none", cursor: "pointer", fontFamily: "inherit" }}>
            Job Portals ({portalCopy.length})
          </button>
        </div>
        {/* Country filter */}
        {countries.length > 0 && (
          <select
            value={activeCountry}
            onChange={(e) => { setActiveCountry(e.target.value); setActivePlatform(null); }}
            style={{ fontSize: 12, padding: "4px 8px", borderRadius: 8, border: "1px solid #E5E5E5",
              background: "#FFFFFF", color: "#1A1A1A", cursor: "pointer", fontFamily: "inherit" }}>
            <option value="all">All Countries ({portalCopy.length})</option>
            {countries.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
      </div>

      <div style={{
        padding: "10px 18px 0", borderBottom: "1px solid #E8E8EA",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <MessageSquare size={14} style={{ color: "#6D28D9" }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: "#1A1A1A" }}>Copy Library</span>
        <span style={{ fontSize: 11, color: "#8A8A8E" }}>{allCopy.length} variants</span>
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
      <div style={{ padding: 16, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
        {filtered.map((asset) => (
          <CopyCard key={asset.id} asset={asset} />
        ))}
      </div>
    </div>
  );
}
