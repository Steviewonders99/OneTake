"use client";

import { useState, useCallback } from "react";
import { X, Upload, FileSpreadsheet, Globe, Image, FileText, Megaphone, Pencil, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface RequestAssetsModalProps {
  requestId: string;
  campaignTitle: string;
  onClose: () => void;
}

type RequestType = "creative" | "copy" | "wp_edit" | "lp_edit" | "locale_expansion";

const REQUEST_TYPES: { key: RequestType; label: string; icon: React.ReactNode; description: string }[] = [
  { key: "creative", label: "New Creatives", icon: <Image size={16} />, description: "Flyers, posters, social graphics, banners" },
  { key: "copy", label: "New Copy", icon: <FileText size={16} />, description: "Job board copy, social captions, email templates" },
  { key: "wp_edit", label: "Edit Job Post (WP)", icon: <Pencil size={16} />, description: "Update copy, rates, or details on the WordPress job post" },
  { key: "lp_edit", label: "Edit Landing Page", icon: <Globe size={16} />, description: "Update copy, rates, or details on the landing page" },
  { key: "locale_expansion", label: "Add New Locales", icon: <Plus size={16} />, description: "Expand to new countries/languages with bulk locale upload" },
];

const CREATIVE_FORMATS = [
  { value: "social_1x1", label: "Social Post — 1:1 (1080×1080)" },
  { value: "social_4x5", label: "Social Post — 4:5 (1080×1350)" },
  { value: "social_9x16", label: "Stories / Reels — 9:16 (1080×1920)" },
  { value: "flyer_a4", label: "Flyer — A4 Print (2480×3508)" },
  { value: "flyer_letter", label: "Flyer — US Letter (2550×3300)" },
  { value: "poster_a3", label: "Poster — A3 (3508×4960)" },
  { value: "banner_web", label: "Web Banner — Leaderboard (728×90)" },
  { value: "banner_wide", label: "Web Banner — Wide (970×250)" },
  { value: "email_header", label: "Email Header (600×200)" },
  { value: "linkedin_banner", label: "LinkedIn Company Banner (1128×191)" },
];

const COPY_PLATFORMS = [
  { value: "indeed", label: "Indeed" },
  { value: "linkedin_jobs", label: "LinkedIn Jobs" },
  { value: "seek", label: "Seek (AU/NZ)" },
  { value: "naukri", label: "Naukri (India)" },
  { value: "jobstreet", label: "JobStreet (SG)" },
  { value: "pnet", label: "PNet (South Africa)" },
  { value: "irishjobs", label: "IrishJobs (Ireland)" },
  { value: "reed", label: "Reed (UK)" },
  { value: "email_sequence", label: "Email Sequence" },
  { value: "social_caption", label: "Social Captions" },
  { value: "flyer_copy", label: "Flyer / Poster Copy" },
  { value: "other", label: "Other (specify in notes)" },
];

export default function RequestAssetsModal({ requestId, campaignTitle, onClose }: RequestAssetsModalProps) {
  const [requestType, setRequestType] = useState<RequestType | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Creative fields
  const [creativeFormats, setCreativeFormats] = useState<string[]>([]);
  const [creativeCount, setCreativeCount] = useState("3");
  const [creativeNotes, setCreativeNotes] = useState("");

  // Copy fields
  const [copyPlatforms, setCopyPlatforms] = useState<string[]>([]);
  const [copyCountries, setCopyCountries] = useState("");
  const [copyNotes, setCopyNotes] = useState("");

  // WP/LP edit fields
  const [editSection, setEditSection] = useState("rates");
  const [editDetails, setEditDetails] = useState("");

  // Locale expansion
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [localeNotes, setLocaleNotes] = useState("");

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith(".xlsx") || file.name.endsWith(".csv") || file.name.endsWith(".xls"))) {
      setUploadedFile(file);
    } else {
      toast.error("Please upload an Excel (.xlsx, .xls) or CSV file");
    }
  }, []);

  const handleSubmit = async () => {
    if (!requestType) return;
    setSubmitting(true);

    const payload: Record<string, unknown> = {
      request_type: requestType,
      campaign_id: requestId,
      campaign_title: campaignTitle,
    };

    if (requestType === "creative") {
      payload.formats = creativeFormats;
      payload.count_per_format = parseInt(creativeCount);
      payload.notes = creativeNotes;
    } else if (requestType === "copy") {
      payload.platforms = copyPlatforms;
      payload.countries = copyCountries;
      payload.notes = copyNotes;
    } else if (requestType === "wp_edit" || requestType === "lp_edit") {
      payload.section = editSection;
      payload.details = editDetails;
      payload.auto_update = true; // Flag for WP REST API automation
    } else if (requestType === "locale_expansion") {
      payload.notes = localeNotes;
      payload.has_file = !!uploadedFile;
      payload.filename = uploadedFile?.name;
    }

    try {
      await fetch(`/api/generate/${requestId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback: JSON.stringify(payload) }),
      });
      toast.success(
        requestType === "wp_edit" ? "Job post update queued — changes will go live automatically" :
        requestType === "lp_edit" ? "Landing page update queued — changes will go live automatically" :
        "Asset request submitted — your marketing team has been notified"
      );
      onClose();
    } catch {
      toast.error("Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleFormat = (v: string) => setCreativeFormats(prev => prev.includes(v) ? prev.filter(f => f !== v) : [...prev, v]);
  const togglePlatform = (v: string) => setCopyPlatforms(prev => prev.includes(v) ? prev.filter(p => p !== v) : [...prev, v]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)" }}
      onClick={onClose}>
      <div style={{ background: "#FFFFFF", borderRadius: 16, maxWidth: 600, width: "100%", margin: 16, maxHeight: "85vh", overflow: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: "20px 24px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1A1A1A", margin: 0 }}>Request New Assets</h2>
            <p style={{ fontSize: 13, color: "#8A8A8E", marginTop: 2 }}>{campaignTitle}</p>
          </div>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#8A8A8E" }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "16px 24px 24px" }}>
          {/* Step 1: Request type */}
          {!requestType && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#1A1A1A", marginBottom: 4 }}>What do you need?</p>
              {REQUEST_TYPES.map((type) => (
                <button key={type.key} type="button" onClick={() => setRequestType(type.key)}
                  style={{
                    display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 10,
                    border: "1px solid #E8E8EA", background: "#FFFFFF", cursor: "pointer",
                    textAlign: "left", fontFamily: "inherit", transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#6D28D9"; e.currentTarget.style.background = "#FAFAFE"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E8E8EA"; e.currentTarget.style.background = "#FFFFFF"; }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", color: "#6D28D9", flexShrink: 0 }}>
                    {type.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#1A1A1A" }}>{type.label}</div>
                    <div style={{ fontSize: 12, color: "#8A8A8E", marginTop: 1 }}>{type.description}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Step 2: Creative form */}
          {requestType === "creative" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <button type="button" onClick={() => setRequestType(null)} style={{ alignSelf: "flex-start", fontSize: 12, color: "#6D28D9", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
                ← Back
              </button>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#8A8A8E", textTransform: "uppercase", letterSpacing: 0.5 }}>Format(s) needed</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  {CREATIVE_FORMATS.map((f) => (
                    <button key={f.value} type="button" onClick={() => toggleFormat(f.value)}
                      style={{
                        padding: "5px 12px", borderRadius: 9999, fontSize: 11, fontWeight: 600,
                        border: "1px solid", cursor: "pointer", fontFamily: "inherit",
                        borderColor: creativeFormats.includes(f.value) ? "#6D28D9" : "#E5E5E5",
                        background: creativeFormats.includes(f.value) ? "#EEF2FF" : "#FFFFFF",
                        color: creativeFormats.includes(f.value) ? "#6D28D9" : "#6B7280",
                      }}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#8A8A8E", textTransform: "uppercase", letterSpacing: 0.5 }}>Variants per format</label>
                <select value={creativeCount} onChange={(e) => setCreativeCount(e.target.value)}
                  style={{ display: "block", marginTop: 6, padding: "8px 12px", borderRadius: 8, border: "1px solid #E5E5E5", fontSize: 13, fontFamily: "inherit", width: 120, cursor: "pointer" }}>
                  {["1","2","3","5","10"].map(n => <option key={n} value={n}>{n} variants</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#8A8A8E", textTransform: "uppercase", letterSpacing: 0.5 }}>Additional notes</label>
                <textarea value={creativeNotes} onChange={(e) => setCreativeNotes(e.target.value)}
                  placeholder="Specific imagery, messaging, or style requirements..."
                  style={{ display: "block", marginTop: 6, width: "100%", minHeight: 80, padding: 12, borderRadius: 10, border: "1px solid #E5E5E5", fontSize: 13, fontFamily: "inherit", resize: "vertical" }} />
              </div>
            </div>
          )}

          {/* Step 2: Copy form */}
          {requestType === "copy" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <button type="button" onClick={() => setRequestType(null)} style={{ alignSelf: "flex-start", fontSize: 12, color: "#6D28D9", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
                ← Back
              </button>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#8A8A8E", textTransform: "uppercase", letterSpacing: 0.5 }}>Platform(s)</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  {COPY_PLATFORMS.map((p) => (
                    <button key={p.value} type="button" onClick={() => togglePlatform(p.value)}
                      style={{
                        padding: "5px 12px", borderRadius: 9999, fontSize: 11, fontWeight: 600,
                        border: "1px solid", cursor: "pointer", fontFamily: "inherit",
                        borderColor: copyPlatforms.includes(p.value) ? "#059669" : "#E5E5E5",
                        background: copyPlatforms.includes(p.value) ? "#ECFDF5" : "#FFFFFF",
                        color: copyPlatforms.includes(p.value) ? "#059669" : "#6B7280",
                      }}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#8A8A8E", textTransform: "uppercase", letterSpacing: 0.5 }}>Target countries</label>
                <input type="text" value={copyCountries} onChange={(e) => setCopyCountries(e.target.value)}
                  placeholder="e.g., India, Singapore, Australia"
                  style={{ display: "block", marginTop: 6, width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #E5E5E5", fontSize: 13, fontFamily: "inherit" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#8A8A8E", textTransform: "uppercase", letterSpacing: 0.5 }}>Notes</label>
                <textarea value={copyNotes} onChange={(e) => setCopyNotes(e.target.value)}
                  placeholder="Tone, messaging focus, specific requirements..."
                  style={{ display: "block", marginTop: 6, width: "100%", minHeight: 80, padding: 12, borderRadius: 10, border: "1px solid #E5E5E5", fontSize: 13, fontFamily: "inherit", resize: "vertical" }} />
              </div>
            </div>
          )}

          {/* Step 2: WP/LP Edit form */}
          {(requestType === "wp_edit" || requestType === "lp_edit") && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <button type="button" onClick={() => setRequestType(null)} style={{ alignSelf: "flex-start", fontSize: 12, color: "#6D28D9", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
                ← Back
              </button>
              <div style={{ background: "#DBEAFE", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#1E40AF" }}>
                Changes will be applied automatically via {requestType === "wp_edit" ? "WordPress REST API" : "landing page system"}.
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#8A8A8E", textTransform: "uppercase", letterSpacing: 0.5 }}>What needs to change?</label>
                <select value={editSection} onChange={(e) => setEditSection(e.target.value)}
                  style={{ display: "block", marginTop: 6, padding: "8px 12px", borderRadius: 8, border: "1px solid #E5E5E5", fontSize: 13, fontFamily: "inherit", width: "100%", cursor: "pointer" }}>
                  <option value="rates">Compensation / Rates</option>
                  <option value="requirements">Requirements / Qualifications</option>
                  <option value="description">Job Description / Body Copy</option>
                  <option value="title">Job Title</option>
                  <option value="locations">Locations / Regions</option>
                  <option value="timeline">Timeline / Deadlines</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#8A8A8E", textTransform: "uppercase", letterSpacing: 0.5 }}>Details</label>
                <textarea value={editDetails} onChange={(e) => setEditDetails(e.target.value)}
                  placeholder={editSection === "rates" ? "e.g., Update compensation from $15/hr to $18/hr for UK and Australia..." : "Describe the specific changes needed..."}
                  style={{ display: "block", marginTop: 6, width: "100%", minHeight: 100, padding: 12, borderRadius: 10, border: "1px solid #E5E5E5", fontSize: 13, fontFamily: "inherit", resize: "vertical" }} />
              </div>
            </div>
          )}

          {/* Step 2: Locale expansion */}
          {requestType === "locale_expansion" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <button type="button" onClick={() => setRequestType(null)} style={{ alignSelf: "flex-start", fontSize: 12, color: "#6D28D9", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
                ← Back
              </button>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#8A8A8E", textTransform: "uppercase", letterSpacing: 0.5 }}>Upload locale spreadsheet</label>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleFileDrop}
                  style={{
                    marginTop: 8, padding: 32, borderRadius: 12,
                    border: `2px dashed ${dragOver ? "#6D28D9" : "#E5E5E5"}`,
                    background: dragOver ? "#FAFAFE" : "#F7F7F8",
                    textAlign: "center", cursor: "pointer", transition: "all 0.15s",
                  }}
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = ".xlsx,.xls,.csv";
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file) setUploadedFile(file);
                    };
                    input.click();
                  }}
                >
                  {uploadedFile ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                      <FileSpreadsheet size={20} style={{ color: "#059669" }} />
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#1A1A1A" }}>{uploadedFile.name}</span>
                      <button type="button" onClick={(e) => { e.stopPropagation(); setUploadedFile(null); }}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#EF4444", padding: 2 }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload size={24} style={{ color: "#8A8A8E", margin: "0 auto 8px" }} />
                      <p style={{ fontSize: 13, color: "#8A8A8E", margin: 0 }}>
                        Drag & drop your Excel file here
                      </p>
                      <p style={{ fontSize: 11, color: "#B0B0B0", marginTop: 4 }}>
                        .xlsx, .xls, or .csv — columns: locale, language, country, apply_url
                      </p>
                    </>
                  )}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#8A8A8E", textTransform: "uppercase", letterSpacing: 0.5 }}>Notes</label>
                <textarea value={localeNotes} onChange={(e) => setLocaleNotes(e.target.value)}
                  placeholder="Any special requirements for the new locales..."
                  style={{ display: "block", marginTop: 6, width: "100%", minHeight: 80, padding: 12, borderRadius: 10, border: "1px solid #E5E5E5", fontSize: 13, fontFamily: "inherit", resize: "vertical" }} />
              </div>
            </div>
          )}

          {/* Submit button */}
          {requestType && (
            <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setRequestType(null)}
                style={{ padding: "8px 20px", borderRadius: 9999, border: "1px solid #E5E5E5", background: "#FFFFFF", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", color: "#6B7280" }}>
                Back
              </button>
              <button type="button" onClick={handleSubmit} disabled={submitting}
                style={{
                  padding: "8px 24px", borderRadius: 9999, fontSize: 13, fontWeight: 600,
                  border: "none", cursor: "pointer", fontFamily: "inherit",
                  background: (requestType === "wp_edit" || requestType === "lp_edit") ? "linear-gradient(135deg, #0693E3, #9B51E0)" : "#32373C",
                  color: "#FFFFFF", display: "flex", alignItems: "center", gap: 6,
                }}>
                {submitting && <Loader2 size={14} className="animate-spin" />}
                {(requestType === "wp_edit" || requestType === "lp_edit") ? "Apply Changes" : "Submit Request"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
