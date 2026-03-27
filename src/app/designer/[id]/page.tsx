"use client";

import { use, useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Download,
  Upload,
  Loader2,
  AlertCircle,
  ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import CreativeGrid from "@/components/CreativeGrid";
import type { IntakeRequest, GeneratedAsset, CreativeBrief } from "@/lib/types";

interface DesignerData {
  request: IntakeRequest;
  assets: GeneratedAsset[];
  brief: CreativeBrief | null;
}

function DesignerContent({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [data, setData] = useState<DesignerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

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
        const result = await res.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id, token]);

  async function handleUpload(files: FileList) {
    if (!token) return;
    setUploading(true);

    try {
      const fd = new FormData();
      for (let i = 0; i < files.length; i++) {
        fd.append("files", files[i]);
      }

      const res = await fetch(`/api/designer/${id}/upload?token=${token}`, {
        method: "POST",
        body: fd,
      });

      if (!res.ok) throw new Error("Upload failed");
      toast.success(`Uploaded ${files.length} file(s) successfully`);
    } catch {
      toast.error("Failed to upload files");
    } finally {
      setUploading(false);
    }
  }

  function handleDownloadAll() {
    window.open(`/api/export/${id}`, "_blank");
  }

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center">
        <Loader2 size={32} className="text-[var(--muted-foreground)] animate-spin mb-3" />
        <p className="text-sm text-[var(--muted-foreground)]">Loading assets...</p>
      </div>
    );
  }

  // Error
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

  const { request, assets } = data;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-[var(--border)] px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="text-center flex-1">
            <span className="text-lg font-bold tracking-tight text-[var(--foreground)]">
              OneForma
            </span>
            <span className="block text-xs text-[var(--muted-foreground)]">
              Designer Review
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-xl font-semibold text-[var(--foreground)]">{request.title}</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            {request.task_type.replace(/_/g, " ")} &middot;{" "}
            {request.target_languages.join(", ") || "All languages"}
          </p>
        </div>

        {/* Download All button */}
        {assets.length > 0 && (
          <div className="flex justify-center mb-8">
            <button onClick={handleDownloadAll} className="btn-primary cursor-pointer">
              <Download size={16} />
              Download All Assets
            </button>
          </div>
        )}

        {/* Creative grid */}
        {assets.length > 0 ? (
          <div className="mb-12">
            <CreativeGrid
              assets={assets}
              onDownload={(asset) => {
                if (asset.blob_url) window.open(asset.blob_url, "_blank");
              }}
            />
          </div>
        ) : (
          <div className="text-center py-16 mb-12">
            <ImageIcon size={40} className="mx-auto text-[var(--muted-foreground)] mb-3" />
            <p className="text-sm text-[var(--muted-foreground)]">
              No assets have been generated yet
            </p>
          </div>
        )}

        {/* Upload zone */}
        <div className="border-t border-[var(--border)] pt-8">
          <h2 className="text-base font-semibold text-[var(--foreground)] mb-4 text-center">
            Upload Refined Versions
          </h2>
          <label className="flex flex-col items-center justify-center p-10 rounded-[var(--radius-md)] border-2 border-dashed border-[var(--border)] bg-[var(--muted)] hover:border-[#d4d4d4] transition-colors cursor-pointer">
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
              type="file"
              multiple
              accept="image/*,.pdf"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleUpload(e.target.files);
                }
              }}
            />
          </label>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] px-6 py-4 text-center">
        <p className="text-xs text-[var(--muted-foreground)]">
          Powered by OneForma &middot; Centific
        </p>
      </footer>
    </div>
  );
}

function DesignerFallback() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center">
      <Loader2 size={32} className="text-[var(--muted-foreground)] animate-spin mb-3" />
      <p className="text-sm text-[var(--muted-foreground)]">Loading...</p>
    </div>
  );
}

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
