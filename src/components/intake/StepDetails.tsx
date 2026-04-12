"use client";

import { useState } from "react";
import { DollarSign, X } from "lucide-react";

interface StepDetailsProps {
  formData: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
  confidenceFlags: Record<string, string>;
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
    extracted: { bg: "#dcfce7", color: "#15803d", label: "extracted" },
    inferred: { bg: "#fef9c3", color: "#92400e", label: "inferred" },
    verify: { bg: "#fce7f3", color: "#9d174d", label: "verify" },
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

function TagInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      const trimmed = input.trim();
      if (trimmed && !value.includes(trimmed)) {
        onChange([...value, trimmed]);
      }
      setInput("");
    }
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: value.length ? 8 : 0 }}>
        {value.map((tag) => (
          <span
            key={tag}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 10px",
              borderRadius: 9999,
              background: "#F5F5F5",
              color: "#1A1A1A",
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                display: "flex",
                alignItems: "center",
                color: "#737373",
              }}
            >
              <X size={11} />
            </button>
          </span>
        ))}
      </div>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || "Type and press Enter to add…"}
        style={{
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
        }}
      />
    </div>
  );
}

function MoneyInput({
  value,
  onChange,
  placeholder,
}: {
  value: number | string | undefined;
  onChange: (val: number | null) => void;
  placeholder?: string;
}) {
  return (
    <div style={{ position: "relative" }}>
      <span
        style={{
          position: "absolute",
          left: 14,
          top: "50%",
          transform: "translateY(-50%)",
          color: "#737373",
          fontSize: 13,
          pointerEvents: "none",
        }}
      >
        $
      </span>
      <input
        type="number"
        min={0}
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? null : Number(v));
        }}
        placeholder={placeholder}
        style={{
          width: "100%",
          padding: "10px 14px 10px 28px",
          borderRadius: 10,
          border: "1px solid #E5E5E5",
          fontSize: 13,
          fontFamily: "inherit",
          background: "#FFFFFF",
          color: "#1A1A1A",
          outline: "none",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}

const URGENCY_OPTIONS = [
  { key: "urgent", label: "Urgent" },
  { key: "standard", label: "Standard" },
  { key: "pipeline", label: "Pipeline" },
];

const COMPENSATION_MODELS = [
  { value: "", label: "Select model…" },
  { value: "per_task", label: "Per Task" },
  { value: "per_hour", label: "Per Hour" },
  { value: "per_unit", label: "Per Unit" },
  { value: "fixed_project", label: "Fixed Project" },
  { value: "tbd", label: "TBD" },
];

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  color: "#737373",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: 8,
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

export default function StepDetails({ formData, onChange, confidenceFlags }: StepDetailsProps) {
  const s = (key: string, value: unknown) => set(key, value, formData, onChange);

  const targetRegions = (formData.target_regions as string[] | undefined) ?? [];
  const targetLanguages = (formData.target_languages as string[] | undefined) ?? [];

  return (
    <div style={{ maxWidth: 1600, margin: "0 auto", padding: "48px" }}>
      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1A1A1A", margin: 0 }}>Project Details</h2>
        <p style={{ fontSize: 13, color: "#737373", margin: "4px 0 0 0" }}>
          Title, volume, targeting, and budget
        </p>
      </div>

      {/* Main 2-column grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px 32px" }}>

        {/* 1. Project Title — full width */}
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>
            Project Title <span style={{ color: "#e11d48" }}>*</span>
            <ConfidenceBadge flag={confidenceFlags["title"]} />
          </label>
          <input
            type="text"
            value={(formData.title as string) ?? ""}
            onChange={(e) => s("title", e.target.value)}
            placeholder="e.g. Morocco Onsite Audio Collection — Arabic (Darija)"
            required
            style={inputStyle}
          />
        </div>

        {/* 2. Urgency — half width */}
        <div>
          <label style={labelStyle}>
            Urgency
            <ConfidenceBadge flag={confidenceFlags["urgency"]} />
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            {URGENCY_OPTIONS.map((opt) => {
              const selected = (formData.urgency as string) === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => s("urgency", opt.key)}
                  style={{
                    flex: 1,
                    padding: "10px 16px",
                    borderRadius: 9999,
                    border: selected ? "2px solid #32373C" : "1px solid #E5E5E5",
                    background: selected ? "#32373C" : "#FFFFFF",
                    color: selected ? "#FFFFFF" : "#1A1A1A",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    transition: "all 0.15s",
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Volume Needed — half width */}
        <div>
          <label style={labelStyle}>
            Contributors Needed
            <ConfidenceBadge flag={confidenceFlags["volume_needed"]} />
          </label>
          <input
            type="number"
            min={0}
            value={(formData.volume_needed as number | undefined) ?? ""}
            onChange={(e) => s("volume_needed", e.target.value === "" ? null : Number(e.target.value))}
            placeholder="e.g. 500"
            style={inputStyle}
          />
        </div>

        {/* 4. Target Regions — half width */}
        <div>
          <label style={labelStyle}>
            Target Regions
            <ConfidenceBadge flag={confidenceFlags["target_regions"]} />
          </label>
          <TagInput
            value={targetRegions}
            onChange={(tags) => s("target_regions", tags)}
            placeholder="Type region and press Enter…"
          />
        </div>

        {/* 5. Target Languages — half width */}
        <div>
          <label style={labelStyle}>
            Target Languages
            <ConfidenceBadge flag={confidenceFlags["target_languages"]} />
          </label>
          <TagInput
            value={targetLanguages}
            onChange={(tags) => s("target_languages", tags)}
            placeholder="Type language and press Enter…"
          />
        </div>

        {/* 6. Task Description — full width */}
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>
            Task Description
            <ConfidenceBadge flag={confidenceFlags["task_description"]} />
          </label>
          <textarea
            value={(formData.task_description as string) ?? ""}
            onChange={(e) => s("task_description", e.target.value)}
            placeholder="Describe the task in detail — what contributors will actually do..."
            rows={4}
            style={{
              ...inputStyle,
              resize: "vertical",
              lineHeight: 1.6,
            }}
          />
        </div>

        {/* 7. Target Demographic — half width */}
        <div>
          <label style={labelStyle}>
            Target Demographic
            <span style={{ color: "#737373", fontWeight: 400, textTransform: "none", letterSpacing: 0, marginLeft: 6 }}>
              (optional)
            </span>
            <ConfidenceBadge flag={confidenceFlags["demographic"]} />
          </label>
          <input
            type="text"
            value={(formData.demographic as string) ?? ""}
            onChange={(e) => s("demographic", e.target.value)}
            placeholder="e.g. working professionals 28-55 — leave blank to auto-detect"
            style={inputStyle}
          />
        </div>
      </div>

      {/* Compensation sub-section */}
      <div style={{ borderTop: "1px solid #E5E5E5", marginTop: 36, paddingTop: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
          <DollarSign size={16} color="#737373" />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#737373", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Compensation &amp; Budget
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "24px 32px" }}>

          {/* 8. Compensation Model */}
          <div>
            <label style={labelStyle}>
              Compensation Model
              <ConfidenceBadge flag={confidenceFlags["compensation_model"]} />
            </label>
            <select
              value={(formData.compensation_model as string) ?? ""}
              onChange={(e) => s("compensation_model", e.target.value)}
              style={{ ...inputStyle, cursor: "pointer" }}
            >
              {COMPENSATION_MODELS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* 9. Compensation Rate */}
          <div>
            <label style={labelStyle}>
              Rate / Amount
              <ConfidenceBadge flag={confidenceFlags["compensation_rate"]} />
            </label>
            <MoneyInput
              value={formData.compensation_rate as number | undefined}
              onChange={(val) => s("compensation_rate", val)}
              placeholder="0.00"
            />
          </div>

          {/* 10. Monthly Ad Budget */}
          <div>
            <label style={labelStyle}>
              Monthly Ad Budget
              <ConfidenceBadge flag={confidenceFlags["monthly_budget"]} />
            </label>
            <MoneyInput
              value={formData.monthly_budget as number | undefined}
              onChange={(val) => s("monthly_budget", val)}
              placeholder="0.00"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
