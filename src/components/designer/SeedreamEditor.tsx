"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  AlertCircle,
  ImageIcon,
  ArrowLeftRight,
  Download,
  Replace,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import AssetBrowser from "./AssetBrowser";
import EditChat from "./EditChat";
import type { EditMessage } from "./EditChat";
import type { AssetWithCampaign } from "./AssetBrowser";
import ImageLoader from "@/components/ui/image-loading";
import type { IntakeRequest, GeneratedAsset } from "@/lib/types";

// ── Types ────────────────────────────────────────────────────────

interface CampaignAssetsResponse {
  request: IntakeRequest;
  assets: GeneratedAsset[];
}

// ── Component ────────────────────────────────────────────────────

export default function SeedreamEditor() {
  // ── Data state ──────────────────────────────────────────────
  const [campaigns, setCampaigns] = useState<IntakeRequest[]>([]);
  const [allAssets, setAllAssets] = useState<AssetWithCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Editor state ────────────────────────────────────────────
  const [selectedAsset, setSelectedAsset] = useState<AssetWithCampaign | null>(null);
  const [editedImageUrl, setEditedImageUrl] = useState<string | null>(null);
  const [messages, setMessages] = useState<EditMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);

  // ── Load all campaigns and their assets ─────────────────────
  useEffect(() => {
    async function loadAll() {
      try {
        const res = await fetch("/api/intake");
        if (!res.ok) throw new Error("Failed to load campaigns");
        const campaignsData: IntakeRequest[] = await res.json();
        const activeCampaigns = campaignsData.filter((c) => c.status !== "draft");
        setCampaigns(activeCampaigns);

        // Load assets for each campaign
        const assetPromises = activeCampaigns.map(async (campaign) => {
          try {
            const assetRes = await fetch(`/api/intake/${campaign.id}/assets`);
            if (!assetRes.ok) return [];
            const assets: GeneratedAsset[] = await assetRes.json();
            return assets.map((a) => ({
              ...a,
              campaign_title: campaign.title,
            }));
          } catch {
            return [];
          }
        });

        const assetArrays = await Promise.all(assetPromises);
        setAllAssets(assetArrays.flat());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, []);

  // ── Handlers ────────────────────────────────────────────────

  const handleAssetSelect = useCallback((asset: AssetWithCampaign) => {
    setSelectedAsset(asset);
    setEditedImageUrl(null);
    setMessages([]);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      try {
        const data = e.dataTransfer.getData("application/json");
        if (!data) return;
        const parsed = JSON.parse(data);
        // Find the full asset from our list
        const asset = allAssets.find((a) => a.id === parsed.id);
        if (asset) {
          handleAssetSelect(asset);
        }
      } catch {
        // Ignore invalid drag data
      }
    },
    [allAssets, handleAssetSelect]
  );

  const handleEditSubmit = useCallback(
    async (prompt: string) => {
      if (!selectedAsset?.blob_url) return;

      const userMessage: EditMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        text: prompt,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsGenerating(true);

      try {
        // Step 1: Refine the prompt with best practices
        let refinedPrompt = prompt;
        try {
          const refineRes = await fetch("/api/revise/refine-prompt", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_prompt: prompt,
              revision_type: "image",
              context: {
                platform: selectedAsset.platform,
                actor_name: (selectedAsset.content as Record<string, any>)?.actor_name,
                format: selectedAsset.format,
              },
            }),
          });
          if (refineRes.ok) {
            const refineData = await refineRes.json();
            if (refineData.refined_prompt && refineData.was_refined) {
              refinedPrompt = refineData.refined_prompt;
              // Show the refined prompt in the chat
              const refineMessage: EditMessage = {
                id: `refine-${Date.now()}`,
                role: "system",
                text: `Optimized prompt: "${refinedPrompt}"`,
                timestamp: new Date().toISOString(),
              };
              setMessages((prev) => [...prev, refineMessage]);
            }
          }
        } catch {
          // Fallback: use original prompt
        }

        // Step 2: Call Seedream 4.5 Edit via /api/revise
        const res = await fetch("/api/revise", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            asset_id: selectedAsset.id,
            revision_type: "image",
            prompt: refinedPrompt,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Edit failed");
        }

        const data = await res.json();

        // Extract the result image URL
        let resultImageUrl: string | undefined;
        if (data.edited_url) {
          resultImageUrl = data.edited_url;
        } else if (data.status === "processing") {
          // Async — would need polling, for now show message
          resultImageUrl = undefined;
        }

        if (resultImageUrl) {
          setEditedImageUrl(resultImageUrl);
        }

        const systemMessage: EditMessage = {
          id: `system-${Date.now()}`,
          role: "system",
          text: resultImageUrl
            ? "Edit applied via Seedream 4.5. Review the result in the comparison view."
            : data.status === "processing"
              ? "Image is being processed by Seedream 4.5. This may take a few seconds..."
              : "Edit request processed. Try a more specific prompt.",
          imageUrl: resultImageUrl,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, systemMessage]);
      } catch (err) {
        const errorMessage: EditMessage = {
          id: `system-${Date.now()}`,
          role: "system",
          text: `Edit failed: ${err instanceof Error ? err.message : "Unknown error"}`,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMessage]);
        toast.error("Edit failed");
      } finally {
        setIsGenerating(false);
      }
    },
    [selectedAsset, editedImageUrl]
  );

  const handleReplace = useCallback(async () => {
    if (!selectedAsset || !editedImageUrl) return;
    setIsReplacing(true);

    try {
      const res = await fetch("/api/designer/replace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset_id: selectedAsset.id,
          new_blob_url: editedImageUrl,
          edit_description: messages
            .filter((m) => m.role === "user")
            .map((m) => m.text)
            .join("; "),
        }),
      });

      if (!res.ok) throw new Error("Replace failed");

      toast.success("Asset replaced successfully");

      // Update local state
      setAllAssets((prev) =>
        prev.map((a) =>
          a.id === selectedAsset.id ? { ...a, blob_url: editedImageUrl } : a
        )
      );
      setSelectedAsset((prev) =>
        prev ? { ...prev, blob_url: editedImageUrl } : prev
      );
      setEditedImageUrl(null);
    } catch {
      toast.error("Failed to replace asset");
    } finally {
      setIsReplacing(false);
    }
  }, [selectedAsset, editedImageUrl, messages]);

  // ── Loading state ───────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 size={28} className="text-[var(--muted-foreground)] animate-spin mb-3" />
        <p className="text-sm text-[var(--muted-foreground)]">Loading editor...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <AlertCircle size={28} className="text-[var(--muted-foreground)] mb-3" />
        <p className="text-sm text-[var(--foreground)] font-medium mb-1">Unable to load</p>
        <p className="text-sm text-[var(--muted-foreground)]">{error}</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 pl-14 lg:pl-6 md:pr-6 py-4 border-b border-[var(--border)] bg-white">
        <h1 className="text-lg font-bold text-[var(--foreground)]">Seedream Editor</h1>
        <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
          Drag an asset into the workspace, then describe your edits
        </p>
      </div>

      {/* Two-column layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left: Asset Browser */}
        <div className="hidden lg:block w-[320px] shrink-0 border-r border-[var(--border)] bg-white overflow-hidden">
          <AssetBrowser
            assets={allAssets}
            campaigns={campaigns}
            onAssetSelect={handleAssetSelect}
            selectedAssetId={selectedAsset?.id}
          />
        </div>

        {/* Right: Editor Workspace */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Workspace area */}
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            {/* Image comparison area */}
            <div
              className="flex-1 p-4 md:p-6 overflow-y-auto"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {selectedAsset ? (
                <div className="space-y-4">
                  {/* Comparison header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-[var(--foreground)]">
                        {selectedAsset.platform} — {selectedAsset.format.replace(/_/g, " ")}
                      </p>
                      {selectedAsset.campaign_title && (
                        <p className="text-xs text-[var(--muted-foreground)]">
                          {selectedAsset.campaign_title}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {editedImageUrl && (
                        <>
                          <button
                            onClick={() => {
                              if (editedImageUrl) window.open(editedImageUrl, "_blank");
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-full border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)] cursor-pointer transition-colors"
                          >
                            <Download size={12} />
                            Download
                          </button>
                          <button
                            onClick={handleReplace}
                            disabled={isReplacing}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-full bg-[var(--oneforma-charcoal)] text-white hover:opacity-90 cursor-pointer transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isReplacing ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Replace size={12} />
                            )}
                            Replace Original
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Image comparison */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Original */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
                        Original
                      </p>
                      <div className="rounded-[12px] overflow-hidden border border-[var(--border)] bg-[var(--muted)] aspect-square">
                        {selectedAsset.blob_url ? (
                          <ImageLoader
                            src={selectedAsset.blob_url}
                            alt="Original"
                            width="600"
                            height="600"
                            gridSize={14}
                            cellGap={4}
                            cellShape="square"
                            cellColor="#e5e5e5"
                            blinkSpeed={1500}
                            transitionDuration={600}
                            fadeOutDuration={500}
                            loadingDelay={600}
                            className="w-full h-full"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon size={32} className="text-[var(--muted-foreground)] opacity-30" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Edited */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
                          Edited
                        </p>
                        {editedImageUrl && (
                          <Check size={12} className="text-green-600" />
                        )}
                      </div>
                      <div className="rounded-[12px] overflow-hidden border border-[var(--border)] bg-[var(--muted)] aspect-square">
                        {editedImageUrl ? (
                          <ImageLoader
                            src={editedImageUrl}
                            alt="Edited"
                            width="600"
                            height="600"
                            gridSize={14}
                            cellGap={4}
                            cellShape="square"
                            cellColor="#e5e5e5"
                            blinkSpeed={1500}
                            transitionDuration={600}
                            fadeOutDuration={500}
                            loadingDelay={600}
                            className="w-full h-full"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                            <ArrowLeftRight size={24} className="text-[var(--muted-foreground)] opacity-30" />
                            <p className="text-xs text-[var(--muted-foreground)]">
                              Edits will appear here
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Drop zone */
                <div
                  className={`
                    h-full flex flex-col items-center justify-center rounded-[16px] border-2 border-dashed transition-colors
                    ${
                      isDragOver
                        ? "border-[var(--oneforma-charcoal)] bg-[var(--oneforma-charcoal)]/5"
                        : "border-[var(--border)] bg-[var(--muted)]/30"
                    }
                  `}
                >
                  <ImageIcon
                    size={40}
                    className={`mb-3 transition-colors ${
                      isDragOver ? "text-[var(--oneforma-charcoal)]" : "text-[var(--muted-foreground)] opacity-30"
                    }`}
                  />
                  <p className="text-sm font-medium text-[var(--foreground)] mb-1">
                    {isDragOver ? "Drop to load asset" : "Drag an asset here"}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Or click an asset in the browser to select it
                  </p>
                </div>
              )}
            </div>

            {/* Chat panel */}
            <div className="w-full lg:w-[340px] shrink-0 border-t lg:border-t-0 lg:border-l border-[var(--border)] bg-white overflow-hidden h-[300px] lg:h-auto">
              <EditChat
                messages={messages}
                onSubmit={handleEditSubmit}
                isGenerating={isGenerating}
                disabled={!selectedAsset}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
