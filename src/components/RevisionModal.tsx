"use client";

import { useState, useEffect } from "react";
import {
  X,
  Pencil,
  Image as ImageIcon,
  Type,
  Layers,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { extractField } from "@/lib/format";
import type { GeneratedAsset } from "@/lib/types";

interface RevisionModalProps {
  asset: GeneratedAsset | null;
  onClose: () => void;
  onRevisionComplete?: (asset: GeneratedAsset, result: any) => void;
}

type RevisionType = "copy" | "image" | "creative";

export default function RevisionModal({
  asset,
  onClose,
  onRevisionComplete,
}: RevisionModalProps) {
  const [prompt, setPrompt] = useState("");
  const [refinedPrompt, setRefinedPrompt] = useState<string | null>(null);
  const [revisionType, setRevisionType] = useState<RevisionType>("image");
  const [loading, setLoading] = useState(false);
  const [refining, setRefining] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto-detect revision type based on asset
  useEffect(() => {
    if (!asset) return;
    if (asset.asset_type === "composed_creative") {
      setRevisionType("creative");
    } else if (asset.asset_type === "base_image") {
      setRevisionType("image");
    } else {
      setRevisionType("copy");
    }
    setPrompt("");
    setResult(null);
    setError(null);
  }, [asset]);

  if (!asset) return null;

  const content = (asset.content || {}) as Record<string, any>;
  const copyData = (asset.copy_data || {}) as Record<string, any>;

  const quickActions: Record<RevisionType, { label: string; prompt: string }[]> = {
    image: [
      { label: "Clean background", prompt: "Remove clutter from the background, make it clean and modern" },
      { label: "Fix skin texture", prompt: "Make the skin look more natural and realistic, less airbrushed" },
      { label: "Improve lighting", prompt: "Improve the lighting to be warmer and more natural, golden hour feel" },
      { label: "Change outfit", prompt: "Change the outfit to be more professional and appropriate for the region" },
      { label: "Change setting", prompt: "Change the setting to a cleaner, more modern environment" },
      { label: "Remove artifacts", prompt: "Remove any AI artifacts, extra fingers, distortions, or unnatural elements" },
    ],
    copy: [
      { label: "Make shorter", prompt: "Make this copy shorter and punchier, maximum 5 words" },
      { label: "More urgency", prompt: "Add more urgency and FOMO to this copy" },
      { label: "More specific", prompt: "Make this copy more specific with numbers or concrete benefits" },
      { label: "Different hook", prompt: "Use a completely different psychological hook — try curiosity or identity instead" },
    ],
    creative: [
      { label: "Stronger headline", prompt: "The headline needs to be more scroll-stopping and impactful" },
      { label: "Better CTA", prompt: "The CTA needs to be more action-oriented and urgent" },
      { label: "Match persona", prompt: "Make the copy more relevant to the target persona's pain points" },
      { label: "Platform tone", prompt: "Adjust the tone to match the platform better" },
    ],
  };

  // Step 1: Refine the prompt using best practices
  async function handleRefine() {
    if (!prompt.trim() || !asset) return;

    setRefining(true);
    setError(null);

    try {
      const content = (asset.content || {}) as Record<string, any>;
      const res = await fetch("/api/revise/refine-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_prompt: prompt.trim(),
          revision_type: revisionType,
          context: {
            platform: asset.platform,
            actor_name: content.actor_name,
            headline: content.overlay_headline,
            format: asset.format,
            asset_type: asset.asset_type,
          },
        }),
      });

      const data = await res.json();
      setRefinedPrompt(data.refined_prompt || prompt.trim());
    } catch {
      // Fallback: use original prompt
      setRefinedPrompt(prompt.trim());
    } finally {
      setRefining(false);
    }
  }

  // Step 2: Execute the revision with the refined prompt
  async function handleExecute() {
    if (!asset) return;
    const finalPrompt = refinedPrompt || prompt.trim();
    if (!finalPrompt) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/revise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset_id: asset.id,
          revision_type: revisionType,
          prompt: finalPrompt,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Revision failed");
      }

      setResult(data);
      toast.success(
        revisionType === "image"
          ? "Image revised with Seedream 4.5"
          : revisionType === "copy"
            ? "Copy revised with Gemma 27B"
            : "Creative copy revised"
      );

      onRevisionComplete?.(asset, data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  // Combined: refine then execute
  async function handleSubmit() {
    if (!prompt.trim() || !asset) return;

    // Step 1: Refine
    setRefining(true);
    setError(null);

    try {
      const content = (asset.content || {}) as Record<string, any>;
      const refineRes = await fetch("/api/revise/refine-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_prompt: prompt.trim(),
          revision_type: revisionType,
          context: {
            platform: asset.platform,
            actor_name: content.actor_name,
            headline: content.overlay_headline,
            format: asset.format,
          },
        }),
      });

      const refineData = await refineRes.json();
      const refined = refineData.refined_prompt || prompt.trim();
      setRefinedPrompt(refined);
      setRefining(false);

      // Show the refined prompt — user can edit or confirm
      // Don't auto-execute, let them review first

    } catch {
      setRefinedPrompt(prompt.trim());
      setRefining(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose} />

      {/* Modal */}
      <div className="fixed right-0 top-0 bottom-0 w-[480px] bg-white z-50 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wand2 size={16} className="text-[#6B21A8]" />
            <h2 className="text-[14px] font-semibold text-[var(--foreground)]">Request Revision</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-[var(--muted)] cursor-pointer transition-colors"
          >
            <X size={16} className="text-[var(--muted-foreground)]" />
          </button>
        </div>

        {/* Asset Preview */}
        <div className="px-5 py-3 border-b border-[var(--border)] bg-[var(--muted)]">
          <div className="flex gap-3">
            {asset.blob_url && (
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-white flex-shrink-0">
                <img
                  src={asset.blob_url}
                  alt="Asset"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-[var(--foreground)] truncate">
                {extractField(asset.content, "actor_name", "") || extractField(asset.content, "overlay_headline", "") || asset.platform || "Asset"}
              </p>
              <p className="text-[10px] text-[var(--muted-foreground)]">
                {asset.asset_type?.replace(/_/g, " ")} · {asset.platform?.replace(/_/g, " ")} · {asset.format}
              </p>
              {content.overlay_headline && (
                <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5 italic truncate">
                  &ldquo;{content.overlay_headline}&rdquo;
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Revision Type Selector */}
        <div className="px-5 py-3 border-b border-[var(--border)]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-2">
            Revision Type
          </span>
          <div className="flex gap-2">
            {([
              { key: "image" as RevisionType, label: "Edit Image", icon: ImageIcon, desc: "Seedream 4.5" },
              { key: "copy" as RevisionType, label: "Edit Copy", icon: Type, desc: "Gemma 27B" },
              { key: "creative" as RevisionType, label: "Edit Creative", icon: Layers, desc: "Gemma + GLM-5" },
            ]).map((opt) => (
              <button
                key={opt.key}
                onClick={() => setRevisionType(opt.key)}
                className={`flex-1 p-2.5 rounded-lg border cursor-pointer transition-all text-left ${
                  revisionType === opt.key
                    ? "border-[#6B21A8]/30 bg-[#6B21A8]/5"
                    : "border-[var(--border)] hover:bg-[var(--muted)]"
                }`}
              >
                <opt.icon size={14} className={revisionType === opt.key ? "text-[#6B21A8]" : "text-[var(--muted-foreground)]"} />
                <span className={`block text-[11px] font-medium mt-1 ${revisionType === opt.key ? "text-[#6B21A8]" : "text-[var(--foreground)]"}`}>
                  {opt.label}
                </span>
                <span className="block text-[9px] text-[var(--muted-foreground)]">{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="px-5 py-3 border-b border-[var(--border)]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-2">
            Quick Actions
          </span>
          <div className="flex flex-wrap gap-1.5">
            {quickActions[revisionType].map((action) => (
              <button
                key={action.label}
                onClick={() => setPrompt(action.prompt)}
                className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[#6B21A8]/5 hover:border-[#6B21A8]/20 hover:text-[#6B21A8] cursor-pointer transition-all"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>

        {/* Prompt Input */}
        <div className="flex-1 px-5 py-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-2">
            Describe the revision
          </span>
          <textarea
            value={prompt}
            onChange={(e) => { setPrompt(e.target.value); setRefinedPrompt(null); }}
            placeholder={
              revisionType === "image"
                ? "Describe what to change in the image..."
                : revisionType === "copy"
                  ? "Describe how the copy should change..."
                  : "Describe what to improve in the creative..."
            }
            className="w-full h-24 bg-[var(--muted)] border border-[var(--border)] rounded-xl p-3 text-[13px] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] resize-none focus:outline-none focus:border-[#6B21A8]/30 focus:ring-1 focus:ring-[#6B21A8]/10"
          />

          {/* Refined Prompt Preview */}
          {refining && (
            <div className="mt-3 p-3 bg-[#6B21A8]/5 border border-[#6B21A8]/10 rounded-xl flex items-center gap-2">
              <Loader2 size={14} className="text-[#6B21A8] animate-spin" />
              <span className="text-[12px] text-[#6B21A8]">Optimizing your prompt with best practices...</span>
            </div>
          )}

          {refinedPrompt && !refining && !result && (
            <div className="mt-3 p-3 bg-[#6B21A8]/5 border border-[#6B21A8]/15 rounded-xl">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Wand2 size={12} className="text-[#6B21A8]" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B21A8]">Optimized Prompt</span>
                </div>
                <button
                  onClick={() => setRefinedPrompt(null)}
                  className="text-[10px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer"
                >
                  Edit
                </button>
              </div>
              <p className="text-[12px] text-[var(--foreground)] leading-relaxed">{refinedPrompt}</p>
              <button
                onClick={handleExecute}
                disabled={loading}
                className="mt-2 px-4 py-1.5 bg-gradient-to-r from-[#0693E3] via-[#6B21A8] to-[#9B51E0] text-white rounded-full text-[11px] font-semibold cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-md shadow-purple-500/20"
              >
                {loading ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={12} />
                    Confirm & Apply
                  </>
                )}
              </button>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 size={14} className="text-green-600" />
                <span className="text-[12px] font-medium text-green-700">Revision applied</span>
              </div>
              {result.revised && typeof result.revised === "string" && (
                <p className="text-[12px] text-green-700 leading-relaxed">{result.revised}</p>
              )}
              {result.revised && typeof result.revised === "object" && (
                <div className="text-[11px] text-green-700 space-y-0.5">
                  {result.revised.headline && <p>Headline: {result.revised.headline}</p>}
                  {result.revised.sub && <p>Sub: {result.revised.sub}</p>}
                  {result.revised.cta && <p>CTA: {result.revised.cta}</p>}
                </div>
              )}
              {result.edited_url && (
                <p className="text-[11px] text-green-600 mt-1">Image updated and saved.</p>
              )}
            </div>
          )}

          {error && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
              <AlertCircle size={14} className="text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-[12px] text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--border)] flex items-center justify-between">
          <span className="text-[10px] text-[var(--muted-foreground)]">
            {revisionType === "image" && "Seedream 4.5 Edit · $0.04/image"}
            {revisionType === "copy" && "Gemma 3 27B via NIM · Free"}
            {revisionType === "creative" && "Gemma 27B + GLM-5 · Free"}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-2 text-[12px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer transition-colors"
            >
              Cancel
            </button>
            {!refinedPrompt ? (
              <button
                onClick={handleSubmit}
                disabled={!prompt.trim() || refining}
                className="px-4 py-2 bg-gradient-to-r from-[#0693E3] via-[#6B21A8] to-[#9B51E0] text-white rounded-full text-[12px] font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-purple-500/20"
              >
                {refining ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    Optimizing...
                  </>
                ) : (
                  <>
                    <Wand2 size={13} />
                    Optimize & Preview
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleExecute}
                disabled={loading}
                className="px-4 py-2 bg-[#22c55e] text-white rounded-full text-[12px] font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-green-500/20"
              >
                {loading ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={13} />
                    Apply Revision
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
