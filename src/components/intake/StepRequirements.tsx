"use client";

import { Shield, CheckSquare } from "lucide-react";

interface StepRequirementsProps {
  formData: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
  confidenceFlags: Record<string, string>;
  workMode: "onsite" | "remote" | null;
}

function set(
  key: string,
  value: unknown,
  formData: Record<string, unknown>,
  onChange: (data: Record<string, unknown>) => void
) {
  onChange({ ...formData, [key]: value });
}

function ConfidenceBadge({ flag }: { flag?: string }) {
  if (!flag) return null;
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    extracted: { bg: "#dcfce7", color: "#15803d", label: "Extracted" },
    inferred:  { bg: "#fef9c3", color: "#92400e", label: "Inferred" },
    verify:    { bg: "#fce7f3", color: "#9d174d", label: "Verify" },
  };
  const s = styles[flag];
  if (!s) return null;
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        padding: "2px 7px",
        borderRadius: 9999,
        background: s.bg,
        color: s.color,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        marginLeft: 8,
      }}
    >
      {s.label}
    </span>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  color: "#737373",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: 6,
};

const descStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#9CA3AF",
  marginBottom: 8,
  display: "block",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #E5E5E5",
  fontSize: 13,
  fontFamily: "inherit",
  background: "#FFFFFF",
  color: "#1A1A1A",
  outline: "none",
  boxSizing: "border-box",
  resize: "vertical",
  lineHeight: 1.6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #E5E5E5",
  fontSize: 13,
  fontFamily: "inherit",
  background: "#FFFFFF",
  color: "#1A1A1A",
  outline: "none",
  boxSizing: "border-box",
};

export default function StepRequirements({
  formData,
  onChange,
  confidenceFlags,
  workMode,
}: StepRequirementsProps) {
  const s = (key: string, value: unknown) => set(key, value, formData, onChange);

  return (
    <div style={{ maxWidth: 1600, width: "100%", margin: "0 auto", padding: "48px" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1A1A1A", margin: 0 }}>
          Requirements &amp; Qualifications
        </h2>
        <p style={{ fontSize: 13, color: "#737373", margin: "4px 0 0 0" }}>
          AI pre-filled these from your brief — please verify they&apos;re correct
        </p>
      </div>

      {/* Purple verify banner */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 16px",
          borderRadius: 10,
          background: "#F5F3FF",
          border: "1px solid #DDD6FE",
          marginBottom: 32,
        }}
      >
        <Shield size={16} color="#7C3AED" />
        <span style={{ fontSize: 13, fontWeight: 600, color: "#5B21B6" }}>
          Gemma 4 pre-filled these fields — please verify
        </span>
      </div>

      {/* 2-column grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px 32px" }}>

        {/* 1. Required Qualifications — full width */}
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>
            Required Qualifications <span style={{ color: "#e11d48" }}>*</span>
            <ConfidenceBadge flag={confidenceFlags["qualifications_required"] ?? "verify"} />
          </label>
          <span style={descStyle}>Credentials, skills, or experience candidates MUST have</span>
          <textarea
            value={(formData.qualifications_required as string) ?? ""}
            onChange={(e) => s("qualifications_required", e.target.value)}
            placeholder="e.g. Native speaker of Arabic (Darija dialect), smartphone with mic, quiet recording environment"
            rows={4}
            required
            style={textareaStyle}
          />
        </div>

        {/* 2. Preferred Qualifications — full width */}
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>
            Preferred Qualifications
            <span style={{ color: "#737373", fontWeight: 400, textTransform: "none", letterSpacing: 0, marginLeft: 6 }}>
              (optional)
            </span>
            <ConfidenceBadge flag={confidenceFlags["qualifications_preferred"] ?? "inferred"} />
          </label>
          <span style={descStyle}>Nice-to-haves that make a candidate stand out</span>
          <textarea
            value={(formData.qualifications_preferred as string) ?? ""}
            onChange={(e) => s("qualifications_preferred", e.target.value)}
            placeholder="e.g. Experience with audio recording apps, familiarity with linguistics tasks"
            rows={3}
            style={textareaStyle}
          />
        </div>

        {/* 3. Engagement Model — half width */}
        <div>
          <label style={labelStyle}>
            Engagement Model <span style={{ color: "#e11d48" }}>*</span>
            <ConfidenceBadge flag={confidenceFlags["engagement_model"] ?? "verify"} />
          </label>
          <span style={descStyle}>Hours, schedule, duration</span>
          <textarea
            value={(formData.engagement_model as string) ?? ""}
            onChange={(e) => s("engagement_model", e.target.value)}
            placeholder="e.g. Flexible, self-paced over 2 weeks, ~4 hours total"
            rows={3}
            required
            style={textareaStyle}
          />
        </div>

        {/* 4. Language Requirements — half width */}
        <div>
          <label style={labelStyle}>
            Language Requirements <span style={{ color: "#e11d48" }}>*</span>
            <ConfidenceBadge flag={confidenceFlags["language_requirements"] ?? "extracted"} />
          </label>
          <textarea
            value={(formData.language_requirements as string) ?? ""}
            onChange={(e) => s("language_requirements", e.target.value)}
            placeholder="e.g. Native Arabic (Darija), basic English for platform navigation"
            rows={3}
            required
            style={textareaStyle}
          />
        </div>

        {/* 5. Location & Work Setup — full width */}
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>
            Location &amp; Work Setup <span style={{ color: "#e11d48" }}>*</span>
            <ConfidenceBadge flag={confidenceFlags["location_scope"] ?? "verify"} />
          </label>
          <span style={descStyle}>Where candidates work, onsite requirements, cities</span>
          <textarea
            value={(formData.location_scope as string) ?? ""}
            onChange={(e) => s("location_scope", e.target.value)}
            placeholder="e.g. Morocco (Casablanca, Rabat, Marrakech) — remote, work from home"
            rows={3}
            required
            style={textareaStyle}
          />
        </div>
      </div>

      {/* ADA Compliance Section — conditional on onsite workMode */}
      {workMode === "onsite" && (
        <div
          style={{
            marginTop: 32,
            padding: "24px 28px",
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            borderRadius: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <CheckSquare size={16} color="#DC2626" />
            <span style={{ fontSize: 13, fontWeight: 700, color: "#991B1B" }}>
              AIDA Compliance Screening — Required for Onsite
            </span>
          </div>
          <p style={{ fontSize: 12, color: "#B91C1C", margin: "0 0 20px 0", lineHeight: 1.6 }}>
            Candidates must pass this form before being accepted to work onsite.
          </p>
          <div>
            <label style={{ ...labelStyle, color: "#991B1B" }}>
              AIDA Screener URL <span style={{ color: "#e11d48" }}>*</span>
            </label>
            <input
              type="text"
              value={(formData.ada_form_url as string) ?? ""}
              onChange={(e) => s("ada_form_url", e.target.value)}
              placeholder="https://forms.oneforma.com/aida-screener/..."
              required
              style={{
                ...inputStyle,
                border: "1px solid #FECACA",
                background: "#FFFFFF",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
