"use client";

import { use, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Download,
  Trash2,
  Sparkles,
  Type,
  ExternalLink,
  Check,
  Loader2,
  AlertCircle,
} from "lucide-react";
import EditableField from "@/components/EditableField";
import { useAutosave, type AutosaveStatus as SaveStatus } from "@/hooks/useAutosave";
import { getPlatformMeta, PlatformLogo } from "@/lib/platforms";
import type { GeneratedAsset } from "@/lib/types";
import { toast } from "sonner";

/* ── Save indicator ─────────────────────────────────────────── */
function SaveIndicator({ statuses }: { statuses: SaveStatus[] }) {
  const worst = statuses.includes("error")
    ? "error"
    : statuses.includes("saving")
    ? "saving"
    : statuses.includes("saved")
    ? "saved"
    : "idle";

  if (worst === "idle") return null;

  return (
    <div className="flex items-center gap-1.5 text-[11px] font-medium">
      {worst === "saving" && (
        <>
          <Loader2 size={12} className="animate-spin text-amber-500" />
          <span className="text-amber-500">Saving...</span>
        </>
      )}
      {worst === "saved" && (
        <>
          <Check size={12} className="text-emerald-500" />
          <span className="text-emerald-500">Saved</span>
        </>
      )}
      {worst === "error" && (
        <>
          <AlertCircle size={12} className="text-red-500" />
          <span className="text-red-500">Save failed</span>
        </>
      )}
    </div>
  );
}

/* ── Studio Page ────────────────────────────────────────────── */
export default function StudioPage({
  params,
}: {
  params: Promise<{ id: string; assetId: string }>;
}) {
  const { id: requestId, assetId } = use(params);
  const router = useRouter();
  const [asset, setAsset] = useState<GeneratedAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [siblings, setSiblings] = useState<GeneratedAsset[]>([]);

  // Fetch asset + siblings (same request's composed creatives)
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/generate/${requestId}/images`);
        const data = await res.json();
        const all: GeneratedAsset[] = data.assets || data || [];
        const target = all.find((a) => a.id === assetId);
        const composed = all.filter(
          (a) => a.asset_type === "composed_creative" && a.blob_url,
        );
        setAsset(target || null);
        setSiblings(composed);
      } catch {
        toast.error("Failed to load creative");
      }
      setLoading(false);
    }
    load();
  }, [requestId, assetId]);

  const handleDelete = useCallback(async () => {
    if (!confirm("Delete this creative? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/assets/${assetId}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Failed to delete");
        return;
      }
      toast.success("Deleted");
      router.push(`/intake/${requestId}`);
    } catch {
      toast.error("Failed to delete");
    }
  }, [assetId, requestId, router]);

  if (loading) {
    return (
      <div className="h-screen w-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-white/30" />
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="h-screen w-screen bg-[#0a0a0a] flex flex-col items-center justify-center gap-4">
        <p className="text-white/50">Creative not found</p>
        <button
          onClick={() => router.push(`/intake/${requestId}`)}
          className="text-sm text-[#6B21A8] cursor-pointer hover:underline"
        >
          Back to campaign
        </button>
      </div>
    );
  }

  return (
    <StudioLayout
      asset={asset}
      siblings={siblings}
      requestId={requestId}
      onBack={() => router.push(`/intake/${requestId}`)}
      onDelete={handleDelete}
      onNavigate={(id) => router.push(`/intake/${requestId}/studio/${id}`)}
    />
  );
}

/* ── Studio Layout ──────────────────────────────────────────── */
function StudioLayout({
  asset,
  siblings,
  requestId,
  onBack,
  onDelete,
  onNavigate,
}: {
  asset: GeneratedAsset;
  siblings: GeneratedAsset[];
  requestId: string;
  onBack: () => void;
  onDelete: () => void;
  onNavigate: (assetId: string) => void;
}) {
  const content = (asset.content || {}) as Record<string, string>;
  const copyData = (asset.copy_data || content.copy_data || {}) as Record<
    string,
    string
  >;
  const meta = getPlatformMeta(asset.platform);
  const score = asset.evaluation_score || 0;

  // Autosave hooks
  const h1 = useAutosave(asset.id, "content", "overlay_headline");
  const sub = useAutosave(asset.id, "content", "overlay_sub");
  const cta = useAutosave(asset.id, "content", "overlay_cta");
  const pt = useAutosave(asset.id, "copy_data", "primary_text");
  const adH = useAutosave(asset.id, "copy_data", "headline");
  const desc = useAutosave(asset.id, "copy_data", "description");
  const allStatuses = [h1.status, sub.status, cta.status, pt.status, adH.status, desc.status];

  // Find sibling index for prev/next
  const currentIdx = siblings.findIndex((s) => s.id === asset.id);

  return (
    <div className="h-screen w-screen flex bg-[#0a0a0a] overflow-hidden">
      {/* ── LEFT: Preview ─────────────────────────────────── */}
      <div className="flex-[6] flex flex-col min-w-0">
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-3 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/8 text-white/70 text-xs cursor-pointer hover:bg-white/15 hover:text-white transition-colors"
            >
              <ArrowLeft size={14} />
              Campaign
            </button>
            <div className="h-4 w-px bg-white/10" />
            <div className="flex items-center gap-2">
              <PlatformLogo brand={meta.brand} className="w-4 h-4 opacity-60" />
              <span className="text-white/50 text-xs">
                {meta.label} &middot; {asset.format}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {score > 0 && (
              <span
                className={`text-[11px] font-medium px-2.5 py-1 rounded-md ${
                  score >= 0.85
                    ? "bg-emerald-500/10 text-emerald-400"
                    : score >= 0.7
                    ? "bg-amber-500/10 text-amber-400"
                    : "bg-red-500/10 text-red-400"
                }`}
              >
                {(score * 100).toFixed(0)}% VQA
              </span>
            )}
            <SaveIndicator statuses={allStatuses} />
          </div>
        </div>

        {/* Preview image */}
        <div className="flex-1 flex items-center justify-center p-8 min-h-0">
          {asset.blob_url ? (
            <img
              src={asset.blob_url}
              alt=""
              className="max-w-full max-h-full rounded-xl object-contain select-none"
              style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.6)" }}
              draggable={false}
            />
          ) : (
            <div
              className="w-64 h-64 rounded-xl flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #3D1059, #6B21A8, #E91E8C)",
                boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
              }}
            >
              <span className="text-white/40 text-sm">No preview</span>
            </div>
          )}
        </div>

        {/* Bottom: sibling strip */}
        {siblings.length > 1 && (
          <div className="px-5 pb-4 shrink-0">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
              {siblings.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => onNavigate(s.id)}
                  className={`shrink-0 rounded-lg overflow-hidden cursor-pointer transition-all ${
                    s.id === asset.id
                      ? "ring-2 ring-[#6B21A8] ring-offset-2 ring-offset-[#0a0a0a] scale-105"
                      : "opacity-40 hover:opacity-70"
                  }`}
                  style={{ width: 48, height: 48 }}
                >
                  {s.blob_url ? (
                    <img
                      src={s.blob_url}
                      alt={`Creative ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#3D1059] to-[#6B21A8]" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── RIGHT: Edit Panel ─────────────────────────────── */}
      <div className="flex-[3] bg-white flex flex-col border-l border-[#E5E5E5] min-w-[340px] max-w-[440px]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#f0f0f0] shrink-0">
          <h2 className="text-sm font-bold text-[#1A1A1A] tracking-tight">
            Edit Creative
          </h2>
          <p className="text-[11px] text-[#999] mt-0.5">
            {content.actor_name && `${content.actor_name} · `}
            {meta.label} · {asset.format}
          </p>
        </div>

        {/* Scrollable fields */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 min-h-0">
          {/* Overlay Text */}
          <div className="text-[10px] font-bold text-[#6B21A8] uppercase tracking-[1px]">
            Overlay Text
          </div>

          <FieldRow label="Headline">
            <EditableField
              value={content.overlay_headline || copyData.headline || ""}
              editable
              onSave={h1.save}
              textClassName="text-[14px] font-semibold text-[#1A1A1A]"
            />
          </FieldRow>

          <FieldRow label="Subheadline">
            <EditableField
              value={content.overlay_sub || copyData.description || ""}
              editable
              onSave={sub.save}
              textClassName="text-[13px] text-[#555] leading-relaxed"
              multiline
            />
          </FieldRow>

          <FieldRow label="CTA Button">
            <EditableField
              value={content.overlay_cta || copyData.cta || "Apply Now"}
              editable
              onSave={cta.save}
              textClassName="text-[13px] font-medium text-[#6B21A8]"
            />
          </FieldRow>

          <div className="h-px bg-[#f0f0f0]" />

          {/* Platform Ad Copy */}
          <div className="text-[10px] font-bold text-[#6B21A8] uppercase tracking-[1px]">
            Platform Ad Copy
          </div>

          <FieldRow label="Primary Text">
            <EditableField
              value={
                copyData.primary_text ||
                copyData.introductory_text ||
                copyData.message_text ||
                ""
              }
              editable
              onSave={pt.save}
              textClassName="text-[13px] text-[#1A1A1A] leading-relaxed"
              multiline
            />
          </FieldRow>

          <FieldRow label="Ad Headline">
            <EditableField
              value={copyData.headline || copyData.card_headline || ""}
              editable
              onSave={adH.save}
              textClassName="text-[13px] text-[#1A1A1A]"
            />
          </FieldRow>

          <FieldRow label="Description">
            <EditableField
              value={copyData.description || copyData.card_description || ""}
              editable
              onSave={desc.save}
              textClassName="text-[13px] text-[#555]"
            />
          </FieldRow>
        </div>

        {/* Action bar */}
        <div className="px-6 py-3.5 border-t border-[#f0f0f0] shrink-0 space-y-2">
          <div className="flex gap-2">
            {(content.creative_html || content.html) && (
              <button className="btn-primary text-[11px] px-4 py-1.5 cursor-pointer flex items-center gap-1.5">
                <Type size={13} /> Edit HTML
              </button>
            )}
            <button
              onClick={() =>
                window.open(`/api/export/figma/${asset.id}`, "_blank")
              }
              className="btn-primary text-[11px] px-4 py-1.5 cursor-pointer flex items-center gap-1.5"
            >
              <ExternalLink size={13} /> Figma
            </button>
            {asset.blob_url && (
              <button
                onClick={() => window.open(asset.blob_url!, "_blank")}
                className="btn-secondary text-[11px] px-4 py-1.5 cursor-pointer flex items-center gap-1.5"
              >
                <Download size={13} /> Download
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary text-[11px] px-4 py-1.5 cursor-pointer flex items-center gap-1.5 flex-1 justify-center">
              <Sparkles size={13} /> Regenerate
            </button>
            <button
              onClick={onDelete}
              className="text-[11px] px-4 py-1.5 rounded-full border border-red-200 text-red-500 cursor-pointer hover:bg-red-50 transition-colors flex items-center gap-1.5"
            >
              <Trash2 size={13} /> Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Field Row ──────────────────────────────────────────────── */
function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[10px] font-semibold text-[#999] uppercase tracking-[0.5px] block mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
