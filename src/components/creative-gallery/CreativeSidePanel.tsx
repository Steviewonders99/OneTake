"use client";

import { useState, useEffect, useCallback } from "react";
import { X, ChevronLeft, Type, Download, Pencil, Trash2, Sparkles } from "lucide-react";
import type { GeneratedAsset } from "@/lib/types";
import type { VersionGroup, ChannelDef } from "@/lib/channels";
import { ARCHETYPE_LABELS, getThumbnailDimensions } from "@/lib/channels";
import { getPlatformMeta } from "@/lib/platforms";
import EditableField from "@/components/EditableField";
import AutosaveStatus from "@/components/AutosaveStatus";
import { useAutosave } from "@/hooks/useAutosave";

interface CreativeSidePanelProps {
  version: VersionGroup;
  channelDef: ChannelDef;
  initialAsset: GeneratedAsset;
  onClose: () => void;
  onRefine?: (asset: GeneratedAsset) => void;
  onDelete?: (asset: GeneratedAsset) => void;
  onEditHtml?: (asset: GeneratedAsset) => void;
}

function FormatSwitcherThumb({
  asset,
  format,
  isActive,
  onClick,
}: {
  asset: GeneratedAsset;
  format: { label: string; width: number; height: number };
  isActive: boolean;
  onClick: () => void;
}) {
  const dims = getThumbnailDimensions(
    { key: "", label: format.label, ratio: "", width: format.width, height: format.height },
    44,
  );
  return (
    <div className="text-center cursor-pointer" onClick={onClick}>
      <div
        className="rounded-lg overflow-hidden transition-all"
        style={{
          width: `${dims.width}px`,
          height: `${dims.height}px`,
          border: isActive ? "2px solid #6B21A8" : "1px solid rgba(255,255,255,0.2)",
          boxShadow: isActive ? "0 0 12px rgba(107,33,168,0.3)" : "none",
          opacity: isActive ? 1 : 0.5,
        }}
      >
        {asset.blob_url ? (
          <img src={asset.blob_url} alt={format.label} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full" style={{ background: "linear-gradient(135deg, #3D1059, #6B21A8)" }} />
        )}
      </div>
      <div className={`text-[9px] mt-1 ${isActive ? "text-[#6B21A8] font-semibold" : "text-white/50"}`}>
        {format.label}
      </div>
    </div>
  );
}

function SidePanelEditFields({ asset }: { asset: GeneratedAsset }) {
  const content = (asset.content || {}) as Record<string, string>;
  const copyData = (asset.copy_data || content.copy_data || {}) as Record<string, string>;

  const headlineSave = useAutosave(asset.id, "content", "overlay_headline");
  const subSave = useAutosave(asset.id, "content", "overlay_sub");
  const ctaSave = useAutosave(asset.id, "content", "overlay_cta");
  const primaryTextSave = useAutosave(asset.id, "copy_data", "primary_text");
  const adHeadlineSave = useAutosave(asset.id, "copy_data", "headline");
  const descSave = useAutosave(asset.id, "copy_data", "description");

  // Aggregate status: show worst status across all fields
  const allStatuses = [
    headlineSave.status, subSave.status, ctaSave.status,
    primaryTextSave.status, adHeadlineSave.status, descSave.status,
  ];
  const aggregateStatus = allStatuses.includes("error")
    ? "error" as const
    : allStatuses.includes("saving")
    ? "saving" as const
    : allStatuses.includes("saved")
    ? "saved" as const
    : "idle" as const;

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
      {/* Overlay Text Section */}
      <div className="text-[10px] font-bold text-[#6B21A8] uppercase tracking-[1px]">
        Overlay Text
      </div>

      <div>
        <label className="text-[10px] font-semibold text-[#999] uppercase tracking-[0.5px] block mb-1">
          Headline
        </label>
        <EditableField
          value={content.overlay_headline || copyData.headline || ""}
          editable
          onSave={headlineSave.save}
          textClassName="text-[14px] font-semibold text-[#1A1A1A]"
        />
      </div>

      <div>
        <label className="text-[10px] font-semibold text-[#999] uppercase tracking-[0.5px] block mb-1">
          Subheadline
        </label>
        <EditableField
          value={content.overlay_sub || copyData.description || ""}
          editable
          onSave={subSave.save}
          textClassName="text-[13px] text-[#737373] leading-relaxed"
          multiline
        />
      </div>

      <div>
        <label className="text-[10px] font-semibold text-[#999] uppercase tracking-[0.5px] block mb-1">
          CTA Button
        </label>
        <EditableField
          value={content.overlay_cta || copyData.cta || "Apply Now"}
          editable
          onSave={ctaSave.save}
          textClassName="text-[13px] font-medium text-[#6B21A8]"
        />
      </div>

      {/* Divider */}
      <div className="h-px bg-[#f0f0f0] my-1" />

      {/* Platform Ad Copy Section */}
      <div className="text-[10px] font-bold text-[#6B21A8] uppercase tracking-[1px]">
        Platform Ad Copy
      </div>

      <div>
        <label className="text-[10px] font-semibold text-[#999] uppercase tracking-[0.5px] block mb-1">
          Primary Text
        </label>
        <EditableField
          value={copyData.primary_text || copyData.introductory_text || copyData.message_text || ""}
          editable
          onSave={primaryTextSave.save}
          textClassName="text-[13px] text-[#1A1A1A] leading-relaxed"
          multiline
        />
      </div>

      <div>
        <label className="text-[10px] font-semibold text-[#999] uppercase tracking-[0.5px] block mb-1">
          Ad Headline
        </label>
        <EditableField
          value={copyData.headline || copyData.card_headline || ""}
          editable
          onSave={adHeadlineSave.save}
          textClassName="text-[13px] text-[#1A1A1A]"
        />
      </div>

      <div>
        <label className="text-[10px] font-semibold text-[#999] uppercase tracking-[0.5px] block mb-1">
          Description
        </label>
        <EditableField
          value={copyData.description || copyData.card_description || ""}
          editable
          onSave={descSave.save}
          textClassName="text-[13px] text-[#737373]"
        />
      </div>

      {/* Autosave indicator */}
      <div className="pt-1">
        <AutosaveStatus status={aggregateStatus} />
      </div>
    </div>
  );
}

export default function CreativeSidePanel({
  version,
  channelDef,
  initialAsset,
  onClose,
  onRefine,
  onDelete,
  onEditHtml,
}: CreativeSidePanelProps) {
  const [activeAsset, setActiveAsset] = useState<GeneratedAsset>(initialAsset);
  const [isClosing, setIsClosing] = useState(false);

  const content = (activeAsset.content || {}) as Record<string, string>;
  const meta = getPlatformMeta(activeAsset.platform);
  const score = activeAsset.evaluation_score || 0;
  const archetypeLabel = ARCHETYPE_LABELS[version.archetype] || version.archetype;

  // Match assets to formats for the switcher
  const formatAssets: Array<{ asset: GeneratedAsset; format: typeof channelDef.formats[0] }> = [];
  for (const format of channelDef.formats) {
    const match = version.assets.find((a) => {
      const p = a.platform;
      if (format.key === "feed" && (p.includes("_feed") || p === "wechat_moments")) return true;
      if (format.key === "story" && (p.includes("_story") || p.includes("_stories") || p === "whatsapp_story")) return true;
      if (format.key === "carousel" && p.includes("_carousel")) return true;
      if (format.key === "card" && p.includes("_card")) return true;
      if (format.key === "post" && p.includes("_post")) return true;
      if (format.key === "display" && p.includes("_display")) return true;
      if (format.key === "banner" && p.includes("_banner")) return true;
      if (format.key === "moments" && p === "wechat_moments") return true;
      if (format.key === "channels" && p === "wechat_channels") return true;
      if (format.key.startsWith("carousel_") && p.includes("_carousel")) return true;
      return false;
    });
    if (match) formatAssets.push({ asset: match, format });
  }

  // Close with animation
  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(onClose, 150);
  }, [onClose]);

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleClose]);

  // Scroll to top on open
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex h-full w-full">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 transition-opacity duration-200 ${
          isClosing ? "opacity-0" : "opacity-100"
        }`}
        style={{ background: "rgba(0,0,0,0.3)" }}
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        className={`relative ml-auto flex transition-transform duration-200 ease-out ${
          isClosing ? "translate-x-full" : "translate-x-0"
        }`}
        style={{ width: "100%", height: "100%" }}
      >
        {/* LEFT: Dark Preview */}
        <div className="flex-[6] bg-[#0a0a0a] flex flex-col relative overflow-hidden">
          {/* Top bar */}
          <div className="px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={handleClose}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/10 text-white text-xs cursor-pointer hover:bg-white/20 transition-colors"
              >
                <ChevronLeft size={14} /> Back
              </button>
              <div className="h-5 w-px bg-white/15" />
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#6B21A8] to-[#E91E8C] flex items-center justify-center text-white font-extrabold text-[9px]">
                  {version.versionLabel}
                </div>
                <span className="text-white/60 text-xs">
                  {version.actorName} &middot; {archetypeLabel} &middot; {version.pillar.charAt(0).toUpperCase() + version.pillar.slice(1)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {score > 0 && (
                <span className={`text-[11px] font-medium px-2.5 py-1 rounded-lg ${
                  score >= 0.85 ? "bg-green-500/15 text-green-400" : score >= 0.7 ? "bg-yellow-500/15 text-yellow-400" : "bg-red-500/15 text-red-400"
                }`}>
                  {score.toFixed(2)} VQA
                </span>
              )}
              <button
                onClick={handleClose}
                className="p-2 rounded-lg bg-white/8 hover:bg-white/15 text-white cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Preview */}
          <div className="flex-1 flex items-center justify-center p-6 min-h-0 overflow-hidden">
            {activeAsset.blob_url ? (
              <img
                src={activeAsset.blob_url}
                alt=""
                className="rounded-2xl object-contain"
                style={{
                  maxWidth: "100%",
                  maxHeight: "calc(100vh - 160px)",
                  boxShadow: "0 12px 48px rgba(0,0,0,0.5)",
                }}
              />
            ) : (
              <div
                className="w-[280px] h-[280px] rounded-2xl flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg, #3D1059, #6B21A8, #E91E8C)",
                  boxShadow: "0 12px 48px rgba(0,0,0,0.5)",
                }}
              >
                <span className="text-white/50 text-sm">No preview</span>
              </div>
            )}
          </div>

          {/* Format switcher */}
          {formatAssets.length > 1 && (
            <div className="px-5 pb-5 flex items-center justify-center gap-3">
              {formatAssets.map(({ asset, format }) => (
                <FormatSwitcherThumb
                  key={format.key}
                  asset={asset}
                  format={format}
                  isActive={asset.id === activeAsset.id}
                  onClick={() => setActiveAsset(asset)}
                />
              ))}
            </div>
          )}
        </div>

        {/* RIGHT: Edit Panel */}
        <div className="flex-[4] bg-white border-l border-[#E5E5E5] flex flex-col h-screen overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-[#f0f0f0]">
            <div className="text-sm font-bold text-[#1A1A1A]">Edit Creative</div>
            <div className="text-[11px] text-[#999] mt-0.5">
              {meta.label} &middot; {activeAsset.format}
            </div>
          </div>

          {/* Edit fields — key on asset ID so hooks reinitialize on format switch */}
          <SidePanelEditFields key={activeAsset.id} asset={activeAsset} />

          {/* Action bar */}
          <div className="px-6 py-3.5 border-t border-[#f0f0f0] flex gap-2 flex-wrap">
            {onEditHtml && (content.creative_html || content.html) && (
              <button
                onClick={() => { onEditHtml(activeAsset); handleClose(); }}
                className="btn-primary text-[11px] px-4 py-1.5 cursor-pointer flex items-center gap-1.5"
              >
                <Type size={13} /> Edit HTML
              </button>
            )}
            <button
              onClick={() => {
                window.open(`/api/export/figma/${activeAsset.id}`, "_blank");
              }}
              className="btn-primary text-[11px] px-4 py-1.5 cursor-pointer"
            >
              Export Figma
            </button>
            {activeAsset.blob_url && (
              <button
                onClick={() => window.open(activeAsset.blob_url!, "_blank")}
                className="btn-secondary text-[11px] px-4 py-1.5 cursor-pointer flex items-center gap-1.5"
              >
                <Download size={13} /> Download
              </button>
            )}
            {onRefine && (
              <button
                onClick={() => { onRefine(activeAsset); handleClose(); }}
                className="btn-secondary text-[11px] px-4 py-1.5 cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles size={13} /> Regenerate
              </button>
            )}
            <div className="flex-1" />
            {onDelete && (
              <button
                onClick={() => { onDelete(activeAsset); handleClose(); }}
                className="text-[11px] px-4 py-1.5 rounded-full border border-red-200 text-red-600 cursor-pointer hover:bg-red-50 transition-colors flex items-center gap-1.5"
              >
                <Trash2 size={13} /> Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
