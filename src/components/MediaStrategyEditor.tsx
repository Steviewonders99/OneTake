"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { useStrategyAutosave } from "@/hooks/useStrategyAutosave";
import type { StrategyAutosaveStatus } from "@/hooks/useStrategyAutosave";
import ChannelMixEditor from "@/components/ChannelMixEditor";
import AdSetRow from "@/components/AdSetRow";
import { toChannel } from "@/lib/platforms";

// ── Types ─────────────────────────────────────────────────────────────

interface Strategy {
  id: string;
  country: string;
  tier: number;
  budget_mode: string;
  monthly_budget: number | null;
  strategy_data: StrategyData;
}

interface StrategyData {
  tier?: number;
  monthly_budget?: number | null;
  budget_mode?: string;
  daily_budget_total?: number | null;
  split_test?: { variable?: string; description?: string; measurement?: string };
  campaigns?: Campaign[];
  scaling_rules?: Record<string, string> | string | null;
  channel_allocation?: Record<string, number>;
}

interface Campaign {
  name?: string;
  objective?: string;
  optimization?: string;
  daily_budget?: number | null;
  ad_sets?: AdSet[];
}

interface AdSet {
  name?: string;
  persona_key?: string;
  targeting_type?: string;
  targeting_tier?: string;
  interests?: string[];
  interests_by_tier?: {
    hyper?: string[];
    hot?: string[];
    broad?: string[];
  };
  placements?: string[];
  daily_budget?: number | null;
  split_test_variable?: string;
  objective?: string;
  kill_rule?: string;
  scale_rule?: string;
  demographics?: Record<string, unknown>;
  creative_assignment_rule?: Record<string, unknown>;
}

interface MediaStrategyEditorProps {
  strategies: Strategy[];
  requestId: string;
}

// ── Helpers ───────────────────────────────────────────────────────────

interface FlatAdSet {
  campaignIndex: number;
  adSetIndex: number;
  adSet: AdSet;
  channel: string;
}

function flattenAdSets(campaigns: Campaign[]): FlatAdSet[] {
  const result: FlatAdSet[] = [];
  for (let ci = 0; ci < campaigns.length; ci++) {
    const adSets = campaigns[ci].ad_sets ?? [];
    for (let ai = 0; ai < adSets.length; ai++) {
      const adSet = adSets[ai];
      const placements = adSet.placements ?? [];
      const firstPlacement = placements[0] ?? "";
      const channel = toChannel(firstPlacement) ?? "Other";
      result.push({ campaignIndex: ci, adSetIndex: ai, adSet, channel });
    }
  }
  // Sort by channel grouping, then daily budget descending
  result.sort((a, b) => {
    const chCmp = a.channel.localeCompare(b.channel);
    if (chCmp !== 0) return chCmp;
    return (b.adSet.daily_budget ?? 0) - (a.adSet.daily_budget ?? 0);
  });
  return result;
}

function buildAllocation(strategyData: StrategyData): Record<string, number> {
  if (strategyData.channel_allocation && Object.keys(strategyData.channel_allocation).length > 0) {
    return { ...strategyData.channel_allocation };
  }
  // Fallback: derive from ad set placements — count ALL placements, not just [0]
  const byChannel: Record<string, number> = {};
  for (const camp of strategyData.campaigns ?? []) {
    for (const adSet of camp.ad_sets ?? []) {
      const placements = adSet.placements ?? [];
      // Collect unique channels from all placements in this ad set
      const channels = new Set<string>();
      for (const p of placements) {
        const ch = toChannel(p);
        if (ch) channels.add(ch);
      }
      // If no placements mapped, use "Other"
      if (channels.size === 0) channels.add("Other");
      // Split budget evenly across channels in this ad set
      const budgetPerChannel = (adSet.daily_budget ?? 0) / channels.size;
      for (const ch of channels) {
        byChannel[ch] = (byChannel[ch] ?? 0) + budgetPerChannel;
      }
    }
  }
  const total = Object.values(byChannel).reduce((s, v) => s + v, 0);
  if (total === 0) return byChannel;
  for (const ch of Object.keys(byChannel)) {
    byChannel[ch] = byChannel[ch] / total;
  }
  return byChannel;
}

// ── Save Status ───────────────────────────────────────────────────────

function SaveStatusDot({ status }: { status: StrategyAutosaveStatus }) {
  if (status === "idle") return null;
  const config: Record<string, { color: string; label: string }> = {
    saving: { color: "#d97706", label: "Saving..." },
    saved: { color: "#16a34a", label: "Saved" },
    error: { color: "#dc2626", label: "Error \u2014 click to retry" },
  };
  const c = config[status];
  if (!c) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: c.color }} />
      <span style={{ fontSize: 11, fontWeight: 500, color: c.color }}>{c.label}</span>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────

export default function MediaStrategyEditor({
  strategies,
  requestId,
}: MediaStrategyEditorProps) {
  const sortedStrategies = useMemo(
    () => [...(strategies ?? [])].sort((a, b) => (b.monthly_budget ?? 0) - (a.monthly_budget ?? 0)),
    [strategies],
  );

  const [activeCountry, setActiveCountry] = useState(sortedStrategies[0]?.country ?? "");

  const activeStrategy = useMemo(
    () => sortedStrategies.find((s) => s.country === activeCountry) ?? sortedStrategies[0],
    [sortedStrategies, activeCountry],
  );

  // Deep clone strategy_data into mutable local state
  const [strategyData, setStrategyData] = useState<StrategyData>(() =>
    JSON.parse(JSON.stringify(activeStrategy?.strategy_data ?? {})),
  );

  // Reset local state when active country changes
  useEffect(() => {
    if (activeStrategy) {
      setStrategyData(JSON.parse(JSON.stringify(activeStrategy.strategy_data ?? {})));
    }
  }, [activeStrategy]);

  // Autosave
  const { save, status } = useStrategyAutosave(
    requestId,
    activeStrategy?.id ?? "",
  );

  // Update helper — deep clones, applies mutation, triggers autosave
  const updateStrategyData = useCallback(
    (updater: (draft: StrategyData) => void) => {
      setStrategyData((prev) => {
        const next = JSON.parse(JSON.stringify(prev)) as StrategyData;
        updater(next);
        save(next as unknown as Record<string, unknown>);
        return next;
      });
    },
    [save],
  );

  function handleAllocationChange(updated: Record<string, number>) {
    updateStrategyData((draft) => {
      draft.channel_allocation = updated;
    });
  }

  function handleAdSetUpdate(
    campaignIndex: number,
    adSetIndex: number,
    field: string,
    value: unknown,
  ) {
    updateStrategyData((draft) => {
      const campaigns = draft.campaigns ?? [];
      if (!campaigns[campaignIndex]) return;
      const adSets = campaigns[campaignIndex].ad_sets ?? [];
      if (!adSets[adSetIndex]) return;
      (adSets[adSetIndex] as Record<string, unknown>)[field] = value;
    });
  }

  // ── Render ─────────────────────────────────────────────────────────

  if (!sortedStrategies || sortedStrategies.length === 0) {
    return (
      <p style={{ fontSize: 13, color: "#8A8A8E", fontStyle: "italic" }}>
        Media strategy hasn&apos;t been generated yet.
      </p>
    );
  }

  const allocation = buildAllocation(strategyData);
  const flatAdSets = flattenAdSets(strategyData.campaigns ?? []);
  const monthlyBudget = activeStrategy?.monthly_budget ?? strategyData.monthly_budget ?? null;

  return (
    <div>
      {/* Country tabs + save status */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid #E8E8EA",
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", gap: 2, overflow: "auto" }}>
          {sortedStrategies.map((s) => {
            const isActive = s.country === activeCountry;
            const budgetLabel = s.monthly_budget
              ? `$${Number(s.monthly_budget).toLocaleString()}/mo`
              : "ratio";
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveCountry(s.country)}
                style={{
                  padding: "10px 16px",
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? "#1A1A1A" : "#8A8A8E",
                  background: "none",
                  border: "none",
                  borderBottom: isActive ? "2px solid #32373C" : "2px solid transparent",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  fontFamily: "inherit",
                  transition: "all 0.15s",
                }}
              >
                {s.country}
                <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 400, color: "#8A8A8E" }}>
                  &middot; {budgetLabel}
                </span>
              </button>
            );
          })}
        </div>
        <SaveStatusDot status={status} />
      </div>

      {/* Channel mix editor */}
      <ChannelMixEditor
        allocation={allocation}
        monthlyBudget={monthlyBudget}
        onChange={handleAllocationChange}
      />

      {/* Ad sets grouped by channel, max 4 per channel */}
      {flatAdSets.length === 0 ? (
        <p style={{ fontSize: 13, color: "#8A8A8E", fontStyle: "italic", marginTop: 8 }}>
          No ad sets in this strategy.
        </p>
      ) : (
        (() => {
          // Group ad sets by channel
          const byChannel = new Map<string, typeof flatAdSets>();
          for (const flat of flatAdSets) {
            if (!byChannel.has(flat.channel)) byChannel.set(flat.channel, []);
            byChannel.get(flat.channel)!.push(flat);
          }

          return Array.from(byChannel.entries()).map(([channel, sets]) => {
            // Cap at 4 per channel
            const capped = sets.slice(0, 4);
            const overflow = sets.length - 4;

            return (
              <div key={channel} style={{ marginTop: 12 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "#8A8A8E",
                    marginBottom: 6,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {channel}
                  <span style={{ fontSize: 10, fontWeight: 400, color: "#B0B0B3" }}>
                    {capped.length} ad set{capped.length !== 1 ? "s" : ""}
                    {overflow > 0 && ` (+${overflow} more)`}
                  </span>
                </div>
                {capped.map((flat, i) => (
                  <AdSetRow
                    key={`${flat.campaignIndex}-${flat.adSetIndex}-${i}`}
                    adSet={flat.adSet}
                    channel={flat.channel}
                    onUpdate={(field, value) =>
                      handleAdSetUpdate(flat.campaignIndex, flat.adSetIndex, field, value)
                    }
                  />
                ))}
              </div>
            );
          });
        })()
      )}
    </div>
  );
}
