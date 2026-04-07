"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Copy, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { slugify } from "@/lib/slugify";
import type { GeneratedAsset } from "@/lib/types";

export type LandingPageKey = "job_posting_url" | "landing_page_url" | "ada_form_url";

const LANDING_PAGE_LABEL: Record<LandingPageKey, string> = {
  job_posting_url: "Job Posting",
  landing_page_url: "Landing Page",
  ada_form_url: "ADA Form",
};

interface LandingPagesData {
  job_posting_url: string | null;
  landing_page_url: string | null;
  ada_form_url: string | null;
}

interface LinkBuilderBarProps {
  requestId: string;
  campaignSlug: string | null;
  activeChannel: string;
  selectedAsset: GeneratedAsset | null;
  recruiterInitials: string;
}

/** Derive a human-readable content slug from an asset (e.g. "emily-square-01"). */
function deriveContentSlug(asset: GeneratedAsset | null): string {
  if (!asset) return "creative";
  const actor = slugify(asset.actor_id ?? "creative").slice(0, 20) || "creative";
  const format = slugify(asset.format ?? "asset").slice(0, 12) || "asset";
  const idTail = asset.id.replace(/-/g, "").slice(0, 2);
  return `${actor}-${format}-${idTail}`;
}

export default function LinkBuilderBar({
  requestId,
  campaignSlug,
  activeChannel,
  selectedAsset,
  recruiterInitials,
}: LinkBuilderBarProps) {
  const [landingPages, setLandingPages] = useState<LandingPagesData | null>(null);
  const [selectedUrlKey, setSelectedUrlKey] = useState<LandingPageKey | null>(null);
  const [term, setTerm] = useState(recruiterInitials || "??");
  const [content, setContent] = useState("");
  const [medium, setMedium] = useState("social");
  const [submitting, setSubmitting] = useState(false);

  // Fetch landing pages on mount
  const fetchLandingPages = useCallback(async () => {
    try {
      const res = await fetch(`/api/intake/${requestId}/landing-pages`);
      if (res.ok) {
        const data = await res.json();
        setLandingPages(data);
      }
    } catch {
      // silent
    }
  }, [requestId]);

  useEffect(() => {
    fetchLandingPages();
  }, [fetchLandingPages]);

  // Compute available URLs
  const availableUrls = useMemo(() => {
    if (!landingPages) return [];
    const entries: Array<{ key: LandingPageKey; url: string }> = [];
    if (landingPages.job_posting_url) entries.push({ key: "job_posting_url", url: landingPages.job_posting_url });
    if (landingPages.landing_page_url) entries.push({ key: "landing_page_url", url: landingPages.landing_page_url });
    if (landingPages.ada_form_url) entries.push({ key: "ada_form_url", url: landingPages.ada_form_url });
    return entries;
  }, [landingPages]);

  // Readiness gate state
  const readinessState: "disabled" | "ready" =
    availableUrls.length === 0 ? "disabled" : "ready";

  // Poll every 10s while disabled to auto-clear the banner when URLs are added
  useEffect(() => {
    if (readinessState !== "disabled") return;
    const interval = setInterval(fetchLandingPages, 10000);
    return () => clearInterval(interval);
  }, [readinessState, fetchLandingPages]);

  // Default the selectedUrlKey once URLs arrive
  useEffect(() => {
    if (availableUrls.length === 0) {
      setSelectedUrlKey(null);
      return;
    }
    if (!selectedUrlKey || !availableUrls.some((u) => u.key === selectedUrlKey)) {
      // Prefer landing_page_url, then job_posting_url, then ada_form_url
      const preference: LandingPageKey[] = ["landing_page_url", "job_posting_url", "ada_form_url"];
      const match = preference.find((p) => availableUrls.some((u) => u.key === p));
      setSelectedUrlKey(match ?? availableUrls[0].key);
    }
  }, [availableUrls, selectedUrlKey]);

  // Update term when initials prop changes
  useEffect(() => {
    setTerm(recruiterInitials || "??");
  }, [recruiterInitials]);

  // Update content when selected asset changes
  useEffect(() => {
    setContent(deriveContentSlug(selectedAsset));
  }, [selectedAsset]);

  const selectedUrl = availableUrls.find((u) => u.key === selectedUrlKey)?.url ?? null;

  const canSubmit =
    readinessState === "ready" &&
    !submitting &&
    !!campaignSlug &&
    !!selectedUrl &&
    !!selectedAsset &&
    term.trim().length > 0 &&
    content.trim().length > 0;

  async function handleCopyLink() {
    if (!canSubmit || !selectedUrl) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/tracked-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: requestId,
          asset_id: selectedAsset?.id ?? null,
          base_url: selectedUrl,
          utm_source: activeChannel,
          utm_medium: medium,
          utm_term: term,
          utm_content: content,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || data.error || "Failed to create tracked link");
        return;
      }
      await navigator.clipboard.writeText(data.short_url);
      toast.success(`Short link copied! ${data.short_url}`);
    } catch (e) {
      toast.error("Failed to create tracked link");
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  }

  if (readinessState === "disabled") {
    return (
      <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-amber-300 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] px-4 md:px-6 py-3 z-20">
        <div className="max-w-[1100px] mx-auto flex items-center gap-3">
          <AlertTriangle size={18} className="text-amber-500 shrink-0" />
          <p className="text-sm text-[var(--foreground)] flex-1">
            <span className="font-semibold">Waiting for landing page URLs.</span>{" "}
            <span className="text-[var(--muted-foreground)]">
              Marketing or the designer needs to add at least one URL before you can build tracked links.
            </span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="sticky bottom-0 left-0 right-0 bg-white border-t-2 border-[#9B51E0] shadow-[0_-6px_16px_rgba(0,0,0,0.08)] px-4 md:px-6 py-3 z-20">
      <div className="max-w-[1100px] mx-auto">
        <div className="text-[10px] font-bold text-[#9B51E0] uppercase tracking-wider mb-2">
          Your Tracked Link
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
          <FieldReadonly label="Campaign" value={campaignSlug ?? "—"} />
          <FieldReadonly label="Posting to" value={activeChannel} />
          <FieldEditable
            label="Your tag"
            value={term}
            onChange={setTerm}
            onBlur={() => setTerm(slugify(term) || recruiterInitials || "??")}
          />
          <FieldEditable
            label="Creative"
            value={content}
            onChange={setContent}
            onBlur={() => setContent(slugify(content) || deriveContentSlug(selectedAsset))}
          />
          {availableUrls.length > 1 ? (
            <div>
              <div className="text-[10px] text-[var(--muted-foreground)] uppercase font-semibold mb-1">Destination</div>
              <select
                value={selectedUrlKey ?? ""}
                onChange={(e) => setSelectedUrlKey(e.target.value as LandingPageKey)}
                className="w-full text-xs px-2 py-1.5 rounded-md border border-[var(--border)] bg-[var(--muted)] cursor-pointer"
              >
                {availableUrls.map((u) => (
                  <option key={u.key} value={u.key}>
                    {LANDING_PAGE_LABEL[u.key]}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <FieldReadonly label="Destination" value={selectedUrlKey ? LANDING_PAGE_LABEL[selectedUrlKey] : "—"} />
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 text-xs text-[var(--muted-foreground)] font-mono truncate">
            {selectedUrl ? `${selectedUrl.slice(0, 60)}${selectedUrl.length > 60 ? "…" : ""}` : "Pick a destination"}
          </div>
          <button
            onClick={handleCopyLink}
            disabled={!canSubmit}
            className="btn-primary cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? <Loader2 size={15} className="animate-spin" /> : <Copy size={15} />}
            {submitting ? "Copying…" : "Copy Link"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldReadonly({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-[var(--muted-foreground)] uppercase font-semibold mb-1">{label}</div>
      <div
        className="text-xs px-2 py-1.5 rounded-md bg-[var(--muted)] text-[var(--foreground)] font-medium truncate"
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

function FieldEditable({
  label,
  value,
  onChange,
  onBlur,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
}) {
  return (
    <div>
      <div className="text-[10px] text-[var(--muted-foreground)] uppercase font-semibold mb-1">{label}</div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="w-full text-xs px-2 py-1.5 rounded-md border border-[var(--border)] bg-white"
      />
    </div>
  );
}
