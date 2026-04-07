"use client";

import { useMemo } from "react";
import type { GeneratedAsset } from "@/lib/types";
import { getPlatformMeta, PlatformLogo, toChannel, TOP_N_CHANNELS } from "@/lib/platforms";

// ── Types ────────────────────────────────────────────────────────────

interface MediaStrategyTabProps {
  strategies: Strategy[];
  assets: GeneratedAsset[];
  briefData: Record<string, any>;
}

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
  targeting_type?: "hyper" | "hot" | "broad" | string;
  targeting_tier?: "hyper" | "hot" | "broad" | string;
  interests?: string[];
  demographics?: { age_min?: number; age_max?: number; gender?: string; location?: string | string[] };
  placements?: string[];
  daily_budget?: number | null;
  kill_rule?: string;
  scale_rule?: string;
  creative_assignment_rule?: {
    persona?: string;
    hook_types?: string[];
    treatment?: string;
  };
}

interface Persona {
  archetype_key?: string;
  persona_key?: string;
  best_channels?: string[];
  targeting_profile?: {
    budget_weight_pct?: number;
  };
}

interface ChannelMixEntry {
  channel: string;
  pct: number;
}

interface ChannelBlockData {
  channel: string;
  pct: number;
  monthly: number | null;
  adSets: (AdSet & { _campaign: Campaign })[];
  objectives: string[];
}

// ── Pure helpers ─────────────────────────────────────────────────────

/**
 * Compute the research-driven channel mix for a country.
 * For each persona, distribute its budget_weight_pct evenly across its best_channels,
 * then cap at TOP_N_CHANNELS and renormalize to sum exactly 1.0.
 * Returns [] if no personas have best_channels — caller handles fallback.
 */
export function computeChannelMix(personas: Persona[]): ChannelMixEntry[] {
  const mix: Record<string, number> = {};
  for (const p of personas) {
    const pct = p.targeting_profile?.budget_weight_pct ?? 0;
    const share = pct / 100;
    const channels = p.best_channels ?? [];
    if (channels.length === 0 || share === 0) continue;
    const perChannel = share / channels.length;
    for (const raw of channels) {
      const ch = toChannel(raw);
      if (!ch) continue;
      mix[ch] = (mix[ch] ?? 0) + perChannel;
    }
  }
  const sorted = Object.entries(mix).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, TOP_N_CHANNELS);
  const total = top.reduce((s, [, v]) => s + v, 0);
  if (total === 0) return [];
  return top.map(([channel, v]) => ({ channel, pct: v / total }));
}

/**
 * Group ad sets under the channels they're placed on, limited to the provided set of channels.
 * An ad set with placements [facebook_feed, instagram_feed] appears under both Facebook and Instagram.
 * Each grouped ad set carries a reference to its parent campaign so the per-channel objective is available.
 */
export function groupAdSetsByChannel(
  campaigns: Campaign[],
  topChannels: Set<string>,
): Map<string, (AdSet & { _campaign: Campaign })[]> {
  const result = new Map<string, (AdSet & { _campaign: Campaign })[]>();
  for (const camp of campaigns) {
    const adSets = camp.ad_sets ?? [];
    for (const adSet of adSets) {
      const placements = adSet.placements ?? [];
      const seen = new Set<string>();
      for (const plat of placements) {
        const ch = toChannel(plat);
        if (!ch || !topChannels.has(ch) || seen.has(ch)) continue;
        seen.add(ch);
        if (!result.has(ch)) result.set(ch, []);
        result.get(ch)!.push({ ...adSet, _campaign: camp });
      }
    }
  }
  return result;
}

/**
 * Match composed creatives to an ad set within a specific channel.
 * Filters by persona_key and normalized channel, sorts by evaluation_score (VQA) desc.
 */
export function matchCreatives(
  adSet: AdSet,
  assets: GeneratedAsset[],
  channel: string,
): GeneratedAsset[] {
  return assets
    .filter((a) => {
      if (a.asset_type !== "composed_creative") return false;
      const content = (a.content ?? {}) as Record<string, unknown>;
      const personaKey = content.persona_key ?? a.actor_id ?? null;
      if (personaKey !== adSet.persona_key) return false;
      const platRaw = String(content.platform ?? a.platform ?? "");
      const ch = toChannel(platRaw);
      return ch === channel;
    })
    .sort((a, b) => (b.evaluation_score ?? 0) - (a.evaluation_score ?? 0));
}

// ── Sub-components ───────────────────────────────────────────────────

interface CountryTabsProps {
  strategies: Strategy[];
  activeCountry: string;
  onChange: (country: string) => void;
}

function CountryTabs({ strategies, activeCountry, onChange }: CountryTabsProps) {
  return (
    <div className="flex gap-1.5 border-b border-[var(--border)] mb-4 overflow-x-auto">
      {strategies.map((s) => {
        const isActive = s.country === activeCountry;
        const budgetLabel = s.monthly_budget ? `$${Number(s.monthly_budget).toLocaleString()}/mo` : "ratio";
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onChange(s.country)}
            className={`px-4 py-2.5 text-[13px] font-semibold whitespace-nowrap cursor-pointer border-b-2 transition-colors ${
              isActive
                ? "text-[var(--foreground)] border-[rgb(6,147,227)]"
                : "text-[var(--muted-foreground)] border-transparent hover:text-[var(--foreground)]"
            }`}
          >
            {s.country}
            <span className="ml-2 text-[11px] font-normal text-[var(--muted-foreground)]">· {budgetLabel}</span>
          </button>
        );
      })}
    </div>
  );
}

interface CountryHeaderProps {
  strategy: Strategy;
  personaCount: number;
  adSetCount: number;
}

function CountryHeader({ strategy, personaCount, adSetCount }: CountryHeaderProps) {
  const sd = strategy.strategy_data ?? {};
  const isRatio = strategy.budget_mode === "ratio";
  const dailyTotal = sd.daily_budget_total ?? (strategy.monthly_budget ? Math.round(strategy.monthly_budget / 30) : null);
  const splitTest = sd.split_test?.variable;
  return (
    <div className="border border-[var(--border)] rounded-xl bg-white px-6 py-5 mb-4 flex items-center justify-between shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
      <div>
        <h2 className="text-[22px] font-bold text-[var(--foreground)] mb-1">{strategy.country}</h2>
        <div className="flex items-center gap-3 text-[12px] text-[var(--muted-foreground)]">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[rgba(6,147,227,0.1)] text-[rgb(6,147,227)] font-bold text-[11px] uppercase tracking-wider">
            Tier {strategy.tier} · {sd.tier === 1 ? "Interest-only cold" : "Retargeting"}
          </span>
          {splitTest ? <><span className="text-[#ddd]">·</span><span>Split test: <span className="font-semibold text-[var(--foreground)] capitalize">{splitTest}</span></span></> : null}
          <span className="text-[#ddd]">·</span>
          <span>{personaCount} personas · {adSetCount} ad sets</span>
        </div>
      </div>
      <div className="text-right">
        {isRatio ? (
          <div className="text-[14px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Ratio mode</div>
        ) : (
          <>
            <div className="text-[28px] font-extrabold tracking-tight text-[var(--foreground)]">
              ${Number(strategy.monthly_budget ?? 0).toLocaleString()}
              <span className="text-[13px] font-medium text-[var(--muted-foreground)] ml-1">/mo</span>
            </div>
            <div className="text-[11px] text-[var(--muted-foreground)]">
              {dailyTotal ? `$${Number(dailyTotal).toLocaleString()}/day` : ""} · {strategy.budget_mode} mode
            </div>
          </>
        )}
      </div>
    </div>
  );
}

interface ChannelMixBarProps {
  mix: ChannelMixEntry[];
  totalMonthly: number | null;
  isRatio: boolean;
}

function ChannelMixBar({ mix, totalMonthly, isRatio }: ChannelMixBarProps) {
  if (mix.length === 0) {
    return (
      <div className="border border-[var(--border)] rounded-xl bg-white px-6 py-5 mb-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-2">Channel Mix</div>
        <p className="text-[13px] text-[var(--muted-foreground)] italic">
          No channel mix available — personas don&apos;t have best_channels data.
        </p>
      </div>
    );
  }
  return (
    <div className="border border-[var(--border)] rounded-xl bg-white px-6 py-5 mb-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
      <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-3">Channel Mix</div>
      {/* Stacked bar */}
      <div className="flex h-8 rounded-lg overflow-hidden mb-3.5 ring-1 ring-black/5">
        {mix.map((m) => {
          const meta = getPlatformMeta(m.channel.toLowerCase() + "_feed");
          return (
            <div
              key={m.channel}
              className="flex items-center justify-center text-white text-[11px] font-bold"
              style={{ flex: m.pct, background: meta.color }}
              title={`${m.channel} ${Math.round(m.pct * 100)}%`}
            >
              {Math.round(m.pct * 100)}%
            </div>
          );
        })}
      </div>
      {/* 4-up legend */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {mix.map((m) => {
          const meta = getPlatformMeta(m.channel.toLowerCase() + "_feed");
          const channelMonthly = !isRatio && totalMonthly ? Math.round(totalMonthly * m.pct) : null;
          return (
            <div key={m.channel} className="flex items-center gap-2.5 px-3 py-2 border border-[var(--border)] rounded-lg">
              <PlatformLogo brand={meta.brand} className="w-8 h-8 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-[12px] font-bold text-[var(--foreground)] truncate">{m.channel}</div>
                <div className="text-[11px] text-[var(--muted-foreground)]">
                  {channelMonthly !== null ? `$${channelMonthly.toLocaleString()}/mo · ` : ""}{Math.round(m.pct * 100)}%
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Component (stub — filled in later tasks) ────────────────────────

export default function MediaStrategyTab({ strategies, assets, briefData }: MediaStrategyTabProps) {
  void assets;
  void briefData;
  if (!strategies || strategies.length === 0) {
    return (
      <p className="text-[13px] text-[var(--muted-foreground)] italic">
        Media strategy hasn&apos;t been generated yet.
      </p>
    );
  }
  return <div className="space-y-4">{/* Sub-components added in later tasks */}</div>;
}
