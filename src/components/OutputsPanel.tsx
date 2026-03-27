"use client";

import { X, Download, FileText } from "lucide-react";
import CreativeGrid from "./CreativeGrid";
import EvaluationScores from "./EvaluationScores";
import type { GeneratedAsset } from "@/lib/types";

interface OutputsPanelProps {
  open: boolean;
  onClose: () => void;
  assets: GeneratedAsset[];
  requestId: string;
  evaluationData?: Record<string, number> | null;
  hasBrief?: boolean;
}

export default function OutputsPanel({
  open,
  onClose,
  assets,
  requestId,
  evaluationData,
  hasBrief,
}: OutputsPanelProps) {
  if (!open) return null;

  function handleDownloadAll() {
    window.open(`/api/export/${requestId}`, "_blank");
  }

  function handleDownloadAsset(asset: GeneratedAsset) {
    if (asset.blob_url) {
      window.open(asset.blob_url, "_blank");
    }
  }

  return (
    <div className="w-[420px] shrink-0 border-l border-[var(--border)] bg-white h-full overflow-y-auto slide-in">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-white border-b border-[var(--border)] px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadAll}
            className="btn-secondary text-xs px-3 py-1.5 cursor-pointer"
            title="Download All"
          >
            <Download size={14} />
            Download All
          </button>
          <h2 className="text-sm font-semibold text-[var(--foreground)]">Outputs</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-[var(--muted)] cursor-pointer transition-colors"
          aria-label="Close outputs panel"
        >
          <X size={18} className="text-[var(--muted-foreground)]" />
        </button>
      </div>

      <div className="p-5 space-y-6">
        {/* Reports section */}
        {hasBrief && (
          <div>
            <p className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">
              Reports
            </p>
            <button
              className="w-full flex items-center gap-3 p-3 rounded-[var(--radius-sm)] border border-[var(--border)] hover:bg-[var(--muted)] cursor-pointer transition-colors text-left"
              onClick={() => {
                const el = document.getElementById("brief-section");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
            >
              <FileText size={16} className="text-[var(--muted-foreground)]" />
              <span className="text-sm font-medium text-[var(--foreground)]">
                Creative Brief & Channel Strategy
              </span>
            </button>
          </div>
        )}

        {/* Generated Ads */}
        {assets.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-3">
              Generated Ads
            </p>
            <CreativeGrid assets={assets} onDownload={handleDownloadAsset} />
          </div>
        )}

        {/* Evaluation */}
        {evaluationData && Object.keys(evaluationData).length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-3">
              Evaluation
            </p>
            <EvaluationScores scores={evaluationData} />
          </div>
        )}
      </div>
    </div>
  );
}
