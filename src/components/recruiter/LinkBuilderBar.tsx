"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Copy, AlertTriangle, Loader2, Link2 } from "lucide-react";
import { toast } from "sonner";
import { slugify } from "@/lib/slugify";
import { extractField } from "@/lib/format";
import SearchableDropdown from "./SearchableDropdown";
import {
  SOURCE_OPTIONS,
  getContentOptionsForSource,
  getDefaultContentForChannel,
  UTM_MEDIUM,
  type UtmSource,
} from "@/lib/tracked-links/source-options";
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
  onDetachCreative: () => void;
}

/** Derive a sensible initial source+content from the active channel. */
function pickInitialSourceAndContent(channel: string): { source: UtmSource; content: string } {
  const channelDefault = getDefaultContentForChannel(channel);
  if (channelDefault) {
    return { source: channelDefault.source, content: channelDefault.value };
  }
  // Fallback: social + first social option
  const fallback = getContentOptionsForSource("social")[0];
  return { source: "social", content: fallback?.value ?? "" };
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: 0.4,
  color: "#8A8A8E",
  marginBottom: 5,
};

const inputStyle: React.CSSProperties = {
  fontSize: 13,
  padding: "9px 12px",
  borderRadius: 8,
  border: "1px solid #E8E8EA",
  background: "#FAFAFA",
  color: "#1A1A1A",
  fontFamily: "inherit",
  WebkitAppearance: "none",
  width: "100%",
  boxSizing: "border-box",
};

export default function LinkBuilderBar({
  requestId,
  campaignSlug,
  activeChannel,
  selectedAsset,
  recruiterInitials,
  onDetachCreative,
}: LinkBuilderBarProps) {
  const [landingPages, setLandingPages] = useState<LandingPagesData | null>(null);
  const [selectedUrlKey, setSelectedUrlKey] = useState<LandingPageKey | null>(null);
  const [term, setTerm] = useState(recruiterInitials || "??");
  const [submitting, setSubmitting] = useState(false);
  const [recentLinks, setRecentLinks] = useState<Array<{ id: string; short_url: string; utm_source: string; utm_content: string; click_count: number; created_at: string; asset_thumbnail: string | null }>>([]);

  // Source + content dropdowns
  const [utmSource, setUtmSource] = useState<UtmSource>(() => pickInitialSourceAndContent(activeChannel).source);
  const [utmContent, setUtmContent] = useState<string>(() => pickInitialSourceAndContent(activeChannel).content);

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

  // Load recent links
  const loadRecentLinks = useCallback(async () => {
    try {
      const r = await fetch(`/api/tracked-links?request_id=${requestId}&limit=3`);
      if (r.ok) {
        const data = await r.json();
        if (data?.links) setRecentLinks(data.links.slice(0, 3));
      }
    } catch {
      // silent
    }
  }, [requestId]);

  useEffect(() => {
    loadRecentLinks();
  }, [loadRecentLinks]);

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
      const preference: LandingPageKey[] = ["landing_page_url", "job_posting_url", "ada_form_url"];
      const match = preference.find((p) => availableUrls.some((u) => u.key === p));
      setSelectedUrlKey(match ?? availableUrls[0].key);
    }
  }, [availableUrls, selectedUrlKey]);

  // Update term when initials prop changes
  useEffect(() => {
    setTerm(recruiterInitials || "??");
  }, [recruiterInitials]);

  // When the channel tab changes, update content to the channel-natural default
  // ONLY if the current source is "social" — non-social workflows shouldn't auto-flip.
  useEffect(() => {
    if (utmSource !== "social") return;
    const channelDefault = getDefaultContentForChannel(activeChannel);
    if (channelDefault && channelDefault.source === "social") {
      setUtmContent(channelDefault.value);
    }
    // Intentionally only depend on activeChannel — we don't want to fire when
    // utmSource or utmContent change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChannel]);

  // When the source dropdown changes, ensure content is valid for the new source
  useEffect(() => {
    const validOptions = getContentOptionsForSource(utmSource);
    const isStillValid = validOptions.some((c) => c.value === utmContent);
    if (isStillValid) return;
    // Pick a new default
    if (utmSource === "social") {
      const channelDefault = getDefaultContentForChannel(activeChannel);
      if (channelDefault && channelDefault.source === "social") {
        setUtmContent(channelDefault.value);
        return;
      }
    }
    setUtmContent(validOptions[0]?.value ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [utmSource]);

  const sourceOptions = useMemo(
    () => SOURCE_OPTIONS.map((s) => ({ value: s.value, label: s.label })),
    []
  );

  const contentOptions = useMemo(
    () => getContentOptionsForSource(utmSource).map((c) => ({ value: c.value, label: c.label })),
    [utmSource]
  );

  const selectedUrl = availableUrls.find((u) => u.key === selectedUrlKey)?.url ?? null;

  const canSubmit =
    readinessState === "ready" &&
    !submitting &&
    !!campaignSlug &&
    !!selectedUrl &&
    !!selectedAsset &&
    term.trim().length > 0 &&
    utmContent.trim().length > 0;

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
          utm_source: utmSource,
          utm_medium: UTM_MEDIUM,
          utm_term: term,
          utm_content: utmContent,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || data.error || "Failed to create tracked link");
        return;
      }
      await navigator.clipboard.writeText(data.short_url);
      toast.success(`Short link copied! ${data.short_url}`);
      loadRecentLinks();
    } catch (e) {
      toast.error("Failed to create tracked link");
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ background: "#FFFFFF", borderRadius: 10, border: "1px solid #E8E8EA", overflow: "hidden" }}>
      {/* Panel header */}
      <div style={{ padding: "14px 18px", borderBottom: "1px solid #E8E8EA", display: "flex", alignItems: "center", gap: 8 }}>
        <Link2 size={16} style={{ color: "#8A8A8E" }} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#1A1A1A" }}>Link Builder</div>
          <div style={{ fontSize: 11, color: "#8A8A8E" }}>Tracked links for any channel</div>
        </div>
      </div>

      {/* Disabled state */}
      {readinessState === "disabled" && (
        <div style={{ padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 14, background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8 }}>
            <AlertTriangle size={16} style={{ color: "#F59E0B", flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#1A1A1A" }}>Waiting for landing page URLs</div>
              <div style={{ fontSize: 11, color: "#8A8A8E" }}>Marketing needs to add at least one URL first.</div>
            </div>
          </div>
        </div>
      )}

      {/* Body with form */}
      {readinessState === "ready" && (
        <div style={{ padding: 18 }}>
          {/* Attached Creative section */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4, color: "#8A8A8E", marginBottom: 5, display: "flex", alignItems: "center", gap: 4 }}>
              Attached Creative <span style={{ fontSize: 9, fontWeight: 500, color: "#8A8A8E", background: "#F0F0F0", padding: "1px 5px", borderRadius: 3, textTransform: "none", letterSpacing: 0 }}>Optional</span>
            </div>
            {selectedAsset ? (
              <div style={{ background: "#FAFAFA", border: "1px solid #E8E8EA", borderRadius: 8, padding: "9px 10px", display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 6, background: "#EBEBEB", flexShrink: 0, overflow: "hidden" }}>
                  {selectedAsset.blob_url && <img src={selectedAsset.blob_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {extractField(selectedAsset.content, "overlay_headline") || extractField(selectedAsset.copy_data, "headline") || "Creative"}
                </div>
                <button onClick={onDetachCreative} style={{ fontSize: 14, color: "#8A8A8E", cursor: "pointer", padding: "2px 4px", lineHeight: 1, background: "none", border: "none", fontFamily: "inherit" }}>&times;</button>
              </div>
            ) : (
              <div style={{ background: "#FAFAFA", border: "1px dashed #E8E8EA", borderRadius: 8, padding: 10, textAlign: "center", fontSize: 12, color: "#8A8A8E" }}>
                No creative attached
              </div>
            )}
          </div>

          {/* Form fields — 2x2 grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            {/* Source */}
            <SearchableDropdown
              label="Source"
              value={utmSource}
              options={sourceOptions}
              onChange={(v) => setUtmSource(v as UtmSource)}
              searchable={false}
            />
            {/* Platform */}
            <SearchableDropdown
              label="Platform"
              value={utmContent}
              options={contentOptions}
              onChange={setUtmContent}
              searchable={true}
              placeholder="Pick a platform…"
            />
            {/* Your Tag */}
            <FieldEditable
              label="Your tag"
              value={term}
              onChange={setTerm}
              onBlur={() => setTerm(slugify(term) || recruiterInitials || "??")}
            />
            {/* Destination */}
            {availableUrls.length > 1 ? (
              <div>
                <div style={labelStyle}>Destination</div>
                <select
                  value={selectedUrlKey ?? ""}
                  onChange={(e) => setSelectedUrlKey(e.target.value as LandingPageKey)}
                  style={{ ...inputStyle, cursor: "pointer" }}
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

          {/* URL Preview bar */}
          <div style={{ background: "#1A1A1A", borderRadius: 8, padding: "9px 12px", marginBottom: 14, display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#4ade80", flexShrink: 0 }} />
            <div style={{ fontFamily: '"SF Mono", "Fira Code", monospace', fontSize: 11, color: "#777", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {selectedUrl ? <>{new URL(selectedUrl).hostname}<span style={{ color: "#4ade80" }}>/r/...</span></> : "Select a destination"}
            </div>
          </div>

          {/* Generate button */}
          <button onClick={handleCopyLink} disabled={!canSubmit} style={{
            width: "100%", background: canSubmit ? "#32373C" : "#E8E8EA",
            color: canSubmit ? "white" : "#8A8A8E", border: "none",
            padding: 12, borderRadius: 10, fontSize: 13, fontWeight: 700,
            cursor: canSubmit ? "pointer" : "not-allowed",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            fontFamily: "inherit",
          }}>
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />}
            {submitting ? "Generating..." : "Generate & Copy Link"}
          </button>
        </div>
      )}

      {/* Recent Links section */}
      {recentLinks.length > 0 && (
        <div style={{ borderTop: "1px solid #E8E8EA", padding: "14px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4, color: "#8A8A8E", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            Recent Links
            <span style={{ fontSize: 11, fontWeight: 600, color: "#6D28D9", textTransform: "none", letterSpacing: 0, cursor: "pointer" }}>Dashboard →</span>
          </div>
          {recentLinks.map((link) => (
            <div key={link.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "1px solid #F7F7F8" }}>
              <div style={{ width: 26, height: 26, borderRadius: 5, background: "#EBEBEB", flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {link.asset_thumbnail ? <img src={link.asset_thumbnail} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Link2 size={12} style={{ color: "#8A8A8E" }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: '"SF Mono", "Fira Code", monospace', fontSize: 11, fontWeight: 600, color: "#1A1A1A" }}>{link.short_url.replace(/^https?:\/\/[^/]+/, "")}</div>
                <div style={{ fontSize: 10, color: "#8A8A8E" }}>{link.utm_content} · {timeAgo(link.created_at)}</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, color: link.click_count > 0 ? "#1A1A1A" : "#D4D4D4" }}>{link.click_count}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FieldReadonly({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={labelStyle}>{label}</div>
      <div style={{ fontSize: 13, padding: "9px 12px", borderRadius: 8, background: "#FAFAFA", color: "#1A1A1A", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={value}>
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
      <div style={labelStyle}>{label}</div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        style={inputStyle}
      />
    </div>
  );
}
