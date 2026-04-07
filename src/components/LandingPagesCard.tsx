"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, ExternalLink, ClipboardList, Globe, FileCheck, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import type { CampaignLandingPages, LandingPageField } from "@/lib/types";

// ── Props ────────────────────────────────────────────────────────────

interface LandingPagesCardProps {
  requestId: string;
  canEdit: boolean;
}

// ── URL normalization (must match server) ──────────────────────────

function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function isComplete(pages: CampaignLandingPages | null): boolean {
  if (!pages) return false;
  return Boolean(pages.job_posting_url && pages.landing_page_url && pages.ada_form_url);
}

// ── Row config (single source of truth for label/icon/color) ───────

interface RowConfig {
  field: LandingPageField;
  label: string;
  placeholder: string;
  Icon: typeof ClipboardList;
  accent: string;
}

const ROW_CONFIG: RowConfig[] = [
  {
    field: "job_posting_url",
    label: "Job Posting",
    placeholder: "paste the main OneForma job listing URL…",
    Icon: ClipboardList,
    accent: "rgb(6,147,227)",
  },
  {
    field: "landing_page_url",
    label: "Landing Page",
    placeholder: "paste the campaign landing page URL…",
    Icon: Globe,
    accent: "rgb(155,81,224)",
  },
  {
    field: "ada_form_url",
    label: "ADA Form",
    placeholder: "paste the screener / qualification form URL…",
    Icon: FileCheck,
    accent: "#22c55e",
  },
];

// ── Sub-component: LandingPageRow ───────────────────────────────────

interface LandingPageRowProps {
  config: RowConfig;
  value: string | null;
  canEdit: boolean;
  isSaving: boolean;
  onFocus: () => void;
  onBlur: (rawValue: string) => void;
}

function LandingPageRow({ config, value, canEdit, isSaving, onFocus, onBlur }: LandingPageRowProps) {
  const { label, placeholder, Icon, accent } = config;
  const [localValue, setLocalValue] = useState(value ?? "");
  const [focused, setFocused] = useState(false);

  // If the external value changes while we're NOT focused, sync it in.
  // If focused, leave the user's in-progress typing alone.
  useEffect(() => {
    if (!focused) {
      setLocalValue(value ?? "");
    }
  }, [value, focused]);

  const hasValue = localValue.trim().length > 0;
  const savedClass = !focused && hasValue
    ? "bg-[rgba(34,197,94,0.04)] border-[rgba(34,197,94,0.25)]"
    : "";
  const focusedClass = focused
    ? "bg-white border-[rgb(6,147,227)] ring-[3px] ring-[rgb(6,147,227)]/10"
    : "";
  const defaultClass = !focused && !hasValue
    ? "bg-[#FAFAFA] border-[var(--border)] hover:bg-white hover:border-[#ccc]"
    : "";

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!value) return;
    navigator.clipboard.writeText(value).catch(() => {});
    toast.success("Copied");
  };

  return (
    <div
      className={`flex items-center gap-2.5 px-3 py-2.5 border rounded-[10px] mb-2 transition-all ${savedClass} ${focusedClass} ${defaultClass}`}
    >
      {/* Icon panel */}
      <div
        className="w-[30px] h-[30px] rounded-lg flex items-center justify-center flex-shrink-0"
        style={{
          background: `linear-gradient(135deg, rgba(6,147,227,0.1), rgba(155,81,224,0.1))`,
        }}
      >
        <Icon size={14} style={{ color: accent }} strokeWidth={2} />
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-[0.05em] text-[#737373] leading-none">
          {label}
        </div>
        <input
          type="text"
          className="block w-full pt-0.5 bg-transparent border-none outline-none text-[12px] font-medium font-mono text-[var(--foreground)] placeholder:text-[#c0c0c0] placeholder:italic placeholder:font-sans"
          placeholder={placeholder}
          value={localValue}
          readOnly={!canEdit}
          onChange={(e) => setLocalValue(e.target.value)}
          onFocus={() => {
            setFocused(true);
            onFocus();
          }}
          onBlur={() => {
            setFocused(false);
            // Only save if the value actually changed.
            if ((value ?? "") !== localValue) {
              onBlur(localValue);
            }
          }}
        />
      </div>

      {/* Right side — saving indicator OR action buttons */}
      {focused ? (
        <div className="flex items-center gap-1 text-[10px] font-bold text-[rgb(6,147,227)] flex-shrink-0">
          <span
            className="w-[5px] h-[5px] rounded-full bg-current"
            style={{ animation: "landingPagePulse 1s ease-in-out infinite" }}
          />
          editing
        </div>
      ) : isSaving ? (
        <div className="flex items-center gap-1 text-[10px] font-bold text-[rgb(6,147,227)] flex-shrink-0">
          <span
            className="w-[5px] h-[5px] rounded-full bg-current"
            style={{ animation: "landingPagePulse 1s ease-in-out infinite" }}
          />
          saving
        </div>
      ) : hasValue && value ? (
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            className="w-[26px] h-[26px] rounded-md border-none bg-transparent flex items-center justify-center cursor-pointer text-[#737373] hover:bg-[#F0F0F0] hover:text-[var(--foreground)] transition-colors"
            title="Copy"
          >
            <Copy size={13} />
          </button>
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="w-[26px] h-[26px] rounded-md flex items-center justify-center text-[#737373] hover:bg-[#F0F0F0] hover:text-[var(--foreground)] transition-colors"
            title="Open in new tab"
          >
            <ExternalLink size={13} />
          </a>
        </div>
      ) : null}
    </div>
  );
}

// ── Default export — stub, filled in Task 6 ────────────────────────

export default function LandingPagesCard({ requestId, canEdit }: LandingPagesCardProps) {
  const [pages, setPages] = useState<CampaignLandingPages | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingField, setSavingField] = useState<LandingPageField | null>(null);
  const focusedFieldRef = useRef<LandingPageField | null>(null);

  // Fetch helper
  const fetchPages = useCallback(
    async (isInitial: boolean) => {
      try {
        const res = await fetch(`/api/intake/${requestId}/landing-pages`);
        if (!res.ok) {
          if (isInitial) setLoading(false);
          return;
        }
        const data = (await res.json()) as CampaignLandingPages | null;
        // Only update state if no field is currently focused — protects in-progress typing.
        if (focusedFieldRef.current === null) {
          setPages(data);
        }
        if (isInitial) setLoading(false);
      } catch (err) {
        console.error("[LandingPagesCard] fetch failed:", err);
        if (isInitial) setLoading(false);
      }
    },
    [requestId],
  );

  // Initial fetch + 5s poll
  useEffect(() => {
    fetchPages(true);
    const interval = setInterval(() => fetchPages(false), 5000);
    return () => clearInterval(interval);
  }, [fetchPages]);

  // Save one field (called from row onBlur in Task 6)
  const saveField = useCallback(
    async (field: LandingPageField, rawValue: string) => {
      const normalized = normalizeUrl(rawValue);
      // Optimistic update
      const previous = pages;
      setPages((prev) => {
        const base = prev ?? {
          id: "",
          request_id: requestId,
          job_posting_url: null,
          landing_page_url: null,
          ada_form_url: null,
          updated_by: null,
          created_at: "",
          updated_at: "",
        };
        return { ...base, [field]: normalized };
      });
      setSavingField(field);

      try {
        const res = await fetch(`/api/intake/${requestId}/landing-pages`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ field, value: normalized }),
        });
        if (!res.ok) throw new Error(`PATCH failed: ${res.status}`);
        const updated = (await res.json()) as CampaignLandingPages;
        setPages(updated);
      } catch (err) {
        console.error("[LandingPagesCard] save failed:", err);
        setPages(previous); // rollback
        toast.error("Couldn't save landing page");
      } finally {
        setSavingField(null);
      }
    },
    [pages, requestId],
  );

  if (loading) {
    return (
      <div className="border border-[var(--border)] rounded-[14px] bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <div className="animate-pulse space-y-2">
          <div className="h-3 bg-[#F5F5F5] rounded w-1/3" />
          <div className="h-12 bg-[#F5F5F5] rounded-lg" />
          <div className="h-12 bg-[#F5F5F5] rounded-lg" />
          <div className="h-12 bg-[#F5F5F5] rounded-lg" />
        </div>
      </div>
    );
  }

  const complete = isComplete(pages);

  return (
    <div className="border border-[var(--border)] rounded-[14px] bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
      {/* Keyframe for the pulse indicator */}
      <style>{`
        @keyframes landingPagePulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-[#737373] m-0">
          Landing Pages
        </h3>
        {complete ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#22c55e]">
            <CheckCircle2 size={11} strokeWidth={2.5} />
            complete
          </span>
        ) : (
          <span className="text-[10px] italic text-[#737373]">
            applies to all countries
          </span>
        )}
      </div>

      {/* Rows */}
      {ROW_CONFIG.map((config) => {
        const value = pages ? ((pages as unknown as Record<LandingPageField, string | null>)[config.field] ?? null) : null;
        return (
          <LandingPageRow
            key={config.field}
            config={config}
            value={value}
            canEdit={canEdit}
            isSaving={savingField === config.field}
            onFocus={() => {
              focusedFieldRef.current = config.field;
            }}
            onBlur={(rawValue) => {
              focusedFieldRef.current = null;
              void saveField(config.field, rawValue);
            }}
          />
        );
      })}
    </div>
  );
}
