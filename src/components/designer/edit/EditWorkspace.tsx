"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import type { GeneratedAsset } from "@/lib/types";
import type { Theme } from "../gallery/tokens";
import { FONT } from "../gallery/tokens";
import LayerToggle from "./LayerToggle";
import type { Layer } from "./LayerToggle";
import QuickEditor from "./QuickEditor";
import GraphicEditor from "./GraphicEditor";

interface EditWorkspaceProps {
  asset: GeneratedAsset;
  theme: Theme;
  onClose: () => void;
  onAssetUpdated: () => void;
}

export default function EditWorkspace({ asset, theme, onClose, onAssetUpdated }: EditWorkspaceProps) {
  const [activeLayer, setActiveLayer] = useState<Layer>("photo");
  const content = (asset.content || {}) as Record<string, any>;
  const platform = asset.platform || "unknown";

  return (
    <div style={{
      background: theme.surface, border: `1px solid ${theme.border}`,
      borderRadius: 12, overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "14px 20px", borderBottom: `1px solid ${theme.border}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={onClose}
            style={{ color: theme.textMuted, cursor: "pointer", display: "flex", background: "none", border: "none" }}
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: FONT.sans }}>
              Editing: {content.overlay_headline || content.headline || "Creative"}
            </div>
            <div style={{ fontSize: 11, color: theme.textMuted }}>
              {content.actor_name || "Unknown"} · {content.pillar || "earn"} · {platform}
            </div>
          </div>
        </div>
        <LayerToggle activeLayer={activeLayer} onToggle={setActiveLayer} theme={theme} />
      </div>

      {/* Edit content — QuickEditor (photo layer) or GraphicEditor (graphic layer) */}
      {activeLayer === "photo" ? (
        <QuickEditor
          asset={asset}
          theme={theme}
          onClose={onClose}
          onAccept={(newUrl) => {
            // For now, just close and refresh — PATCH will be wired later
            toast.success("Edit accepted — gallery will refresh");
            onAssetUpdated();
          }}
        />
      ) : (
        <GraphicEditor
          asset={asset}
          theme={theme}
          onClose={onClose}
          onSaved={onAssetUpdated}
        />
      )}
    </div>
  );
}
