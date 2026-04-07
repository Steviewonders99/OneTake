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

  // Suppress "unused" warnings from TS/eslint — these values are used in Task 6's render.
  void pages;
  void savingField;
  void canEdit;
  void saveField;
  void focusedFieldRef;

  return (
    <div className="border border-[var(--border)] rounded-[14px] bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
      <div className="text-[11px] font-bold uppercase tracking-[0.07em] text-[#737373]">
        Landing Pages — placeholder (wired in Task 6)
      </div>
    </div>
  );
}
