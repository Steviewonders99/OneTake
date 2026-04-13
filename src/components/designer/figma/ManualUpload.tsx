"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { Upload, Check, AlertTriangle, X, Loader2 } from "lucide-react";
import { parseFrameName } from "@/lib/figma-client";
import type { NovaFrameRouting } from "@/lib/figma-client";
import type { Theme } from "../gallery/tokens";
import { FONT } from "../gallery/tokens";
import type { GeneratedAsset } from "@/lib/types";

// ── Types ────────────────────────────────────────────────────

interface FileEntry {
  file: File;
  routing: NovaFrameRouting | null;
  matchedAssetId: string | null;
  status: "pending" | "uploading" | "done" | "error";
  /** Manual routing overrides for unmatched files */
  manualPersona: string;
  manualVersion: string;
  manualPlatform: string;
}

interface ManualUploadProps {
  requestId: string;
  theme: Theme;
  assets: GeneratedAsset[];
  personas: Array<{ persona_name?: string; archetype_key?: string }>;
  onUploaded: () => void;
  onClose: () => void;
}

// ── Helpers ──────────────────────────────────────────────────

function matchAsset(
  assets: GeneratedAsset[],
  persona: string,
  platform: string,
): string | null {
  const lower = persona.toLowerCase();
  for (const a of assets) {
    if (a.asset_type !== "composed_creative") continue;
    const content = (a.content || {}) as Record<string, string>;
    const assetPersona = (
      content.persona ||
      content.actor_name?.split(" ")[0] ||
      ""
    ).toLowerCase();
    const assetPlatform = (a.platform || "").toLowerCase();
    if (assetPersona === lower && assetPlatform === platform.toLowerCase()) {
      return a.id;
    }
  }
  return null;
}

function uniquePlatforms(assets: GeneratedAsset[]): string[] {
  const set = new Set<string>();
  for (const a of assets) {
    if (a.platform) set.add(a.platform);
  }
  return Array.from(set).sort();
}

const VERSIONS = ["V1", "V2", "V3", "V4", "V5"];

// ── Component ────────────────────────────────────────────────

export default function ManualUpload({
  requestId,
  theme,
  assets,
  personas,
  onUploaded,
  onClose,
}: ManualUploadProps) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const platforms = uniquePlatforms(assets);

  // ── Escape key ──────────────────────────────────────────
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isProcessing) onClose();
    },
    [onClose, isProcessing],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [handleEscape]);

  // ── File processing ─────────────────────────────────────
  function processFiles(incoming: FileList | File[]) {
    const entries: FileEntry[] = [];
    for (const file of Array.from(incoming)) {
      if (!file.type.startsWith("image/")) continue;
      const baseName = file.name.replace(/\.[^.]+$/, "");
      const routing = parseFrameName(baseName);
      const matched = routing
        ? matchAsset(assets, routing.persona, routing.platform)
        : null;
      entries.push({
        file,
        routing,
        matchedAssetId: matched,
        status: "pending",
        manualPersona: personas[0]?.persona_name?.split(" ")[0] || "",
        manualVersion: "V1",
        manualPlatform: platforms[0] || "",
      });
    }
    setFiles((prev) => [...prev, ...entries]);
  }

  // ── Drag handlers ───────────────────────────────────────
  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }
  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  }
  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      e.target.value = "";
    }
  }

  // ── Manual routing update ───────────────────────────────
  function updateManual(
    idx: number,
    field: "manualPersona" | "manualVersion" | "manualPlatform",
    value: string,
  ) {
    setFiles((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      // Re-match asset when manual routing changes
      const entry = next[idx];
      const persona =
        field === "manualPersona" ? value : entry.manualPersona;
      const platform =
        field === "manualPlatform" ? value : entry.manualPlatform;
      entry.matchedAssetId = matchAsset(assets, persona, platform);
      return next;
    });
  }

  // ── Remove file ─────────────────────────────────────────
  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  // ── Upload all ──────────────────────────────────────────
  async function handleReplaceAll() {
    setIsProcessing(true);
    let doneCount = 0;

    for (let i = 0; i < files.length; i++) {
      const entry = files[i];
      if (entry.status === "done") {
        doneCount++;
        continue;
      }

      // Mark uploading
      setFiles((prev) => {
        const next = [...prev];
        next[i] = { ...next[i], status: "uploading" };
        return next;
      });

      try {
        // Resolve the asset ID: use auto-matched or manual routing
        let assetId = entry.matchedAssetId;
        if (!assetId && !entry.routing) {
          assetId = matchAsset(
            assets,
            entry.manualPersona,
            entry.manualPlatform,
          );
        }

        // Step 1: Upload file to blob
        const formData = new FormData();
        formData.append("file", entry.file);
        if (assetId) {
          formData.append("original_asset_id", assetId);
        }

        const uploadRes = await fetch(
          `/api/designer/${requestId}/upload`,
          { method: "POST", body: formData },
        );

        if (!uploadRes.ok) {
          throw new Error("Upload failed");
        }

        const uploadData = (await uploadRes.json()) as { blob_url?: string };

        // Step 2: If matched, replace the asset's blob_url
        if (assetId && uploadData.blob_url) {
          const replaceRes = await fetch("/api/designer/replace", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              asset_id: assetId,
              new_blob_url: uploadData.blob_url,
              edit_description: "Manual upload replacement",
            }),
          });

          if (!replaceRes.ok) {
            throw new Error("Replace failed");
          }
        }

        // Mark done
        setFiles((prev) => {
          const next = [...prev];
          next[i] = { ...next[i], status: "done" };
          return next;
        });
        doneCount++;
      } catch {
        setFiles((prev) => {
          const next = [...prev];
          next[i] = { ...next[i], status: "error" };
          return next;
        });
      }
    }

    setIsProcessing(false);
    if (doneCount > 0) {
      toast.success(`Uploaded ${doneCount} file${doneCount === 1 ? "" : "s"}`);
      onUploaded();
    }
  }

  // ── Styles ──────────────────────────────────────────────
  const selectStyle: React.CSSProperties = {
    height: 32,
    padding: "0 8px",
    borderRadius: 8,
    border: `1px solid ${theme.border}`,
    background: theme.bg,
    color: theme.text,
    fontFamily: FONT.sans,
    fontSize: 12,
    cursor: "pointer",
    outline: "none",
  };

  const pendingCount = files.filter((f) => f.status === "pending").length;
  const allDone =
    files.length > 0 && files.every((f) => f.status === "done");

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 700,
          maxWidth: "92vw",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          background: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: 16,
          boxShadow: "0 24px 80px rgba(0,0,0,0.4)",
          fontFamily: FONT.sans,
        }}
      >
        {/* ── Header ──────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "24px 28px 0",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Upload size={18} color={theme.text} />
            <h2
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 700,
                color: theme.text,
              }}
            >
              Upload Creatives
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: "none",
              background: "transparent",
              color: theme.textMuted,
              cursor: isProcessing ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "color 0.15s ease",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Body (scrollable) ───────────────────────────── */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px 28px 28px",
          }}
        >
          {/* ── Drop Zone ───────────────────────────────── */}
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: 36,
              borderRadius: 12,
              border: `2px dashed ${isDragging ? "#22c55e" : theme.border}`,
              background: isDragging
                ? "rgba(34,197,94,0.06)"
                : theme.bg,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
              cursor: "pointer",
              transition: "all 0.2s ease",
              marginBottom: files.length > 0 ? 20 : 0,
            }}
          >
            <Upload
              size={28}
              color={isDragging ? "#22c55e" : theme.textMuted}
            />
            <span
              style={{
                fontSize: 14,
                color: isDragging ? "#22c55e" : theme.textMuted,
                fontWeight: 500,
              }}
            >
              Drop files here or click to browse
            </span>
            <span
              style={{
                fontSize: 12,
                color: theme.textDim,
              }}
            >
              Accepts PNG, JPG, WebP, AVIF
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={onFileInputChange}
              style={{ display: "none" }}
            />
          </div>

          {/* ── Routing Table ───────────────────────────── */}
          {files.length > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {files.map((entry, idx) => (
                <div
                  key={`${entry.file.name}-${idx}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: `1px solid ${theme.border}`,
                    background: theme.bg,
                  }}
                >
                  {/* Status icon */}
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      background:
                        entry.status === "done"
                          ? "rgba(34,197,94,0.12)"
                          : entry.status === "error"
                            ? "rgba(239,68,68,0.12)"
                            : entry.status === "uploading"
                              ? "rgba(59,130,246,0.12)"
                              : entry.routing
                                ? "rgba(34,197,94,0.12)"
                                : "rgba(245,158,11,0.12)",
                    }}
                  >
                    {entry.status === "uploading" ? (
                      <Loader2
                        size={14}
                        color="#3b82f6"
                        style={{
                          animation: "spin 1s linear infinite",
                        }}
                      />
                    ) : entry.status === "done" ? (
                      <Check size={14} color="#22c55e" />
                    ) : entry.status === "error" ? (
                      <X size={14} color="#ef4444" />
                    ) : entry.routing ? (
                      <Check size={14} color="#22c55e" />
                    ) : (
                      <AlertTriangle size={14} color="#f59e0b" />
                    )}
                  </div>

                  {/* File info + routing */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: theme.text,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {entry.file.name}
                    </div>

                    {entry.routing ? (
                      /* Auto-matched */
                      <div
                        style={{
                          fontSize: 12,
                          color: "#22c55e",
                          marginTop: 2,
                        }}
                      >
                        {entry.routing.persona} {entry.routing.version}{" "}
                        {entry.routing.platform}
                        {entry.matchedAssetId && " (asset matched)"}
                      </div>
                    ) : (
                      /* Manual routing dropdowns */
                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                          marginTop: 6,
                          flexWrap: "wrap",
                        }}
                      >
                        <select
                          value={entry.manualPersona}
                          onChange={(e) =>
                            updateManual(idx, "manualPersona", e.target.value)
                          }
                          style={selectStyle}
                        >
                          <option value="" disabled>
                            Persona
                          </option>
                          {personas.map((p) => {
                            const name =
                              p.persona_name?.split(" ")[0] ||
                              p.archetype_key ||
                              "Unknown";
                            return (
                              <option key={name} value={name}>
                                {p.persona_name || p.archetype_key}
                              </option>
                            );
                          })}
                        </select>

                        <select
                          value={entry.manualVersion}
                          onChange={(e) =>
                            updateManual(idx, "manualVersion", e.target.value)
                          }
                          style={selectStyle}
                        >
                          {VERSIONS.map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                        </select>

                        <select
                          value={entry.manualPlatform}
                          onChange={(e) =>
                            updateManual(idx, "manualPlatform", e.target.value)
                          }
                          style={selectStyle}
                        >
                          <option value="" disabled>
                            Platform
                          </option>
                          {platforms.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Remove button */}
                  {entry.status === "pending" && (
                    <button
                      onClick={() => removeFile(idx)}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        border: "none",
                        background: "transparent",
                        color: theme.textDim,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────── */}
        {files.length > 0 && (
          <div
            style={{
              padding: "16px 28px",
              borderTop: `1px solid ${theme.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span
              style={{
                fontSize: 13,
                color: theme.textMuted,
              }}
            >
              {files.length} file{files.length === 1 ? "" : "s"}
              {pendingCount > 0 && ` \u00B7 ${pendingCount} pending`}
            </span>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={onClose}
                disabled={isProcessing}
                style={{
                  height: 38,
                  padding: "0 18px",
                  borderRadius: 9999,
                  border: `1px solid ${theme.border}`,
                  background: "transparent",
                  color: theme.textMuted,
                  fontFamily: FONT.sans,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: isProcessing ? "not-allowed" : "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                Cancel
              </button>
              <button
                onClick={allDone ? onClose : handleReplaceAll}
                disabled={
                  isProcessing || (pendingCount === 0 && !allDone)
                }
                style={{
                  height: 38,
                  padding: "0 22px",
                  borderRadius: 9999,
                  border: "none",
                  background:
                    isProcessing || (pendingCount === 0 && !allDone)
                      ? theme.border
                      : "#22c55e",
                  color:
                    isProcessing || (pendingCount === 0 && !allDone)
                      ? theme.textMuted
                      : "#fff",
                  fontFamily: FONT.sans,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor:
                    isProcessing || (pendingCount === 0 && !allDone)
                      ? "not-allowed"
                      : "pointer",
                  transition: "all 0.2s ease",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {isProcessing ? (
                  <>
                    <Loader2
                      size={14}
                      style={{
                        animation: "spin 1s linear infinite",
                      }}
                    />
                    Uploading...
                  </>
                ) : allDone ? (
                  "Done"
                ) : (
                  "Replace All"
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Spin keyframes */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
