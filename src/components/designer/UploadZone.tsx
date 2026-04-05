"use client";

import { useState, useRef } from "react";
import { Upload, Loader2, Send, X } from "lucide-react";
import { toast } from "sonner";
import VersionCompare from "./VersionCompare";
import type { GeneratedAsset } from "@/lib/types";

interface DesignerUpload {
  id: string;
  request_id: string;
  original_asset_id: string | null;
  file_name: string;
  blob_url: string;
  uploaded_by: string;
  created_at: string;
}

interface UploadZoneProps {
  requestId: string;
  token: string;
  assets: GeneratedAsset[];
  uploads: DesignerUpload[];
  onUploadComplete: (upload: DesignerUpload) => void;
  onSubmitFinals: () => void;
}

export default function UploadZone({
  requestId,
  token,
  assets,
  uploads,
  onUploadComplete,
  onSubmitFinals,
}: UploadZoneProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File, originalAssetId?: string) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("token", token);
    if (originalAssetId) {
      fd.append("original_asset_id", originalAssetId);
    }

    const res = await fetch(`/api/designer/${requestId}/upload`, {
      method: "POST",
      body: fd,
    });

    if (!res.ok) throw new Error("Upload failed");
    return (await res.json()) as DesignerUpload;
  }

  async function handleFiles(files: FileList | File[]) {
    setUploading(true);
    const fileArray = Array.from(files);

    for (const file of fileArray) {
      try {
        const upload = await uploadFile(file);
        onUploadComplete(upload);
        toast.success(`Uploaded ${file.name}`);
      } catch {
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    setUploading(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
  }

  async function handleSubmitFinals() {
    if (uploads.length === 0) {
      toast.error("Upload at least one file before submitting finals");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/designer/${requestId}/submit-finals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to submit finals");
      }
      toast.success("Finals submitted successfully!");
      onSubmitFinals();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit finals");
    } finally {
      setSubmitting(false);
    }
  }

  // Build version comparisons: match uploads to originals by original_asset_id
  const comparisons = uploads.filter((u) => u.original_asset_id).map((upload) => {
    const original = assets.find((a) => a.id === upload.original_asset_id);
    return { upload, original };
  });

  const standaloneUploads = uploads.filter((u) => !u.original_asset_id);

  return (
    <div className="space-y-6">
      <h2 className="text-base font-semibold text-[var(--foreground)] text-center">
        Upload Refined Versions
      </h2>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`flex flex-col items-center justify-center p-10 rounded-[var(--radius-md)] border-2 border-dashed transition-all cursor-pointer ${
          dragOver
            ? "border-[var(--ring)] bg-blue-50/50"
            : "border-[var(--border)] bg-[var(--muted)] hover:border-[#d4d4d4]"
        }`}
      >
        {uploading ? (
          <>
            <Loader2 size={28} className="text-[var(--muted-foreground)] animate-spin mb-2" />
            <p className="text-sm font-medium text-[var(--foreground)]">Uploading...</p>
          </>
        ) : (
          <>
            <Upload size={28} className="text-[var(--muted-foreground)] mb-2" />
            <p className="text-sm font-medium text-[var(--foreground)]">
              Drop refined creatives here or click to browse
            </p>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">
              PNG, JPG, or PDF files
            </p>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf"
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFiles(e.target.files);
            }
          }}
        />
      </div>

      {/* Version comparisons */}
      {comparisons.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">
            Version Comparisons
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {comparisons.map(({ upload, original }) => (
              <VersionCompare
                key={upload.id}
                originalUrl={original?.blob_url || ""}
                refinedUrl={upload.blob_url}
                fileName={upload.file_name}
              />
            ))}
          </div>
        </div>
      )}

      {/* Standalone uploads */}
      {standaloneUploads.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">
            Your Uploads
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {standaloneUploads.map((upload) => (
              <div
                key={upload.id}
                className="card overflow-hidden"
              >
                <div className="relative bg-[var(--muted)] aspect-square">
                  <img
                    src={upload.blob_url}
                    alt={upload.file_name}
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute top-2 right-2 text-[12px] font-semibold text-white bg-green-600 px-2 py-0.5 rounded-full">
                    Uploaded
                  </span>
                </div>
                <div className="p-2">
                  <p className="text-xs text-[var(--foreground)] truncate">{upload.file_name}</p>
                  <p className="text-[12px] text-[var(--muted-foreground)]">
                    {new Date(upload.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Submit Finals */}
      <div className="flex justify-center pt-4">
        <button
          onClick={handleSubmitFinals}
          disabled={submitting || uploads.length === 0}
          className="btn-success text-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          title={uploads.length === 0 ? "Upload at least one file first" : undefined}
        >
          {submitting ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Send size={16} />
          )}
          {submitting ? "Submitting..." : "Submit Finals to Steven"}
        </button>
      </div>
    </div>
  );
}
