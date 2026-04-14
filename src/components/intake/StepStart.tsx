"use client";

import { useState, useRef, useEffect, DragEvent } from "react";
import { Upload, ClipboardPaste, Loader2 } from "lucide-react";
import { ExtractionResult } from "@/lib/types";

interface StepStartProps {
  onExtracted: (result: ExtractionResult) => void;
  onSkip: () => void;
  onExtractingChange?: (extracting: boolean) => void;
  onRegisterExtract?: (fn: () => void) => void;
}

export default function StepStart({ onExtracted, onSkip, onExtractingChange, onRegisterExtract }: StepStartProps) {
  const [entryMode, setEntryMode] = useState<"upload" | "paste" | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canExtract =
    (entryMode === "paste" && pasteText.trim().length > 20) ||
    entryMode === "upload";

  async function handlePasteExtract() {
    if (!pasteText.trim()) return;
    setExtracting(true);
    onExtractingChange?.(true);
    setError(null);
    try {
      const res = await fetch("/api/extract/paste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: pasteText }),
      });
      if (!res.ok) throw new Error(`Extract failed: ${res.status}`);
      const data = await res.json();
      onExtracted(data.extraction as ExtractionResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extraction failed. Try again.");
    } finally {
      setExtracting(false);
      onExtractingChange?.(false);
    }
  }

  async function handleFileExtract(file: File) {
    setExtracting(true);
    onExtractingChange?.(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/extract/rfp", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error(`Extract failed: ${res.status}`);
      const data = await res.json();
      onExtracted(data.extraction as ExtractionResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extraction failed. Try again.");
    } finally {
      setExtracting(false);
      onExtractingChange?.(false);
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileExtract(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileExtract(file);
  }

  function handleExtractClick() {
    if (entryMode === "paste") {
      handlePasteExtract();
    }
  }

  // Register extract trigger so WizardNav can call it
  useEffect(() => {
    onRegisterExtract?.(handleExtractClick);
  });

  const purple = "#6D28D9";
  const muted = "#8A8A8E";
  const border = "#E8E8EA";
  const charcoal = "#32373C";

  // ── Extraction loading screen ──────────────────────────────────────
  if (extracting) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "80px 40px",
          minHeight: "60vh",
        }}
      >
        {/* Gradient accent line */}
        <div
          style={{
            width: 60,
            height: 3,
            borderRadius: 2,
            background: "linear-gradient(135deg, #7C3AED, #6D28D9)",
            marginBottom: 32,
          }}
        />

        {/* Bouncing dots */}
        <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: i % 2 === 0 ? "#6D28D9" : "#CD128A",
                animation: `novaBounce 1.4s ease-in-out ${i * 0.16}s infinite`,
              }}
            />
          ))}
        </div>

        {/* Status text */}
        <h2
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: "#1A1A1A",
            margin: "0 0 8px",
            fontFamily: "inherit",
          }}
        >
          Nova is analyzing your brief
        </h2>
        <p
          style={{
            fontSize: 14,
            color: "#8A8A8E",
            margin: 0,
            textAlign: "center",
            maxWidth: 400,
            lineHeight: 1.6,
          }}
        >
          Extracting task type, requirements, qualifications, and compensation details using Gemma 4...
        </p>

        {/* Subtle progress stages */}
        <div
          style={{
            marginTop: 32,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            fontSize: 12,
            color: "#B0B0B5",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#6D28D9", animation: "novaPulse 2s ease-in-out infinite" }} />
            Reading document structure...
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, animationDelay: "0.5s" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#8A8A8E", animation: "novaPulse 2s ease-in-out 0.5s infinite" }} />
            Identifying key requirements...
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#8A8A8E", animation: "novaPulse 2s ease-in-out 1s infinite" }} />
            Mapping to intake fields...
          </div>
        </div>

        <style>{`
          @keyframes novaBounce {
            0%, 80%, 100% { transform: translateY(0); }
            40% { transform: translateY(-14px); }
          }
          @keyframes novaPulse {
            0%, 100% { opacity: 0.4; }
            50% { opacity: 1; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "40px",
      }}
    >
      {/* Step card */}
      <div
        style={{
          background: "white",
          borderRadius: 16,
          border: `1px solid ${border}`,
          width: "100%",
          maxWidth: 1600,
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "32px 48px",
            borderBottom: `1px solid ${border}`,
          }}
        >
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: "-0.3px",
              marginBottom: 4,
              color: "#1A1A1A",
            }}
          >
            How would you like to start?
          </div>
          <div style={{ fontSize: 13, color: muted, lineHeight: 1.5 }}>
            Upload an RFP or paste a job description — AI will pre-fill the form
            for you. Or skip to fill manually.
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "36px 48px" }}>
          {/* Choice cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 20,
            }}
          >
            {/* Upload RFP card */}
            <div
              onClick={() => setEntryMode("upload")}
              style={{
                padding: "32px 28px",
                borderRadius: 14,
                border: `2px ${entryMode === "upload" ? "solid" : "dashed"} ${
                  entryMode === "upload" ? purple : border
                }`,
                textAlign: "center",
                cursor: "pointer",
                transition: "all 0.15s",
                boxShadow:
                  entryMode === "upload"
                    ? "0 0 0 3px rgba(109,40,217,0.06)"
                    : "none",
                background: entryMode === "upload" ? "white" : "white",
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  margin: "0 auto 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background:
                    entryMode === "upload"
                      ? "rgba(109,40,217,0.06)"
                      : "#F7F7F8",
                  color: entryMode === "upload" ? purple : charcoal,
                }}
              >
                <Upload size={24} />
              </div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  marginBottom: 4,
                  color: "#1A1A1A",
                }}
              >
                Upload RFP
              </div>
              <div style={{ fontSize: 12, color: muted, lineHeight: 1.5 }}>
                Drag &amp; drop a PDF, Word, or text file. Gemma 4 extracts all
                fields automatically.
              </div>
            </div>

            {/* Paste JD card */}
            <div
              onClick={() => setEntryMode("paste")}
              style={{
                padding: "32px 28px",
                borderRadius: 14,
                border: `2px ${entryMode === "paste" ? "solid" : "dashed"} ${
                  entryMode === "paste" ? purple : border
                }`,
                textAlign: "center",
                cursor: "pointer",
                transition: "all 0.15s",
                boxShadow:
                  entryMode === "paste"
                    ? "0 0 0 3px rgba(109,40,217,0.06)"
                    : "none",
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  margin: "0 auto 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background:
                    entryMode === "paste"
                      ? "rgba(109,40,217,0.06)"
                      : "#F7F7F8",
                  color: entryMode === "paste" ? purple : charcoal,
                }}
              >
                <ClipboardPaste size={24} />
              </div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  marginBottom: 4,
                  color: "#1A1A1A",
                }}
              >
                Paste Job Description
              </div>
              <div style={{ fontSize: 12, color: muted, lineHeight: 1.5 }}>
                Paste the JD, email, or brief. AI reads it and fills out
                everything it can.
              </div>
            </div>
          </div>

          {/* Paste textarea (shown when paste selected) */}
          {entryMode === "paste" && !extracting && (
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={`Paste the job description, RFP text, or recruitment brief here...

Example:
We need 500 dermatology study participants in 12 US metro areas. Must have diagnosed skin condition. Compensation: $50-200 per session. Onsite at partner clinics. 3-6 month project.`}
              style={{
                marginTop: 24,
                width: "100%",
                minHeight: 200,
                padding: "18px",
                borderRadius: 12,
                border: `1px solid ${border}`,
                background: "#FAFAFA",
                fontSize: 13,
                fontFamily: "inherit",
                lineHeight: 1.6,
                color: "#444",
                resize: "vertical",
                outline: "none",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = purple;
                e.currentTarget.style.boxShadow =
                  "0 0 0 2px rgba(109,40,217,0.06)";
                e.currentTarget.style.background = "white";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = border;
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.background = "#FAFAFA";
              }}
            />
          )}

          {/* Upload dropzone (shown when upload selected) */}
          {entryMode === "upload" && !extracting && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                marginTop: 24,
                padding: "40px 28px",
                border: `2px dashed ${dragOver ? purple : border}`,
                borderRadius: 12,
                textAlign: "center",
                background: dragOver ? "rgba(109,40,217,0.02)" : "#FAFAFA",
                transition: "all 0.15s",
                cursor: "pointer",
              }}
            >
              <div style={{ color: muted, marginBottom: 10, display: "flex", justifyContent: "center" }}>
                <Upload size={32} />
              </div>
              <div style={{ fontSize: 13, color: muted }}>
                Drop your file here, or{" "}
                <span
                  style={{ color: purple, cursor: "pointer", fontWeight: 600 }}
                >
                  browse to upload
                </span>
              </div>
              <div style={{ fontSize: 11, color: "#B0B0B0", marginTop: 6 }}>
                PDF, Word (.docx), or plain text (.txt)
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
            </div>
          )}

          {/* AI processing spinner */}
          {extracting && (
            <div
              style={{
                marginTop: 20,
                padding: "14px 18px",
                background: "rgba(109,40,217,0.04)",
                border: "1px solid rgba(109,40,217,0.12)",
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <Loader2
                size={20}
                style={{
                  color: purple,
                  animation: "spin 0.8s linear infinite",
                  flexShrink: 0,
                }}
              />
              <div>
                <div
                  style={{ fontSize: 12, fontWeight: 600, color: purple }}
                >
                  Gemma 4 is reading your brief...
                </div>
                <div style={{ fontSize: 11, color: muted }}>
                  Extracting task type, requirements, regions, compensation, and
                  more
                </div>
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div
              style={{
                marginTop: 16,
                padding: "12px 16px",
                background: "#FEF2F2",
                border: "1px solid #FECACA",
                borderRadius: 8,
                fontSize: 13,
                color: "#991B1B",
              }}
            >
              {error}
            </div>
          )}

          {/* Buttons handled by WizardNav at the bottom */}

          {/* No mode selected — show skip */}
          {/* No-mode skip also handled by WizardNav */}
        </div>
      </div>

      {/* Keyframe animation for spinner */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
