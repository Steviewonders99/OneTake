"use client";

import { useState } from "react";
import { DollarSign, X, UserPlus, Users, Search } from "lucide-react";
import CountryQuotaTable from "./CountryQuotaTable";
import type { CountryQuota } from "@/lib/types";
import type { LocaleLink } from "./LocaleLinksUpload";

interface RecruiterEntry {
  name: string;
  email: string;
  role: "lead" | "recruiter";
  regions: string[];
}

// Demo recruiter directory — will be replaced by Azure AD lookup
const RECRUITER_DIRECTORY: RecruiterEntry[] = [
  { name: "Steven Junop", email: "steven.junop@centific.com", role: "lead", regions: [] },
  { name: "Jennifer Martinez", email: "jennifer.martinez@centific.com", role: "recruiter", regions: [] },
  { name: "Priya Patel", email: "priya.patel@centific.com", role: "recruiter", regions: ["India", "Singapore"] },
  { name: "James Wilson", email: "james.wilson@centific.com", role: "recruiter", regions: ["United Kingdom", "Ireland"] },
  { name: "Sarah Chen", email: "sarah.chen@centific.com", role: "recruiter", regions: ["Australia", "New Zealand", "Singapore"] },
  { name: "David Okafor", email: "david.okafor@centific.com", role: "recruiter", regions: ["South Africa"] },
  { name: "Maria Silva", email: "maria.silva@centific.com", role: "recruiter", regions: ["Brazil", "Mexico"] },
  { name: "Tom Anderson", email: "tom.anderson@centific.com", role: "lead", regions: [] },
];

function RecruiterAssignment({ value, onChange }: { value: RecruiterEntry[]; onChange: (v: RecruiterEntry[]) => void }) {
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const assignedEmails = new Set(value.map(r => r.email));
  const filtered = RECRUITER_DIRECTORY.filter(r =>
    !assignedEmails.has(r.email) &&
    (r.name.toLowerCase().includes(search.toLowerCase()) || r.email.toLowerCase().includes(search.toLowerCase()))
  );

  const addRecruiter = (r: RecruiterEntry) => {
    onChange([...value, r]);
    setSearch("");
    setShowDropdown(false);
  };

  const removeRecruiter = (email: string) => {
    onChange(value.filter(r => r.email !== email));
  };

  const toggleRole = (email: string) => {
    onChange(value.map(r => r.email === email ? { ...r, role: r.role === "lead" ? "recruiter" : "lead" } : r));
  };

  return (
    <div>
      {/* Assigned list */}
      {value.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
          {value.map((r) => (
            <div key={r.email} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
              borderRadius: 10, border: "1px solid #E8E8EA", background: "#FFFFFF",
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 9999, background: r.role === "lead" ? "#EEF2FF" : "#F3F4F6",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 700, color: r.role === "lead" ? "#6D28D9" : "#6B7280",
              }}>
                {r.name.split(" ").map(n => n[0]).join("")}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1A1A" }}>{r.name}</div>
                <div style={{ fontSize: 11, color: "#8A8A8E" }}>{r.email}</div>
              </div>
              <button type="button" onClick={() => toggleRole(r.email)}
                style={{
                  padding: "3px 10px", borderRadius: 9999, fontSize: 10, fontWeight: 600,
                  border: "1px solid", cursor: "pointer", fontFamily: "inherit",
                  borderColor: r.role === "lead" ? "#6D28D9" : "#E5E5E5",
                  background: r.role === "lead" ? "#EEF2FF" : "#FFFFFF",
                  color: r.role === "lead" ? "#6D28D9" : "#8A8A8E",
                }}>
                {r.role === "lead" ? "Lead" : "Recruiter"}
              </button>
              {r.regions.length > 0 && (
                <div style={{ display: "flex", gap: 3 }}>
                  {r.regions.slice(0, 2).map(reg => (
                    <span key={reg} style={{ fontSize: 9, padding: "2px 6px", borderRadius: 9999, background: "#F3F4F6", color: "#6B7280" }}>
                      {reg}
                    </span>
                  ))}
                </div>
              )}
              <button type="button" onClick={() => removeRecruiter(r.email)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#D1D5DB", padding: 2 }}>
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search + add */}
      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, border: "1px solid #E5E5E5", background: "#FFFFFF" }}>
          <Search size={14} style={{ color: "#8A8A8E" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); }}
            onFocus={() => setShowDropdown(true)}
            placeholder="Search by name or email..."
            style={{ flex: 1, border: "none", outline: "none", fontSize: 13, fontFamily: "inherit", background: "transparent" }}
          />
          <span style={{ fontSize: 10, color: "#B0B0B0" }}>Azure AD</span>
        </div>
        {showDropdown && search.length > 0 && filtered.length > 0 && (
          <div style={{
            position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4,
            background: "#FFFFFF", borderRadius: 10, border: "1px solid #E5E5E5",
            boxShadow: "0 4px 16px rgba(0,0,0,0.08)", zIndex: 10, maxHeight: 200, overflowY: "auto",
          }}>
            {filtered.map((r) => (
              <button key={r.email} type="button" onClick={() => addRecruiter(r)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%",
                  padding: "8px 12px", border: "none", background: "none",
                  cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#F7F7F8"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}>
                <UserPlus size={14} style={{ color: "#6D28D9" }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1A1A1A" }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: "#8A8A8E" }}>{r.email}</div>
                </div>
                {r.regions.length > 0 && (
                  <span style={{ marginLeft: "auto", fontSize: 10, color: "#8A8A8E" }}>
                    {r.regions.join(", ")}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface StepDetailsProps {
  formData: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
  confidenceFlags: Record<string, string>;
  localeLinks?: LocaleLink[];
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

export default function StepDetails({ formData, onChange, confidenceFlags, localeLinks }: StepDetailsProps) {
  const s = (key: string, value: unknown) => set(key, value, formData, onChange);

  const targetRegions = (formData.target_regions as string[] | undefined) ?? [];
  const targetLanguages = (formData.target_languages as string[] | undefined) ?? [];

  return (
    <div style={{ maxWidth: 1600, width: "100%", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1A1A1A", margin: 0 }}>Project Details</h2>
        <p style={{ fontSize: 13, color: "#737373", margin: "4px 0 0 0" }}>
          Title, volume, targeting, and compensation
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
            Compensation
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px 32px" }}>

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
        </div>
      </div>

      {/* Assign Recruiters */}
      <div style={{ borderTop: "1px solid #E5E5E5", marginTop: 36, paddingTop: 32 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1A1A1A", marginBottom: 4 }}>
          Assign Recruiters
        </h3>
        <p style={{ fontSize: 12, color: "#8A8A8E", marginBottom: 16 }}>
          Select team members who will receive access to this project's deliverables. When Azure AD is connected, this will auto-populate from your org directory.
        </p>
        <RecruiterAssignment
          value={(formData.assigned_recruiters as RecruiterEntry[] | undefined) ?? []}
          onChange={(recruiters) => set("assigned_recruiters", recruiters, formData, onChange)}
        />
      </div>

      {/* Country Quotas & Demographics */}
      <div style={{ borderTop: "1px solid #E5E5E5", marginTop: 36, paddingTop: 32 }}>
        <CountryQuotaTable
          value={(formData.country_quotas as CountryQuota[] | undefined) ?? []}
          onChange={(quotas) => {
            const totalVolume = quotas.reduce((sum, q) => sum + q.total_volume, 0);
            onChange({
              ...formData,
              country_quotas: quotas,
              volume_needed: totalVolume > 0 ? totalVolume : formData.volume_needed,
            });
          }}
          targetRegions={(formData.target_regions as string[] | undefined) ?? []}
          localeLinks={localeLinks}
          defaultRate={(formData.compensation_rate as number | undefined) ?? 0}
          confidenceFlags={confidenceFlags}
        />
      </div>
    </div>
  );
}
