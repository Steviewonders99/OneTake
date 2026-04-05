"use client";

import { useState } from "react";
import ImageLoader from "@/components/ui/image-loading";
import {
  Download,
  ChevronDown,
  ChevronUp,
  Upload,
  ImageIcon,
} from "lucide-react";
import type { GeneratedAsset } from "@/lib/types";
import DesignerNoteInput from "./DesignerNoteInput";

interface DesignerNote {
  id: string;
  request_id: string;
  asset_id: string;
  note_text: string;
  created_at: string;
}

interface DesignerAssetCardProps {
  asset: GeneratedAsset;
  actorName?: string;
  requestId: string;
  token: string;
  notes: DesignerNote[];
  onNoteSaved: (note: DesignerNote) => void;
  onUploadReplacement: (assetId: string, file: File) => void;
}

function platformColor(platform: string): string {
  const colors: Record<string, string> = {
    linkedin: "#0A66C2",
    facebook: "#1877F2",
    instagram: "#E4405F",
    twitter: "#1DA1F2",
    telegram: "#0088CC",
    tiktok: "#000000",
  };
  return colors[platform.toLowerCase()] ?? "var(--oneforma-charcoal)";
}

function extractDesignNotes(asset: GeneratedAsset): Record<string, string> {
  const notes: Record<string, string> = {};
  const content = asset.content as Record<string, unknown> | null;
  const evalData = asset.evaluation_data as Record<string, unknown> | null;

  if (content) {
    if (typeof content.composition === "string") notes["Composition"] = content.composition;
    if (typeof content.camera_angle === "string") notes["Camera Angle"] = content.camera_angle;
    if (typeof content.lighting === "string") notes["Lighting"] = content.lighting;
    if (typeof content.template === "string") notes["Template"] = content.template;
    if (typeof content.template_name === "string") notes["Template"] = content.template_name;
    if (typeof content.backdrop === "string") notes["Backdrop"] = content.backdrop;
    if (typeof content.style === "string") notes["Style"] = content.style;
    if (typeof content.art_direction === "string") notes["Art Direction"] = content.art_direction;
    if (typeof content.prompt === "string") {
      // Truncate the prompt to a useful excerpt
      notes["Prompt"] = content.prompt.length > 120
        ? content.prompt.slice(0, 120) + "..."
        : content.prompt;
    }
  }

  if (evalData) {
    if (typeof evalData.composition_technique === "string") notes["Composition"] = evalData.composition_technique;
    if (typeof evalData.notes === "string") notes["Evaluator Notes"] = evalData.notes;
  }

  return notes;
}

export default function DesignerAssetCard({
  asset,
  actorName,
  requestId,
  token,
  notes,
  onNoteSaved,
  onUploadReplacement,
}: DesignerAssetCardProps) {
  const [showDesignNotes, setShowDesignNotes] = useState(false);
  const score = asset.evaluation_score;
  const designNotes = extractDesignNotes(asset);
  const hasDesignNotes = Object.keys(designNotes).length > 0;

  function handleDownload() {
    if (asset.blob_url) window.open(asset.blob_url, "_blank");
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      onUploadReplacement(asset.id, file);
    }
    // Reset input so the same file can be selected again
    e.target.value = "";
  }

  return (
    <div className="card overflow-hidden">
      {/* Image area */}
      <div className="relative bg-[var(--muted)] aspect-square flex items-center justify-center overflow-hidden">
        {asset.blob_url ? (
          <ImageLoader
            src={asset.blob_url}
            alt={`${asset.platform} ${asset.format}`}
            width="500"
            height="500"
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
          <ImageIcon size={40} className="text-[var(--muted-foreground)] opacity-30" />
        )}

        {/* Platform badge */}
        <span
          className="absolute top-2.5 right-2.5 text-white text-[12px] font-semibold px-2 py-0.5 rounded-full"
          style={{ background: platformColor(asset.platform) }}
        >
          {asset.platform}
        </span>

        {/* Score badge */}
        {score !== null && score !== undefined && (
          <span
            className={`absolute top-2.5 left-2.5 text-[13px] font-bold px-2 py-0.5 rounded-full ${
              score >= 0.8
                ? "bg-green-50 text-green-700"
                : score >= 0.6
                  ? "bg-yellow-50 text-yellow-700"
                  : "bg-red-50 text-red-700"
            }`}
          >
            {(score * 100).toFixed(0)}%
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-3 md:p-4 space-y-3">
        {/* Title row */}
        <div>
          <p className="text-sm font-medium text-[var(--foreground)]">
            {actorName || asset.format.replace(/_/g, " ")}
          </p>
          <p className="text-xs text-[var(--muted-foreground)]">
            {asset.format.replace(/_/g, " ")} &middot; {asset.language}
            {asset.asset_type === "base_image" && " &middot; Character"}
            {asset.asset_type === "composed_creative" && " &middot; Composed"}
          </p>
        </div>

        {/* Design Notes toggle */}
        {hasDesignNotes && (
          <div>
            <button
              onClick={() => setShowDesignNotes(!showDesignNotes)}
              className="flex items-center gap-1 text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer transition-colors"
            >
              {showDesignNotes ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              Design Notes
            </button>
            {showDesignNotes && (
              <div className="mt-2 p-3 bg-[var(--muted)] rounded-[var(--radius-sm)] space-y-1.5">
                {Object.entries(designNotes).map(([key, value]) => (
                  <div key={key}>
                    <span className="text-[12px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
                      {key}
                    </span>
                    <p className="text-xs text-[var(--foreground)] leading-relaxed">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Evaluation breakdown */}
        {asset.evaluation_data && typeof asset.evaluation_data === "object" && (
          <div className="flex flex-wrap gap-1">
            {Object.entries(asset.evaluation_data as Record<string, unknown>)
              .filter(([k, v]) => k !== "overall" && k !== "notes" && typeof v === "number")
              .slice(0, 4)
              .map(([key, value]) => (
                <span
                  key={key}
                  className="tag-pill text-[12px]"
                  title={`${key}: ${((value as number) * 100).toFixed(0)}%`}
                >
                  {key.replace(/_/g, " ")}: {((value as number) * 100).toFixed(0)}%
                </span>
              ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--border)]">
          <button
            onClick={handleDownload}
            disabled={!asset.blob_url}
            className="flex items-center gap-1 text-xs font-medium text-[var(--foreground)] hover:text-[var(--oneforma-charcoal)] cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download size={14} />
            Download
          </button>

          <label className="flex items-center gap-1 text-xs font-medium text-[var(--foreground)] hover:text-[var(--oneforma-charcoal)] cursor-pointer transition-colors">
            <Upload size={14} />
            Replace
            <input
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={handleFileSelect}
            />
          </label>
        </div>

        {/* Notes */}
        <DesignerNoteInput
          requestId={requestId}
          assetId={asset.id}
          token={token}
          existingNotes={notes}
          onNoteSaved={onNoteSaved}
        />
      </div>
    </div>
  );
}
