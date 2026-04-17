"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronRight } from "lucide-react";
import InterestChipEditor from "@/components/InterestChipEditor";
import type { InterestsByTier } from "@/components/InterestChipEditor";

// ── Types ─────────────────────────────────────────────────────────────

export interface AdSetData {
  name?: string;
  persona_key?: string;
  daily_budget?: number | null;
  targeting_tier?: string;
  targeting_type?: string;
  interests?: string[];
  interests_by_tier?: {
    hyper?: string[];
    hot?: string[];
    broad?: string[];
  };
  placements?: string[];
  split_test_variable?: string;
  objective?: string;
}

interface AdSetRowProps {
  adSet: AdSetData;
  channel: string;
  onUpdate: (field: string, value: unknown) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────

function formatObjective(obj: string): string {
  return obj.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function tierLabel(tier: string): string {
  if (tier === "hyper") return "Hyper";
  if (tier === "hot") return "Hot";
  return "Broad";
}

// ── Component ─────────────────────────────────────────────────────────

export default function AdSetRow({ adSet, channel, onUpdate }: AdSetRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetValue, setBudgetValue] = useState("");
  const budgetRef = useRef<HTMLInputElement>(null);

  const tier = (adSet.targeting_tier ?? adSet.targeting_type ?? "broad").toString();
  const personaLabel = adSet.persona_key
    ? adSet.persona_key.replace(/_/g, " ")
    : null;
  const dailyBudget = adSet.daily_budget ?? 0;

  // Build tiered interests
  const interestsByTier: InterestsByTier = adSet.interests_by_tier
    ? {
        hyper: adSet.interests_by_tier.hyper ?? [],
        hot: adSet.interests_by_tier.hot ?? [],
        broad: adSet.interests_by_tier.broad ?? [],
      }
    : {
        hyper: tier === "hyper" ? (adSet.interests ?? []) : [],
        hot: tier === "hot" ? (adSet.interests ?? []) : [],
        broad: tier === "broad" ? (adSet.interests ?? []) : [],
      };

  const totalInterests =
    interestsByTier.hyper.length +
    interestsByTier.hot.length +
    interestsByTier.broad.length;

  useEffect(() => {
    if (editingBudget && budgetRef.current) {
      budgetRef.current.focus();
      budgetRef.current.select();
    }
  }, [editingBudget]);

  function handleBudgetCommit() {
    const val = parseInt(budgetValue, 10);
    if (!isNaN(val) && val >= 0) {
      onUpdate("daily_budget", val);
    }
    setEditingBudget(false);
  }

  function handleBudgetKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleBudgetCommit();
    } else if (e.key === "Escape") {
      setEditingBudget(false);
    }
  }

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E8E8EA",
        borderRadius: 8,
        marginBottom: 4,
        overflow: "hidden",
      }}
    >
      {/* Collapsed row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "24px 1fr auto auto auto auto",
          alignItems: "center",
          gap: 10,
          padding: "0 12px",
          height: 48,
          cursor: "pointer",
        }}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Chevron */}
        <ChevronRight
          size={13}
          style={{
            color: "#8A8A8E",
            transition: "transform 0.15s",
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
            flexShrink: 0,
          }}
        />

        {/* Name */}
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "#1A1A1A",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {adSet.name ?? "Ad Set"}
        </span>

        {/* Persona chip — only show if we have a real value */}
        {personaLabel && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: 9999,
              background: "rgba(107,33,168,0.08)",
              color: "#6B21A8",
              whiteSpace: "nowrap",
              textTransform: "capitalize",
            }}
          >
            {personaLabel}
          </span>
        )}

        {/* Channel chip */}
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            padding: "2px 8px",
            borderRadius: 9999,
            background: "#F7F7F8",
            color: "#32373C",
            whiteSpace: "nowrap",
          }}
        >
          {channel}
        </span>

        {/* Daily budget — click to edit */}
        {editingBudget ? (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ display: "flex", alignItems: "center" }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: "#1A1A1A", marginRight: 2 }}>$</span>
            <input
              ref={budgetRef}
              type="number"
              min={0}
              value={budgetValue}
              onChange={(e) => setBudgetValue(e.target.value)}
              onKeyDown={handleBudgetKeyDown}
              onBlur={handleBudgetCommit}
              style={{
                width: 60,
                fontSize: 13,
                fontWeight: 700,
                fontFamily: "ui-monospace, monospace",
                padding: "2px 4px",
                borderRadius: 6,
                border: "1px solid #E8E8EA",
                outline: "none",
              }}
            />
            <span style={{ fontSize: 11, color: "#8A8A8E", marginLeft: 2 }}>/day</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setEditingBudget(true);
              setBudgetValue(String(dailyBudget));
            }}
            style={{
              fontSize: 13,
              fontWeight: 700,
              fontFamily: "ui-monospace, monospace",
              color: "#1A1A1A",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "2px 6px",
              borderRadius: 6,
              whiteSpace: "nowrap",
            }}
            title="Click to edit budget"
          >
            ${dailyBudget}/day
          </button>
        )}

        {/* Interest count */}
        <span style={{ fontSize: 11, color: "#8A8A8E", whiteSpace: "nowrap" }}>
          {totalInterests} interests
        </span>
      </div>

      {/* Expanded — Interest tiers grouped */}
      {expanded && (
        <div
          style={{
            borderTop: "1px solid #E8E8EA",
            padding: "12px 16px 16px 44px",
            background: "#FAFAFA",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Targeting tier + objective row */}
          <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "center" }}>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#8A8A8E" }}>
              Targeting: {tierLabel(tier)}
            </span>
            <span style={{ fontSize: 10, color: "#E8E8EA" }}>|</span>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#8A8A8E" }}>
              Objective: {formatObjective(adSet.objective ?? "lead_generation")}
            </span>
          </div>

          <InterestChipEditor
            interests={interestsByTier}
            onChange={(updated) => onUpdate("interests_by_tier", updated)}
          />
        </div>
      )}
    </div>
  );
}
