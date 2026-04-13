"use client";

import { useState, useMemo, useEffect } from "react";
import { Download, Layers, ImageIcon, Check, Link2, Upload } from "lucide-react";
import { toast } from "sonner";
import type { IntakeRequest, CreativeBrief, GeneratedAsset, ActorProfile } from "@/lib/types";
import type { VersionGroup as VersionGroupType } from "@/lib/channels";
import { DARK, LIGHT, type Theme, FONT } from "./tokens";
import ThemeToggle from "./ThemeToggle";
import PersonaContextCard from "./PersonaContextCard";
import VersionGroup from "./VersionGroup";
import AssetLightbox from "./AssetLightbox";
import EditWorkspace from "../edit/EditWorkspace";
import LandingPagesCard from "@/components/LandingPagesCard";
import FigmaExportButton from "../figma/FigmaExportButton";
import PushToFigmaButton from "../figma/PushToFigmaButton";
import FigmaConnectModal from "../figma/FigmaConnectModal";
import FigmaSyncStatus from "../figma/FigmaSyncStatus";
import ManualUpload from "../figma/ManualUpload";

interface DesignerGalleryProps {
  request: IntakeRequest;
  brief: CreativeBrief | null;
  assets: GeneratedAsset[];
  actors: ActorProfile[];
  token: string;
}

export default function DesignerGallery({
  request,
  brief,
  assets,
  actors,
  token,
}: DesignerGalleryProps) {
  // ── State ──────────────────────────────────────────────────────

  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("nova-designer-theme") === "light" ? LIGHT : DARK;
    }
    return DARK;
  });
  const [distributionTab, setDistributionTab] = useState<"organic" | "paid">("paid");
  const [activePersonaIdx, setActivePersonaIdx] = useState(0);
  const [expandedVersion, setExpandedVersion] = useState<string | null>(null);
  const [lightboxAsset, setLightboxAsset] = useState<GeneratedAsset | null>(null);
  const [editingAsset, setEditingAsset] = useState<GeneratedAsset | null>(null);
  const [showFigmaConnect, setShowFigmaConnect] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  // ── Theme Toggle ───────────────────────────────────────────────

  function toggleTheme() {
    const next = theme === DARK ? LIGHT : DARK;
    setTheme(next);
    localStorage.setItem("nova-designer-theme", next === DARK ? "dark" : "light");
  }

  // ── Persona Extraction ─────────────────────────────────────────

  const personas: Record<string, any>[] = useMemo(() => {
    const briefData = brief?.brief_data as Record<string, any> | undefined;
    const raw = briefData?.personas;
    if (Array.isArray(raw) && raw.length > 0) return raw;
    return [{ persona_name: "All Creatives", archetype_key: "__all__" }];
  }, [brief]);

  const activePersona = personas[activePersonaIdx] || personas[0];

  // ── Asset Grouping Per Persona ─────────────────────────────────

  const personaAssetGroups: GeneratedAsset[][] = useMemo(() => {
    return personas.map((persona) => {
      const key = persona.archetype_key || persona.persona_name || "";
      if (key === "__all__") return assets;

      const matched = assets.filter((asset) => {
        const c = (asset.content || {}) as Record<string, string>;
        if (c.persona === key) return true;
        // Match by actor name if persona has one
        if (persona.actor_name && c.actor_name === persona.actor_name) return true;
        return false;
      });

      return matched;
    });
  }, [assets, personas]);

  // Fallback: assets that didn't match any persona go to first group
  const personaAssetsWithFallback: GeneratedAsset[][] = useMemo(() => {
    if (personas.length <= 1) return personaAssetGroups;

    const assigned = new Set<string>();
    for (const group of personaAssetGroups) {
      for (const a of group) assigned.add(a.id);
    }

    const unmatched = assets.filter((a) => !assigned.has(a.id));
    if (unmatched.length === 0) return personaAssetGroups;

    const result = [...personaAssetGroups];
    result[0] = [...result[0], ...unmatched];
    return result;
  }, [assets, personaAssetGroups, personas.length]);

  // ── Cross-Channel Version Grouping ─────────────────────────────

  function groupAllVersions(personaAssets: GeneratedAsset[]): VersionGroupType[] {
    const composed = personaAssets.filter(
      (a) => a.asset_type === "composed_creative" && a.blob_url
    );
    if (composed.length === 0) return [];

    const groups = new Map<string, GeneratedAsset[]>();
    for (const asset of composed) {
      const c = (asset.content || {}) as Record<string, string>;
      const key = `${c.actor_name || "unknown"}::${c.pillar || "earn"}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(asset);
    }

    return Array.from(groups.entries())
      .sort(([, a], [, b]) => {
        const aT = Math.min(...a.map((x) => new Date(x.created_at).getTime()));
        const bT = Math.min(...b.map((x) => new Date(x.created_at).getTime()));
        return aT - bT;
      })
      .map(([, groupAssets], idx) => {
        const c = (groupAssets[0].content || {}) as Record<string, string>;
        const scores = groupAssets
          .map((a) => a.evaluation_score)
          .filter((s): s is number => s != null && s > 0);
        const avg =
          scores.length > 0
            ? scores.reduce((s, v) => s + v, 0) / scores.length
            : 0;
        return {
          versionLabel: `V${idx + 1}`,
          headline: c.overlay_headline || c.headline || "Untitled",
          archetype: c.archetype || "",
          pillar: c.pillar || "earn",
          actorName: c.actor_name || "",
          avgVqaScore: avg,
          formatCount: new Set(groupAssets.map((a) => a.platform)).size,
          assets: groupAssets,
        };
      });
  }

  const versions = useMemo(
    () => groupAllVersions(personaAssetsWithFallback[activePersonaIdx] || []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [assets, activePersonaIdx]
  );

  // ── Auto-expand first version on persona change ────────────────

  useEffect(() => {
    if (versions.length > 0) setExpandedVersion(versions[0].versionLabel);
    else setExpandedVersion(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePersonaIdx]);

  // ── Computed Values ────────────────────────────────────────────

  const composedCount = assets.filter(
    (a) => a.asset_type === "composed_creative" && a.blob_url
  ).length;

  const personaAssetCounts = useMemo(
    () =>
      personaAssetsWithFallback.map(
        (group) =>
          group.filter((a) => a.asset_type === "composed_creative" && a.blob_url).length
      ),
    [personaAssetsWithFallback]
  );

  // Assets for the currently expanded version (for lightbox navigation)
  const activeVersionAssets: GeneratedAsset[] = useMemo(() => {
    if (!expandedVersion) return [];
    const v = versions.find((ver) => ver.versionLabel === expandedVersion);
    return v ? v.assets : [];
  }, [expandedVersion, versions]);

  // All composed creative assets (for ManualUpload routing)
  const allComposedAssets: GeneratedAsset[] = useMemo(
    () => assets.filter((a) => a.asset_type === "composed_creative" && a.blob_url),
    [assets]
  );

  // ── Handlers ───────────────────────────────────────────────────

  function handleDownloadAll() {
    window.open(`/api/export/${request.id}?token=${token}&type=composed`, "_blank");
    toast.success("Downloading all creatives...");
  }

  // ── Button Styles ──────────────────────────────────────────────

  const darkButtonStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 18px",
    borderRadius: 9999,
    background: theme.border,
    color: theme.text,
    border: `1px solid ${theme.borderHover}`,
    fontSize: 12,
    fontWeight: 600,
    fontFamily: FONT.sans,
    cursor: "pointer",
    transition: "all 0.15s ease",
  };

  const accentButtonStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 18px",
    borderRadius: 9999,
    background: theme.accent,
    color: "#FFFFFF",
    border: "none",
    fontSize: 12,
    fontWeight: 600,
    fontFamily: FONT.sans,
    cursor: "pointer",
    transition: "all 0.15s ease",
  };

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div
      style={{
        minHeight: "100vh",
        background: theme.bg,
        color: theme.text,
        fontFamily: FONT.sans,
        transition: "background 0.2s ease, color 0.2s ease",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "20px 32px",
          borderBottom: `1px solid ${theme.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: "linear-gradient(135deg, #7C3AED, #6D28D9)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Layers size={14} color="white" />
          </div>
          <div>
            <h1
              style={{
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: -0.3,
                margin: 0,
                fontFamily: FONT.sans,
              }}
            >
              {request.title}
            </h1>
            <div
              style={{
                fontSize: 11,
                color: theme.textMuted,
                marginTop: 2,
              }}
            >
              {request.campaign_slug} · {composedCount} creatives · {personas.length}{" "}
              {personas.length === 1 ? "persona" : "personas"}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <FigmaExportButton
            requestId={request.id}
            theme={theme}
            campaignSlug={request.campaign_slug || "export"}
          />
          <PushToFigmaButton requestId={request.id} scope="campaign" theme={theme} />
          <button onClick={() => setShowFigmaConnect(true)} style={darkButtonStyle}>
            <Link2 size={13} /> Connect Figma
          </button>
          <button onClick={() => setShowUpload(true)} style={darkButtonStyle}>
            <Upload size={13} /> Upload
          </button>
          <button onClick={handleDownloadAll} style={darkButtonStyle}>
            <Download size={13} /> Download All
          </button>
          <button style={accentButtonStyle}>
            <Check size={13} /> Submit Finals
          </button>
        </div>
      </div>

      {/* Figma Sync Status */}
      <FigmaSyncStatus requestId={request.id} theme={theme} />

      {/* Persona Tabs */}
      {/* ── Distribution tabs: Organic / Paid ──────────────── */}
      {assets.some((a) => a.asset_type === "organic_carousel") && (
        <div
          style={{
            padding: "0 32px",
            borderBottom: `1px solid ${theme.border}`,
            display: "flex",
            gap: 4,
          }}
        >
          <button
            type="button"
            onClick={() => setDistributionTab("organic")}
            style={{
              padding: "10px 20px",
              fontSize: 13,
              fontWeight: distributionTab === "organic" ? 700 : 400,
              color: distributionTab === "organic" ? "#E84BA5" : theme.textMuted,
              background: "none",
              border: "none",
              borderBottom: distributionTab === "organic" ? "2px solid #E84BA5" : "2px solid transparent",
              cursor: "pointer",
              fontFamily: FONT.sans,
            }}
          >
            Organic
          </button>
          <button
            type="button"
            onClick={() => setDistributionTab("paid")}
            style={{
              padding: "10px 20px",
              fontSize: 13,
              fontWeight: distributionTab === "paid" ? 700 : 400,
              color: distributionTab === "paid" ? theme.text : theme.textMuted,
              background: "none",
              border: "none",
              borderBottom: distributionTab === "paid" ? `2px solid ${theme.text}` : "2px solid transparent",
              cursor: "pointer",
              fontFamily: FONT.sans,
            }}
          >
            Paid
          </button>
        </div>
      )}

      {/* ── Persona tabs ───────────────────────────────────── */}
      <div
        style={{
          padding: "12px 32px 0",
          borderBottom: `1px solid ${theme.border}`,
          display: "flex",
          gap: 4,
        }}
      >
        {personas.map((p, i) => (
          <button
            key={i}
            onClick={() => setActivePersonaIdx(i)}
            style={{
              padding: "10px 20px",
              fontSize: 13,
              fontWeight: 600,
              borderRadius: "8px 8px 0 0",
              border: "1px solid transparent",
              borderBottom: "none",
              cursor: "pointer",
              fontFamily: FONT.sans,
              transition: "all 0.15s",
              background: i === activePersonaIdx ? theme.card : "transparent",
              color: i === activePersonaIdx ? theme.text : theme.textMuted,
              borderColor: i === activePersonaIdx ? theme.border : "transparent",
            }}
          >
            {p.persona_name || p.name || `Persona ${i + 1}`}
            <span
              style={{
                fontSize: 10,
                color: theme.accent,
                marginLeft: 6,
                background: theme.accentSoft,
                padding: "1px 6px",
                borderRadius: 4,
              }}
            >
              {personaAssetCounts[i]}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div
        style={{
          padding: "24px 32px",
          background: theme.card,
          minHeight: "80vh",
        }}
      >
        {editingAsset ? (
          <EditWorkspace
            asset={editingAsset}
            theme={theme}
            onClose={() => setEditingAsset(null)}
            onAssetUpdated={() => {
              setEditingAsset(null);
              // Re-fetch data would go here — for now just close
            }}
          />
        ) : (
          <>
            {/* Landing Pages — designer manages URLs */}
            <div style={{
              background: theme.surface,
              border: `1px solid ${theme.border}`,
              borderRadius: 10,
              padding: 16,
              marginBottom: 18,
            }}>
              <LandingPagesCard requestId={request.id} canEdit={true} />
            </div>

            <PersonaContextCard persona={activePersona} theme={theme} requestId={request.id} />

            {versions.length === 0 ? (
              /* Empty state */
              <div style={{ textAlign: "center", padding: "64px 0" }}>
                <ImageIcon
                  size={40}
                  style={{ color: theme.textDim, margin: "0 auto 16px", display: "block" }}
                />
                <div style={{ fontSize: 15, fontWeight: 600 }}>
                  Pipeline is generating creatives for this campaign
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: theme.textMuted,
                    marginTop: 8,
                    maxWidth: 320,
                    margin: "8px auto 0",
                  }}
                >
                  Check back in 30 minutes. The AI is composing persona-targeted creatives
                  with VQA validation.
                </div>
              </div>
            ) : (
              versions.map((v) => (
                <VersionGroup
                  key={v.versionLabel}
                  version={v}
                  channelName=""
                  isExpanded={expandedVersion === v.versionLabel}
                  onToggle={() =>
                    setExpandedVersion(
                      expandedVersion === v.versionLabel ? null : v.versionLabel
                    )
                  }
                  theme={theme}
                  onAssetClick={setLightboxAsset}
                  onEditAsset={setEditingAsset}
                  requestId={request.id}
                />
              ))
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "16px 32px",
          borderTop: `1px solid ${theme.border}`,
          textAlign: "center",
          fontSize: 11,
          color: theme.textDim,
        }}
      >
        Nova Creative Platform · Powered by OneForma
      </div>

      {/* Lightbox */}
      {lightboxAsset && (
        <AssetLightbox
          asset={lightboxAsset}
          allAssets={activeVersionAssets}
          onClose={() => setLightboxAsset(null)}
          onNavigate={setLightboxAsset}
          theme={theme}
        />
      )}

      {/* Figma Connect Modal */}
      {showFigmaConnect && (
        <FigmaConnectModal
          requestId={request.id}
          theme={theme}
          onClose={() => setShowFigmaConnect(false)}
          onConnected={() => {
            setShowFigmaConnect(false);
            toast.success("Figma sync enabled!");
          }}
        />
      )}

      {/* Manual Upload Modal */}
      {showUpload && (
        <ManualUpload
          requestId={request.id}
          theme={theme}
          assets={allComposedAssets}
          personas={personas}
          onUploaded={() => {
            setShowUpload(false);
            toast.success("Upload complete — gallery refreshing...");
          }}
          onClose={() => setShowUpload(false)}
        />
      )}
    </div>
  );
}
