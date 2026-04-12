"use client";

/**
 * Self-fetching wrapper for DesignerGallery — used in the internal
 * designer dashboard (authenticated via Clerk, NOT magic-link).
 *
 * Fetches request, brief, assets, and actors for a given requestId,
 * then renders the full DesignerGallery component.
 */

import { useEffect, useState, useCallback } from "react";
import { Loader2, AlertCircle, ImageOff, RefreshCw } from "lucide-react";
import DesignerGallery from "./DesignerGallery";
import type {
  IntakeRequest,
  CreativeBrief,
  GeneratedAsset,
  ActorProfile,
} from "@/lib/types";

interface DesignerGalleryPanelProps {
  requestId: string;
}

interface PanelData {
  request: IntakeRequest;
  brief: CreativeBrief | null;
  assets: GeneratedAsset[];
  actors: ActorProfile[];
}

export default function DesignerGalleryPanel({ requestId }: DesignerGalleryPanelProps) {
  const [data, setData] = useState<PanelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reqRes, briefRes, imagesRes, actorsRes] = await Promise.all([
        fetch(`/api/intake/${requestId}`),
        fetch(`/api/generate/${requestId}/brief`),
        fetch(`/api/generate/${requestId}/images`),
        fetch(`/api/generate/${requestId}/actors`),
      ]);

      if (!reqRes.ok) throw new Error("Failed to load campaign");

      const request = await reqRes.json();
      const briefData = briefRes.ok ? await briefRes.json() : null;
      const imagesData = imagesRes.ok ? await imagesRes.json() : { assets: [] };
      const actorsData = actorsRes.ok ? await actorsRes.json() : { actors: [] };

      setData({
        request,
        brief: briefData?.brief ?? briefData ?? null,
        assets: imagesData.assets ?? imagesData ?? [],
        actors: actorsData.actors ?? actorsData ?? [],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", minHeight: 320 }}>
        <Loader2 size={28} style={{ color: "#6D28D9", animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", minHeight: 320, gap: 12, textAlign: "center" }}>
        <AlertCircle size={32} style={{ color: "#ef4444" }} />
        <div style={{ fontSize: 14, fontWeight: 600, color: "#1A1A1A" }}>Failed to load campaign</div>
        <div style={{ fontSize: 12, color: "#8A8A8E", maxWidth: 260 }}>{error || "Unknown error"}</div>
        <button
          onClick={loadData}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "1px solid #E8E8EA", background: "white", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#1A1A1A", fontFamily: "inherit" }}
        >
          <RefreshCw size={12} /> Retry
        </button>
      </div>
    );
  }

  return (
    <DesignerGallery
      request={data.request}
      brief={data.brief}
      assets={data.assets}
      actors={data.actors}
      token=""
    />
  );
}
