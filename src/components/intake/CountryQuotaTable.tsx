"use client";

import { useState } from "react";
import { Plus, ChevronDown, ChevronRight, Trash2, Globe } from "lucide-react";
import type { CountryQuota, DemographicQuota } from "@/lib/types";
import type { LocaleLink } from "./LocaleLinksUpload";

// ── Budget recommendation helpers ────────────────────────────────────

const RECOGNITION_RATE = 0.85;
const CPA_TARGET_PCT = 0.20;
const BUDGET_MULTIPLIER = 6;

function calculateBudgetRec(rate: number, volume: number) {
  const rpp = rate * RECOGNITION_RATE;
  const targetCPA = rpp * CPA_TARGET_PCT;
  const recBudget = targetCPA * BUDGET_MULTIPLIER * volume;
  return {
    rpp: Math.round(rpp * 100) / 100,
    targetCPA: Math.round(targetCPA * 100) / 100,
    recBudget: Math.round(recBudget),
  };
}

// ── Empty defaults ────────────────────────────────────────────────────

function makeEmptyDemographic(): DemographicQuota {
  return { category: "", value: "", percentage: 0, volume: 0 };
}

function makeEmptyQuota(country: string, defaultRate = 0): CountryQuota {
  return {
    country,
    locale: "",
    total_volume: 0,
    rate: defaultRate,
    currency: "USD",
    url: "",
    demographics: [],
  };
}

// ── Prop types ────────────────────────────────────────────────────────

interface CountryQuotaTableProps {
  value: CountryQuota[];
  onChange: (quotas: CountryQuota[]) => void;
  targetRegions: string[];
  localeLinks?: LocaleLink[];
  defaultRate?: number;
  confidenceFlags: Record<string, string>;
}

// ── Shared styles ─────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  color: "#737373",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #E5E5E5",
  fontSize: 13,
  fontFamily: "inherit",
  background: "#FFFFFF",
  color: "#1A1A1A",
  outline: "none",
  boxSizing: "border-box",
};

// ── CountryCard ───────────────────────────────────────────────────────

function CountryCard({
  quota,
  index,
  onUpdate,
  onRemove,
  defaultExpanded,
}: {
  quota: CountryQuota;
  index: number;
  onUpdate: (updated: CountryQuota) => void;
  onRemove: () => void;
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  function updateField<K extends keyof CountryQuota>(key: K, val: CountryQuota[K]) {
    onUpdate({ ...quota, [key]: val });
  }

  function updateDemographic(i: number, field: keyof DemographicQuota, val: string | number) {
    const updated = quota.demographics.map((d, idx) => {
      if (idx !== i) return d;
      const next = { ...d, [field]: val };
      if (field === "percentage" || field === "volume") {
        const pct = field === "percentage" ? Number(val) : d.percentage;
        next.volume = Math.round(quota.total_volume * pct / 100);
        if (field === "volume") {
          next.percentage = quota.total_volume > 0 ? Math.round(Number(val) / quota.total_volume * 100) : 0;
          next.volume = Number(val);
        }
      }
      return next;
    });
    onUpdate({ ...quota, demographics: updated });
  }

  function addDemographic() {
    onUpdate({ ...quota, demographics: [...quota.demographics, makeEmptyDemographic()] });
  }

  function removeDemographic(i: number) {
    onUpdate({ ...quota, demographics: quota.demographics.filter((_, idx) => idx !== i) });
  }

  // Recalculate volumes when total_volume changes
  function handleVolumeChange(vol: number) {
    const demographics = quota.demographics.map((d) => ({
      ...d,
      volume: Math.round(vol * d.percentage / 100),
    }));
    onUpdate({ ...quota, total_volume: vol, demographics });
  }

  // Check per-category percentage sums for warning
  const catSums: Record<string, number> = {};
  for (const d of quota.demographics) {
    if (d.category) catSums[d.category] = (catSums[d.category] ?? 0) + d.percentage;
  }

  const budgetRec = quota.rate > 0 && quota.total_volume > 0
    ? calculateBudgetRec(quota.rate, quota.total_volume)
    : null;

  return (
    <div
      style={{
        border: "1px solid #E5E5E5",
        borderRadius: 12,
        background: "#FFFFFF",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        overflow: "hidden",
      }}
    >
      {/* Card header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "14px 18px",
          cursor: "pointer",
          background: expanded ? "#FAFAFA" : "#FFFFFF",
          borderBottom: expanded ? "1px solid #E5E5E5" : "none",
          userSelect: "none",
        }}
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? <ChevronDown size={15} color="#737373" /> : <ChevronRight size={15} color="#737373" />}
        <Globe size={14} color="#737373" />
        <span style={{ fontSize: 14, fontWeight: 700, color: "#1A1A1A", flex: 1 }}>
          {quota.country || `Country ${index + 1}`}
        </span>
        {!expanded && (
          <span style={{ fontSize: 12, color: "#737373" }}>
            {quota.total_volume > 0 ? quota.total_volume.toLocaleString() : "—"} contributors
            {quota.rate > 0 ? ` · $${quota.rate.toFixed(2)}/person` : ""}
            {quota.demographics.length > 0 ? ` · ${quota.demographics.length} demo rule${quota.demographics.length > 1 ? "s" : ""}` : ""}
          </span>
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 4,
            color: "#737373",
            display: "flex",
            alignItems: "center",
          }}
          title="Remove country"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {expanded && (
        <div style={{ padding: "16px 18px" }}>

          {/* Volume / Rate / Locale row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 0 }}>
            <div>
              <label style={labelStyle}>Country</label>
              <input
                type="text"
                value={quota.country}
                onChange={(e) => updateField("country", e.target.value)}
                placeholder="United States"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Volume (contributors)</label>
              <input
                type="number"
                min={0}
                value={quota.total_volume || ""}
                onChange={(e) => handleVolumeChange(e.target.value === "" ? 0 : Number(e.target.value))}
                placeholder="1000"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Rate (USD/person)</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#737373", fontSize: 13, pointerEvents: "none" }}>$</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={quota.rate || ""}
                  onChange={(e) => updateField("rate", e.target.value === "" ? 0 : Number(e.target.value))}
                  placeholder="30.00"
                  style={{ ...inputStyle, paddingLeft: 24 }}
                />
              </div>
            </div>
          </div>

          {/* Locale / URL row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12, marginTop: 12 }}>
            <div>
              <label style={labelStyle}>Locale</label>
              <input
                type="text"
                value={quota.locale}
                onChange={(e) => updateField("locale", e.target.value)}
                placeholder="en_US"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Job Posting URL</label>
              <input
                type="url"
                value={quota.url ?? ""}
                onChange={(e) => updateField("url", e.target.value)}
                placeholder="https://..."
                style={inputStyle}
              />
            </div>
          </div>

          {/* Budget Recommendation */}
          {budgetRec && (
            <div style={{
              margin: "12px 0",
              padding: "10px 14px",
              background: "linear-gradient(135deg, rgba(3,72,178,0.04), rgba(170,24,141,0.04))",
              borderRadius: 8,
              border: "1px solid #E5E5E5",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 12,
            }}>
              <div>
                <span style={{ color: "#737373" }}>Target CPA: </span>
                <span style={{ fontWeight: 700, color: "#1A1A1A" }}>
                  ${calculateBudgetRec(quota.rate, quota.total_volume).targetCPA.toFixed(2)}
                </span>
              </div>
              <div>
                <span style={{ color: "#737373" }}>Rec. Budget: </span>
                <span style={{ fontWeight: 700, color: "#1A1A1A" }}>
                  ${calculateBudgetRec(quota.rate, quota.total_volume).recBudget.toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {/* Demographics section */}
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Demographics</label>
              <button
                type="button"
                onClick={addDemographic}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#32373C",
                  background: "none",
                  border: "1px solid #E5E5E5",
                  borderRadius: 9999,
                  padding: "4px 10px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <Plus size={11} />
                Add Requirement
              </button>
            </div>

            {quota.demographics.length === 0 ? (
              <div style={{ fontSize: 12, color: "#9CA3AF", fontStyle: "italic", padding: "8px 0" }}>
                No demographic requirements — click "Add Requirement" to specify quotas
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {/* Header row */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 80px 80px 32px", gap: 8, padding: "0 4px" }}>
                  {["Category", "Value", "%", "Volume", ""].map((h) => (
                    <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {h}
                    </span>
                  ))}
                </div>

                {quota.demographics.map((demo, di) => {
                  const catSum = demo.category ? catSums[demo.category] ?? 0 : 0;
                  const overLimit = demo.category && catSum > 100;
                  return (
                    <div
                      key={di}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 80px 80px 32px",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      <input
                        type="text"
                        value={demo.category}
                        onChange={(e) => updateDemographic(di, "category", e.target.value)}
                        placeholder="Ethnicity"
                        style={{ ...inputStyle, padding: "6px 10px", border: overLimit ? "1px solid #FDE68A" : "1px solid #E5E5E5" }}
                      />
                      <input
                        type="text"
                        value={demo.value}
                        onChange={(e) => updateDemographic(di, "value", e.target.value)}
                        placeholder="Middle Eastern"
                        style={{ ...inputStyle, padding: "6px 10px" }}
                      />
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={demo.percentage || ""}
                        onChange={(e) => updateDemographic(di, "percentage", e.target.value === "" ? 0 : Number(e.target.value))}
                        placeholder="50"
                        style={{ ...inputStyle, padding: "6px 10px", border: overLimit ? "1px solid #FDE68A" : "1px solid #E5E5E5" }}
                      />
                      <div style={{
                        padding: "6px 10px",
                        borderRadius: 10,
                        background: "#F5F5F5",
                        fontSize: 13,
                        color: "#737373",
                        textAlign: "right",
                      }}>
                        {demo.volume > 0 ? demo.volume.toLocaleString() : "—"}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeDemographic(di)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", display: "flex", alignItems: "center", justifyContent: "center", padding: 4 }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Card footer */}
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #E5E5E5", fontSize: 12, color: "#737373" }}>
            {quota.total_volume > 0 ? quota.total_volume.toLocaleString() : "0"} contributors
            {quota.rate > 0 ? ` · $${quota.rate.toFixed(2)}/person` : ""}
            {quota.currency ? ` · ${quota.currency}` : ""}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────

export default function CountryQuotaTable({
  value,
  onChange,
  targetRegions,
  localeLinks,
  defaultRate = 0,
  confidenceFlags: _confidenceFlags,
}: CountryQuotaTableProps) {
  const [newCountry, setNewCountry] = useState("");

  function addCountry(name?: string) {
    const country = (name ?? newCountry).trim();
    if (!country) return;
    if (value.some((q) => q.country.toLowerCase() === country.toLowerCase())) return;
    // Try to merge from locale_links if available
    let quota = makeEmptyQuota(country, defaultRate);
    if (localeLinks) {
      const match = localeLinks.find(
        (ll) => ll.location.toLowerCase().includes(country.toLowerCase()) ||
                country.toLowerCase().includes(ll.location.toLowerCase())
      );
      if (match) {
        quota = {
          ...quota,
          locale: match.locale,
          url: match.url,
          rate: parseFloat(match.rate) || defaultRate,
        };
      }
    }
    onChange([...value, quota]);
    setNewCountry("");
  }

  function removeCountry(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function updateQuota(index: number, updated: CountryQuota) {
    onChange(value.map((q, i) => (i === index ? updated : q)));
  }

  // Summary stats
  const totalContributors = value.reduce((sum, q) => sum + (q.total_volume || 0), 0);
  const avgRate = value.length > 0
    ? value.reduce((sum, q) => sum + (q.rate || 0), 0) / value.filter((q) => q.rate > 0).length || 0
    : 0;

  const totalRecBudget = value.reduce((sum, q) => {
    if (q.rate > 0 && q.total_volume > 0) {
      return sum + calculateBudgetRec(q.rate, q.total_volume).recBudget;
    }
    return sum;
  }, 0);

  // Suggest unmatched target regions
  const unmatched = targetRegions.filter(
    (r) => !value.some((q) => q.country.toLowerCase() === r.toLowerCase())
  );

  return (
    <div>
      {/* Section header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16, gap: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1A1A1A" }}>Country Quotas &amp; Demographics</div>
          <div style={{ fontSize: 11, color: "#8A8A8E", marginTop: 2 }}>Per-country volume, rates, and demographic requirements</div>
        </div>
      </div>

      {/* Unmatched regions suggestion */}
      {unmatched.length > 0 && (
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          padding: "10px 14px",
          background: "#F0F9FF",
          border: "1px solid #BAE6FD",
          borderRadius: 10,
          marginBottom: 14,
        }}>
          <span style={{ fontSize: 12, color: "#0369A1", fontWeight: 600, marginRight: 4 }}>Add from target regions:</span>
          {unmatched.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => addCountry(r)}
              style={{
                fontSize: 12,
                padding: "3px 10px",
                borderRadius: 9999,
                background: "#FFFFFF",
                border: "1px solid #7DD3FC",
                color: "#0369A1",
                cursor: "pointer",
                fontFamily: "inherit",
                fontWeight: 500,
              }}
            >
              + {r}
            </button>
          ))}
        </div>
      )}

      {/* Country cards */}
      {value.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
          {value.map((quota, i) => (
            <CountryCard
              key={i}
              quota={quota}
              index={i}
              onUpdate={(updated) => updateQuota(i, updated)}
              onRemove={() => removeCountry(i)}
              defaultExpanded={value.length <= 5}
            />
          ))}
        </div>
      )}

      {/* Add country row */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          type="text"
          value={newCountry}
          onChange={(e) => setNewCountry(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCountry(); } }}
          placeholder="Add a country (press Enter)"
          style={{ ...inputStyle, flex: 1, maxWidth: 280 }}
        />
        <button
          type="button"
          onClick={() => addCountry()}
          disabled={!newCountry.trim()}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 16px",
            borderRadius: 9999,
            background: newCountry.trim() ? "#32373C" : "#E5E5E5",
            color: newCountry.trim() ? "#FFFFFF" : "#9CA3AF",
            border: "none",
            fontSize: 13,
            fontWeight: 600,
            cursor: newCountry.trim() ? "pointer" : "not-allowed",
            fontFamily: "inherit",
            transition: "all 0.15s",
          }}
        >
          <Plus size={13} />
          Add Country
        </button>
      </div>

      {/* Summary footer */}
      {value.length > 0 && (
        <div style={{
          marginTop: 16,
          padding: "12px 18px",
          background: "#F5F5F5",
          borderRadius: 10,
          fontSize: 13,
          color: "#737373",
          display: "flex",
          gap: 4,
          flexWrap: "wrap",
        }}>
          <span style={{ fontWeight: 600, color: "#1A1A1A" }}>{value.length}</span>
          <span>countries</span>
          <span style={{ color: "#D1D5DB", margin: "0 4px" }}>|</span>
          <span style={{ fontWeight: 600, color: "#1A1A1A" }}>{totalContributors.toLocaleString()}</span>
          <span>contributors</span>
          {avgRate > 0 && (
            <>
              <span style={{ color: "#D1D5DB", margin: "0 4px" }}>|</span>
              <span>Avg rate:</span>
              <span style={{ fontWeight: 600, color: "#1A1A1A" }}>${avgRate.toFixed(2)}</span>
            </>
          )}
          {totalRecBudget > 0 && (
            <>
              <span style={{ color: "#D1D5DB", margin: "0 4px" }}>|</span>
              <span>Rec. Budget:</span>
              <span style={{ fontWeight: 600, color: "#1A1A1A" }}>${totalRecBudget.toLocaleString()}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
