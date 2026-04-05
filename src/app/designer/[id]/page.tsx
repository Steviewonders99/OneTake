"use client";

import { use, useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Loader2,
  AlertCircle,
  ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import CampaignContextCard from "@/components/designer/CampaignContextCard";
import DownloadKit from "@/components/designer/DownloadKit";
import DesignerAssetCard from "@/components/designer/DesignerAssetCard";
import UploadZone from "@/components/designer/UploadZone";
import FilterTabs from "@/components/FilterTabs";
import type { IntakeRequest, GeneratedAsset, CreativeBrief, ActorProfile } from "@/lib/types";

// ── Types ─────────────────────────────────────────────────────

interface DesignerNote {
  id: string;
  request_id: string;
  asset_id: string;
  note_text: string;
  created_at: string;
}

interface DesignerUpload {
  id: string;
  request_id: string;
  original_asset_id: string | null;
  file_name: string;
  blob_url: string;
  uploaded_by: string;
  created_at: string;
}

interface DesignerData {
  request: IntakeRequest;
  assets: GeneratedAsset[];
  brief: CreativeBrief | null;
  actors: ActorProfile[];
  uploads: DesignerUpload[];
  notes: DesignerNote[];
}

// ── Asset tab types ───────────────────────────────────────────

type AssetTab = "characters" | "raw" | "composed" | "uploads";

// ── Main content component ────────────────────────────────────

function DesignerContent({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [data, setData] = useState<DesignerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AssetTab>("composed");

  // Local state for notes and uploads (optimistic updates)
  const [localNotes, setLocalNotes] = useState<DesignerNote[]>([]);
  const [localUploads, setLocalUploads] = useState<DesignerUpload[]>([]);

  useEffect(() => {
    async function loadData() {
      if (!token) {
        setError("Missing access token. Please use a valid designer link.");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/designer/${id}?token=${token}`);
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Invalid or expired link");
        }
        const result: DesignerData = await res.json();
        setData(result);
        setLocalNotes(result.notes || []);
        setLocalUploads(result.uploads || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id, token]);

  // ── Actor name lookup ─────────────────────────────────────
  const actorMap = useMemo(() => {
    if (!data?.actors) return new Map<string, string>();
    return new Map(data.actors.map((a) => [a.id, a.name]));
  }, [data?.actors]);

  // ── Notes grouped by asset ────────────────────────────────
  const notesByAsset = useMemo(() => {
    const map = new Map<string, DesignerNote[]>();
    for (const note of localNotes) {
      const list = map.get(note.asset_id) || [];
      list.push(note);
      map.set(note.asset_id, list);
    }
    return map;
  }, [localNotes]);

  // ── Filtered assets by tab ────────────────────────────────
  const filteredAssets = useMemo(() => {
    if (!data?.assets) return [];
    switch (activeTab) {
      case "characters":
        return data.assets.filter((a) => a.asset_type === "base_image");
      case "raw":
        return data.assets.filter((a) => a.asset_type === "base_image");
      case "composed":
        return data.assets.filter(
          (a) => a.asset_type === "composed_creative" || a.asset_type === "carousel_panel"
        );
      case "uploads":
        return []; // Handled separately
      default:
        return data.assets;
    }
  }, [data?.assets, activeTab]);

  // ── Tab definitions ───────────────────────────────────────
  const tabs = useMemo(() => {
    if (!data?.assets) return [];
    const chars = data.assets.filter((a) => a.asset_type === "base_image").length;
    const composed = data.assets.filter(
      (a) => a.asset_type === "composed_creative" || a.asset_type === "carousel_panel"
    ).length;
    return [
      { value: "characters" as const, label: "Characters", count: chars },
      { value: "raw" as const, label: "Raw Images", count: chars },
      { value: "composed" as const, label: "Composed", count: composed },
      { value: "uploads" as const, label: "Your Uploads", count: localUploads.length },
    ];
  }, [data?.assets, localUploads.length]);

  // ── Handlers ──────────────────────────────────────────────

  function handleNoteSaved(note: DesignerNote) {
    setLocalNotes((prev) => [...prev, note]);
  }

  async function handleUploadReplacement(assetId: string, file: File) {
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("token", token);
      fd.append("original_asset_id", assetId);

      const res = await fetch(`/api/designer/${id}/upload`, {
        method: "POST",
        body: fd,
      });

      if (!res.ok) throw new Error("Upload failed");
      const upload: DesignerUpload = await res.json();
      setLocalUploads((prev) => [upload, ...prev]);
      toast.success(`Uploaded replacement: ${file.name}`);
    } catch {
      toast.error("Failed to upload replacement");
    }
  }

  function handleUploadComplete(upload: DesignerUpload) {
    setLocalUploads((prev) => [upload, ...prev]);
  }

  function handleSubmitFinals() {
    // In production this would POST to a notification endpoint
    toast.success("Finals submitted! Steven will be notified.");
  }

  // ── Loading state ─────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center">
        <Loader2 size={32} className="text-[var(--muted-foreground)] animate-spin mb-3" />
        <p className="text-sm text-[var(--muted-foreground)]">Loading assets...</p>
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center">
        <AlertCircle size={32} className="text-[var(--muted-foreground)] mb-3" />
        <p className="text-sm text-[var(--foreground)] font-medium mb-1">Access Denied</p>
        <p className="text-sm text-[var(--muted-foreground)] max-w-sm text-center">
          {error || "Unable to load designer view"}
        </p>
      </div>
    );
  }

  const { request, assets, brief } = data;

  return (
    <div className="min-h-screen bg-white">
      {/* ── Header ──────────────────────────────────────────── */}
      <header className="border-b border-[var(--border)] px-4 pl-14 lg:pl-6 md:pr-6 py-4">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex-1" />
          <div className="text-center">
            <span className="text-lg font-bold tracking-tight text-[var(--foreground)]">
              OneForma
            </span>
            <span className="block text-xs text-[var(--muted-foreground)]">
              Designer Portal
            </span>
          </div>
          <div className="flex-1 text-right">
            <span className="text-xs text-[var(--muted-foreground)]">
              {request.title}
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto px-4 md:px-10 lg:px-12 xl:px-16 py-4 md:py-8 space-y-6 md:space-y-8">
        {/* ── Campaign Context Card ───────────────────────── */}
        <CampaignContextCard request={request} brief={brief} />

        {/* ── Download Kit ────────────────────────────────── */}
        <DownloadKit
          requestId={id}
          token={token}
          hasAssets={assets.length > 0}
        />

        {/* ── Asset Browser ───────────────────────────────── */}
        {assets.length > 0 ? (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-[var(--foreground)]">
              Asset Browser
            </h2>

            <FilterTabs
              tabs={tabs}
              value={activeTab}
              onChange={(v) => setActiveTab(v as AssetTab)}
            />

            {/* Asset grid */}
            {activeTab !== "uploads" ? (
              filteredAssets.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {filteredAssets.map((asset) => (
                    <DesignerAssetCard
                      key={asset.id}
                      asset={asset}
                      actorName={asset.actor_id ? actorMap.get(asset.actor_id) : undefined}
                      requestId={id}
                      token={token}
                      notes={notesByAsset.get(asset.id) || []}
                      onNoteSaved={handleNoteSaved}
                      onUploadReplacement={handleUploadReplacement}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <ImageIcon size={32} className="mx-auto text-[var(--muted-foreground)] mb-2" />
                  <p className="text-sm text-[var(--muted-foreground)]">
                    No assets in this category
                  </p>
                </div>
              )
            ) : (
              /* Uploads tab */
              localUploads.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {localUploads.map((upload) => {
                    const original = upload.original_asset_id
                      ? assets.find((a) => a.id === upload.original_asset_id)
                      : null;
                    return (
                      <div key={upload.id} className="card overflow-hidden">
                        <div className="relative bg-[var(--muted)] aspect-square">
                          <img
                            src={upload.blob_url}
                            alt={upload.file_name}
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute top-2 right-2 text-[12px] font-semibold text-white bg-green-600 px-2 py-0.5 rounded-full">
                            Uploaded
                          </span>
                          {original && (
                            <span className="absolute top-2 left-2 text-[12px] font-semibold text-white bg-blue-600 px-2 py-0.5 rounded-full">
                              Replacement
                            </span>
                          )}
                        </div>
                        <div className="p-3">
                          <p className="text-xs font-medium text-[var(--foreground)] truncate">
                            {upload.file_name}
                          </p>
                          <p className="text-[12px] text-[var(--muted-foreground)]">
                            {new Date(upload.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <ImageIcon size={32} className="mx-auto text-[var(--muted-foreground)] mb-2" />
                  <p className="text-sm text-[var(--muted-foreground)]">
                    No uploads yet. Drop files below to upload refined versions.
                  </p>
                </div>
              )
            )}
          </div>
        ) : (
          <div className="text-center py-16">
            <ImageIcon size={40} className="mx-auto text-[var(--muted-foreground)] mb-3" />
            <p className="text-sm text-[var(--muted-foreground)]">
              No assets have been generated yet
            </p>
          </div>
        )}

        {/* ── Upload Zone + Version Compare ───────────────── */}
        <div className="border-t border-[var(--border)] pt-8">
          <UploadZone
            requestId={id}
            token={token}
            assets={assets}
            uploads={localUploads}
            onUploadComplete={handleUploadComplete}
            onSubmitFinals={handleSubmitFinals}
          />
        </div>
      </div>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-[var(--border)] px-6 py-4 text-center mt-8">
        <p className="text-xs text-[var(--muted-foreground)]">
          Powered by OneForma &middot; Centific
        </p>
      </footer>
    </div>
  );
}

// ── Fallback ──────────────────────────────────────────────────

function DesignerFallback() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center">
      <Loader2 size={32} className="text-[var(--muted-foreground)] animate-spin mb-3" />
      <p className="text-sm text-[var(--muted-foreground)]">Loading...</p>
    </div>
  );
}

// ── Page export ───────────────────────────────────────────────

export default function DesignerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <Suspense fallback={<DesignerFallback />}>
      <DesignerContent id={id} />
    </Suspense>
  );
}
