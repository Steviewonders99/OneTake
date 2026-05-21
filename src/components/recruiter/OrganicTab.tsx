"use client";

import { useState, useMemo } from "react";
import { Users, Globe, TrendingUp, ChevronDown, ChevronRight } from "lucide-react";
import CarouselPreviewCard from "./CarouselPreviewCard";
import type { GeneratedAsset, CreativeBrief } from "@/lib/types";

interface OrganicTabProps {
  assets: GeneratedAsset[];
  brief: CreativeBrief | null;
}

const PLATFORM_TABS = [
  { key: "linkedin", label: "LinkedIn" },
  { key: "instagram", label: "Instagram" },
] as const;

export default function OrganicTab({ assets, brief }: OrganicTabProps) {
  const [showResearch, setShowResearch] = useState(true);
  const [activePlatform, setActivePlatform] = useState<string>("linkedin");

  const organicAssets = useMemo(
    () =>
      assets.filter(
        (a) =>
          a.asset_type === "organic_carousel" &&
          a.evaluation_passed === true &&
          a.blob_url,
      ),
    [assets],
  );

  const filtered = useMemo(() => {
    return organicAssets.filter((a) => {
      const content = (a.content ?? {}) as Record<string, unknown>;
      const platform = String(
        content.platform ?? a.platform ?? "",
      ).toLowerCase();
      return platform.includes(activePlatform);
    });
  }, [organicAssets, activePlatform]);

  if (organicAssets.length === 0) {
    return (
      <div style={{ padding: "48px 0", textAlign: "center" }}>
        <p style={{ fontSize: 14, color: "#8A8A8E", lineHeight: 1.6 }}>
          No organic content generated yet.
          <br />
          Organic carousels are created automatically when the pipeline runs.
        </p>
      </div>
    );
  }

  // Extract personas and cultural research from brief
  const briefData = useMemo(() => {
    if (!brief?.brief_data) return null;
    const data = typeof brief.brief_data === "string" ? JSON.parse(brief.brief_data) : brief.brief_data;
    return data as Record<string, unknown>;
  }, [brief]);

  const personas = useMemo(() => {
    if (!briefData) return [];
    const p = briefData.personas as Array<Record<string, unknown>> | undefined;
    return p ?? [];
  }, [briefData]);

  const culturalResearch = useMemo(() => {
    if (!briefData) return {} as Record<string, Record<string, unknown>>;
    return (briefData.cultural_research ?? {}) as Record<string, Record<string, unknown>>;
  }, [briefData]);

  const regions = Object.keys(culturalResearch);

  return (
    <div>
      {/* Research & Personas */}
      {(personas.length > 0 || regions.length > 0) && (
        <div style={{ marginBottom: 24 }}>
          <button
            type="button"
            onClick={() => setShowResearch(!showResearch)}
            style={{
              display: "flex", alignItems: "center", gap: 8, background: "none",
              border: "none", cursor: "pointer", fontSize: 15, fontWeight: 700,
              color: "#1A1A1A", padding: "0 0 12px 0", fontFamily: "inherit",
            }}
          >
            {showResearch ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            Research & Personas
            <span style={{ fontSize: 12, fontWeight: 400, color: "#8A8A8E" }}>
              {personas.length} personas, {regions.length} regions
            </span>
          </button>

          {showResearch && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Personas */}
              {personas.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(personas.length, 3)}, 1fr)`, gap: 12 }}>
                  {personas.map((persona, i) => (
                    <div key={i} style={{
                      background: "#FFFFFF", borderRadius: 10, border: "1px solid #E8E8EA",
                      padding: 16, display: "flex", flexDirection: "column", gap: 8,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Users size={14} style={{ color: "#7C3AED" }} />
                        <span style={{ fontSize: 14, fontWeight: 600 }}>
                          {String(persona.persona_name ?? persona.name ?? `Persona ${i + 1}`)}
                        </span>
                      </div>
                      <span style={{ fontSize: 12, color: "#8A8A8E" }}>
                        {String(persona.archetype ?? persona.matched_tier ?? "")}
                      </span>
                      {persona.motivations && (
                        <div style={{ fontSize: 12, color: "#555" }}>
                          <span style={{ fontWeight: 600 }}>Motivations:</span>{" "}
                          {Array.isArray(persona.motivations)
                            ? (persona.motivations as string[]).join(", ")
                            : String(persona.motivations)}
                        </div>
                      )}
                      {persona.best_channels && (
                        <div style={{ fontSize: 12, color: "#555" }}>
                          <span style={{ fontWeight: 600 }}>Best channels:</span>{" "}
                          {Array.isArray(persona.best_channels)
                            ? (persona.best_channels as string[]).join(", ")
                            : String(persona.best_channels)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Cultural Research by Region */}
              {regions.length > 0 && (
                <div style={{
                  background: "#FFFFFF", borderRadius: 10, border: "1px solid #E8E8EA",
                  padding: 16,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <Globe size={14} style={{ color: "#0693E3" }} />
                    <span style={{ fontSize: 14, fontWeight: 600 }}>Cultural Research</span>
                    <span style={{ fontSize: 12, color: "#8A8A8E" }}>{regions.length} regions</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(regions.length, 4)}, 1fr)`, gap: 12 }}>
                    {regions.map((region) => {
                      const data = culturalResearch[region] ?? {};
                      const gigPerception = data.gig_work_perception as Record<string, string> | undefined;
                      const platformReality = data.platform_reality as Record<string, string> | undefined;
                      const economicCtx = data.economic_context as Record<string, string> | undefined;
                      return (
                        <div key={region} style={{
                          background: "#F7F7F8", borderRadius: 8, padding: 12,
                          fontSize: 12, display: "flex", flexDirection: "column", gap: 6,
                        }}>
                          <span style={{ fontWeight: 700, fontSize: 13 }}>{region}</span>
                          {gigPerception?.perception && (
                            <div><span style={{ color: "#8A8A8E" }}>Gig perception:</span> {gigPerception.perception}</div>
                          )}
                          {platformReality?.top_platforms_ranked && (
                            <div><span style={{ color: "#8A8A8E" }}>Top platforms:</span> {platformReality.top_platforms_ranked}</div>
                          )}
                          {economicCtx?.competitive_rate && (
                            <div><span style={{ color: "#8A8A8E" }}>Competitive rate:</span> {economicCtx.competitive_rate}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Platform sub-tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 20,
          borderBottom: "1px solid #E5E5E5",
        }}
      >
        {PLATFORM_TABS.map((tab) => {
          const count = organicAssets.filter((a) => {
            const content = (a.content ?? {}) as Record<string, unknown>;
            const p = String(
              content.platform ?? a.platform ?? "",
            ).toLowerCase();
            return p.includes(tab.key);
          }).length;
          const isActive = activePlatform === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActivePlatform(tab.key)}
              style={{
                padding: "10px 16px",
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? "#1A1A1A" : "#8A8A8E",
                background: "none",
                border: "none",
                borderBottom: isActive
                  ? "2px solid #32373C"
                  : "2px solid transparent",
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "all 0.15s",
              }}
            >
              {tab.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Carousel grid */}
      {filtered.length === 0 ? (
        <p
          style={{
            fontSize: 13,
            color: "#8A8A8E",
            fontStyle: "italic",
            padding: "24px 0",
          }}
        >
          No{" "}
          {activePlatform === "linkedin" ? "LinkedIn" : "Instagram"}{" "}
          carousels generated yet.
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 16,
          }}
        >
          {filtered.map((asset) => (
            <CarouselPreviewCard key={asset.id} asset={asset} />
          ))}
        </div>
      )}
    </div>
  );
}
