"use client";

import { LayoutGrid, FileText, Users, AlertCircle, Globe } from "lucide-react";

import type { CountryQuota } from "@/lib/types";

interface StepReviewProps {
  formData: Record<string, unknown>;
  taskType: string | null;
  workMode: "onsite" | "remote" | null;
  onEditStep: (step: number) => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function displayTaskType(type: string | null): string {
  if (!type) return "—";
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function displayWorkMode(mode: "onsite" | "remote" | null): string {
  if (!mode) return "—";
  return mode === "onsite" ? "Onsite Data Collection" : "Remote / Digital Recruitment";
}

function asString(val: unknown): string {
  if (val === null || val === undefined || val === "") return "—";
  return String(val);
}

function asArrayString(val: unknown): string {
  if (!val) return "—";
  if (Array.isArray(val)) return val.length > 0 ? val.join(", ") : "—";
  return String(val);
}

function truncate(val: unknown, max: number): string {
  const s = asString(val);
  if (s === "—") return s;
  return s.length > max ? s.slice(0, max) + "…" : s;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.4px",
  color: "#8A8A8E",
  marginBottom: 2,
};

const valueStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#1A1A1A",
  lineHeight: 1.5,
};

function ReviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={labelStyle}>{label}</div>
      <div style={valueStyle}>{value}</div>
    </div>
  );
}

interface SectionHeaderProps {
  icon: React.ReactNode;
  title: string;
  stepIndex: number;
  onEditStep: (step: number) => void;
}

function SectionHeader({ icon, title, stepIndex, onEditStep }: SectionHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "#6D28D9" }}>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#1A1A1A" }}>{title}</span>
      </div>
      <button
        onClick={() => onEditStep(stepIndex)}
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "#6D28D9",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "2px 6px",
          borderRadius: 6,
          fontFamily: "inherit",
        }}
      >
        Edit
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

// ─── Missing fields detector ──────────────────────────────────────────────────

interface MissingField {
  label: string;
  step: number;
}

function detectMissingFields(
  formData: Record<string, unknown>,
  taskType: string | null,
  workMode: "onsite" | "remote" | null,
): MissingField[] {
  const missing: MissingField[] = [];

  if (!taskType) missing.push({ label: "Task Type", step: 1 });
  if (!workMode) missing.push({ label: "Work Mode", step: 1 });
  if (!formData.title || !(formData.title as string).trim()) missing.push({ label: "Project Title", step: 2 });
  if (!formData.volume_needed) missing.push({ label: "Volume Needed", step: 2 });
  if (!formData.qualifications_required || !(formData.qualifications_required as string).trim()) missing.push({ label: "Required Qualifications", step: 3 });
  if (workMode === "onsite" && !formData.ada_form_url) missing.push({ label: "AIDA Screener URL", step: 3 });

  return missing;
}

export default function StepReview({
  formData,
  taskType,
  workMode,
  onEditStep,
}: StepReviewProps) {
  const countryQuotas = (formData.country_quotas as CountryQuota[] | undefined) ?? [];
  const missingFields = detectMissingFields(formData, taskType, workMode);
  const compensationModel = asString(formData.compensation_model);
  const compensationRate = formData.compensation_rate;
  const compensationDisplay =
    compensationModel !== "—" && compensationRate !== undefined && compensationRate !== ""
      ? `${compensationModel} — $${compensationRate}`
      : compensationModel !== "—"
      ? compensationModel
      : "—";

  const monthlyBudget =
    formData.monthly_budget !== undefined && formData.monthly_budget !== ""
      ? `$${formData.monthly_budget}`
      : "—";

  const adaUrl = asString(formData.ada_form_url);
  const adaDisplay =
    workMode === "onsite" ? (
      adaUrl !== "—" ? (
        <span style={{ wordBreak: "break-all" }}>{adaUrl}</span>
      ) : (
        <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#DC2626" }}>
          <AlertCircle size={13} />
          Required — URL not yet provided
        </span>
      )
    ) : null;

  const demographic = asString(formData.demographic);
  const taskDescription = truncate(formData.task_description, 100);
  const requiredQuals = truncate(formData.qualifications_required, 150);
  const preferredQuals = truncate(formData.qualifications_preferred, 150);

  return (
    <div
      style={{
        maxWidth: 1600,
        width: "100%",
        margin: "0 auto",
        padding: "48px 48px",
      }}
    >
      {/* Page header */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "#1A1A1A", margin: 0 }}>
          Review &amp; Submit
        </h2>
        <p style={{ fontSize: 13, color: "#8A8A8E", marginTop: 6, marginBottom: 0 }}>
          Double-check everything before submitting. Click &lsquo;Edit&rsquo; on any section to make changes.
        </p>
      </div>

      {/* Missing fields alert */}
      {missingFields.length > 0 && (
        <div
          style={{
            marginBottom: 20,
            padding: "14px 18px",
            borderRadius: 10,
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AlertCircle size={16} color="#DC2626" />
            <span style={{ fontSize: 13, fontWeight: 700, color: "#991B1B" }}>
              {missingFields.length} required field{missingFields.length > 1 ? "s" : ""} missing
            </span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {missingFields.map((f) => (
              <button
                key={f.label}
                onClick={() => onEditStep(f.step)}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "4px 12px",
                  borderRadius: 9999,
                  background: "#FFFFFF",
                  border: "1px solid #FECACA",
                  color: "#DC2626",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                {f.label}
                <span style={{ fontSize: 10, color: "#991B1B" }}>
                  Step {f.step}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Review card */}
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E8E8EA",
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        }}
      >
        {/* ── Section 1: Task & Mode ───────────────────────────────────── */}
        <div
          style={{
            padding: "28px 32px",
            borderBottom: "1px solid #E8E8EA",
          }}
        >
          <SectionHeader
            icon={<LayoutGrid size={15} />}
            title="Task & Mode"
            stepIndex={1}
            onEditStep={onEditStep}
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "16px 32px",
            }}
          >
            <ReviewRow label="Task Type" value={displayTaskType(taskType)} />
            <ReviewRow label="Work Mode" value={displayWorkMode(workMode)} />
          </div>
        </div>

        {/* ── Section 2: Project Details ───────────────────────────────── */}
        <div
          style={{
            padding: "28px 32px",
            borderBottom: "1px solid #E8E8EA",
          }}
        >
          <SectionHeader
            icon={<FileText size={15} />}
            title="Project Details"
            stepIndex={2}
            onEditStep={onEditStep}
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "16px 32px",
            }}
          >
            <ReviewRow label="Title" value={asString(formData.title)} />
            <ReviewRow
              label="Urgency"
              value={asString(formData.urgency).replace(/\b\w/g, (c) => c.toUpperCase())}
            />
            <ReviewRow label="Contributors Needed" value={asString(formData.volume_needed)} />
            <ReviewRow
              label="Target Regions"
              value={asArrayString(formData.target_regions)}
            />
            <ReviewRow
              label="Target Languages"
              value={asArrayString(formData.target_languages)}
            />
            <ReviewRow label="Compensation" value={compensationDisplay} />
            <ReviewRow label="Monthly Ad Budget" value={monthlyBudget} />
            {demographic !== "—" && (
              <ReviewRow label="Target Demographic" value={demographic} />
            )}
          </div>
          {taskDescription !== "—" && (
            <div style={{ marginTop: 16 }}>
              <ReviewRow label="Task Description" value={taskDescription} />
            </div>
          )}
        </div>

        {/* ── Section 2.5: Country Quotas ────────────────────────────────── */}
        {countryQuotas.length > 0 && (
          <div
            style={{
              padding: "28px 32px",
              borderBottom: "1px solid #E8E8EA",
            }}
          >
            <SectionHeader
              icon={<Globe size={15} />}
              title="Country Quotas"
              stepIndex={2}
              onEditStep={onEditStep}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {countryQuotas.map((q: CountryQuota) => (
                <div
                  key={q.country}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 16px",
                    background: "#F5F5F5",
                    borderRadius: 8,
                    fontSize: 13,
                  }}
                >
                  <span style={{ fontWeight: 600, color: "#1A1A1A" }}>{q.country}</span>
                  <div style={{ display: "flex", gap: 16, color: "#737373", fontSize: 12 }}>
                    <span>{q.total_volume.toLocaleString()} contributors</span>
                    <span>${q.rate.toFixed(2)}/person</span>
                    {q.demographics && q.demographics.length > 0 && (
                      <span>{q.demographics.length} demographic rule{q.demographics.length > 1 ? "s" : ""}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: "#737373", textAlign: "center" }}>
              {countryQuotas.length} {countryQuotas.length === 1 ? "country" : "countries"} | {countryQuotas.reduce((s: number, q: CountryQuota) => s + q.total_volume, 0).toLocaleString()} total contributors
            </div>
          </div>
        )}

        {/* ── Section 3: Requirements ──────────────────────────────────── */}
        <div style={{ padding: "28px 32px" }}>
          <SectionHeader
            icon={<Users size={15} />}
            title="Requirements"
            stepIndex={3}
            onEditStep={onEditStep}
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "16px 32px",
            }}
          >
            <div style={{ gridColumn: "1 / -1" }}>
              <ReviewRow
                label="Required Qualifications"
                value={requiredQuals}
              />
            </div>
            {preferredQuals !== "—" && (
              <div style={{ gridColumn: "1 / -1" }}>
                <ReviewRow
                  label="Preferred Qualifications"
                  value={preferredQuals}
                />
              </div>
            )}
            <ReviewRow
              label="Engagement Model"
              value={asString(formData.engagement_model)}
            />
            <ReviewRow
              label="Language Requirements"
              value={asString(formData.language_requirements)}
            />
            <div style={{ gridColumn: "1 / -1" }}>
              <ReviewRow
                label="Location & Work Setup"
                value={asString(formData.location_scope)}
              />
            </div>
            {workMode === "onsite" && (
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={labelStyle}>AIDA Screener URL</div>
                <div style={valueStyle}>{adaDisplay}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
