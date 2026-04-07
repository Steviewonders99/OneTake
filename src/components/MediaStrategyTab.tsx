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

function TierBadge({ tier }: { tier: string }) {
  const color =
    tier === "hyper" ? "bg-[rgba(107,33,168,0.1)] text-[#6B21A8]" :
    tier === "hot" ? "bg-[rgba(245,158,11,0.12)] text-[#f59e0b]" :
    "bg-[rgba(34,197,94,0.12)] text-[#22c55e]";
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${color}`}>
      {tier}
    </span>
  );
}

function AgeBar({ min, max, gender }: { min?: number; max?: number; gender?: string }) {
  const lo = min ?? 18;
  const hi = max ?? 65;
  const left = ((lo - 18) / (65 - 18)) * 100;
  const width = ((hi - lo) / (65 - 18)) * 100;
  const genderLabel = gender && gender !== "all" ? gender : "All genders";
  return (
    <div className="mt-2">
      <div className="relative h-1 bg-[var(--muted)] rounded-sm">
        <div
          className="absolute h-full rounded-sm"
          style={{ left: `${left}%`, width: `${width}%`, background: "linear-gradient(90deg, rgb(6,147,227), rgb(155,81,224))" }}
        />
      </div>
      <div className="flex justify-between text-[9px] text-[var(--muted-foreground)] mt-0.5"><span>18</span><span>65+</span></div>
      <div className="text-[11px] font-semibold mt-0.5 text-[var(--foreground)]">Age {lo}-{hi} · <span className="capitalize">{genderLabel}</span></div>
    </div>
  );
}

function InterestTags({ interests }: { interests: string[] }) {
  if (interests.length === 0) return null;
  return (
    <>
      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] mt-3 mb-1">Interests</div>
      <div className="flex flex-wrap gap-1">
        {interests.map((i) => (
          <span key={i} className="text-[11px] px-2 py-0.5 rounded-md bg-[rgba(6,147,227,0.08)] text-[rgb(6,147,227)] font-semibold">
            {i}
          </span>
        ))}
      </div>
    </>
  );
}

function GeoTags({ location }: { location?: string | string[] }) {
  const items: string[] = Array.isArray(location) ? location : location ? [location] : [];
  if (items.length === 0) return null;
  return (
    <>
      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] mt-3 mb-1">Geographics</div>
      <div className="flex flex-wrap gap-1">
        {items.map((g) => (
          <span key={g} className="text-[11px] px-2 py-0.5 rounded-md bg-[rgba(155,81,224,0.08)] text-[rgb(155,81,224)] font-semibold inline-flex items-center gap-1">
            <span>📍</span>{g}
          </span>
        ))}
      </div>
    </>
  );
}

function RulesRow({ killRule, scaleRule }: { killRule?: string; scaleRule?: string }) {
  if (!killRule && !scaleRule) return null;
  return (
    <div className="flex gap-3 mt-2.5 pt-2.5 border-t border-dashed border-[var(--border)] text-[10px]">
      {killRule ? (
        <div className="flex-1">
          <div className="font-bold uppercase text-[9px] tracking-wider text-[#ef4444]">Kill</div>
          <div className="text-[var(--muted-foreground)] leading-snug">{killRule}</div>
        </div>
      ) : null}
      {scaleRule ? (
        <div className="flex-1">
          <div className="font-bold uppercase text-[9px] tracking-wider text-[#22c55e]">Scale</div>
          <div className="text-[var(--muted-foreground)] leading-snug">{scaleRule}</div>
        </div>
      ) : null}
    </div>
  );
}

function CreativeThumb({ asset }: { asset: GeneratedAsset }) {
  const content = (asset.content ?? {}) as Record<string, unknown>;
  const headline = String(content.headline ?? content.hook ?? "").slice(0, 60);
  const hookType = String((content.hook_type ?? content.angle ?? "")).slice(0, 4);
  if (asset.blob_url) {
    return (
      <div className="relative rounded-md overflow-hidden aspect-square bg-[var(--muted)] border border-[var(--border)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset.blob_url} alt={headline || "creative"} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
        {hookType ? (
          <span className="absolute top-1 right-1 bg-white/95 text-[var(--foreground)] text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase">
            {hookType}
          </span>
        ) : null}
        {headline ? (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 text-white text-[9px] font-bold leading-tight">
            {headline}
          </div>
        ) : null}
      </div>
    );
  }
  return (
    <div className="relative rounded-md overflow-hidden aspect-square border border-[var(--border)] flex items-end p-1.5">
      <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgb(6,147,227), rgb(155,81,224))", opacity: 0.8 }} />
      {hookType ? (
        <span className="absolute top-1 right-1 bg-white/95 text-[var(--foreground)] text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase z-10">
          {hookType}
        </span>
      ) : null}
      <div className="relative z-10 text-white text-[9px] font-bold leading-tight" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}>
        {headline || "Creative"}
      </div>
    </div>
  );
}

function CreativeThumbStrip({
  creatives,
  hookTypes,
}: {
  creatives: GeneratedAsset[];
  hookTypes: string[];
}) {
  const visible = creatives.slice(0, 4);
  const overflow = Math.max(0, creatives.length - 4);
  return (
    <div className="mt-2.5 pt-2.5 border-t border-dashed border-[var(--border)]">
      <div className="flex justify-between items-center mb-2">
        <div className="text-[11px] font-bold">
          <span className="inline-block bg-[var(--foreground)] text-white px-2 py-0.5 rounded-full text-[11px] mr-1.5">{creatives.length}</span>
          creatives
        </div>
        {hookTypes.length > 0 ? (
          <span className="text-[10px] text-[var(--muted-foreground)]">Hook: {hookTypes.join(", ")}</span>
        ) : null}
      </div>
      {creatives.length === 0 ? (
        <div className="border border-dashed border-[var(--border)] rounded-md py-4 text-center text-[11px] text-[var(--muted-foreground)] italic">
          No creatives generated yet
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-1.5">
          {visible.map((a) => (
            <CreativeThumb key={a.id} asset={a} />
          ))}
          {overflow > 0 ? (
            <div className="aspect-square border border-dashed border-[var(--border)] rounded-md bg-white flex items-center justify-center text-[var(--muted-foreground)] text-[11px] font-bold">
              +{overflow}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

interface AdSetCardProps {
  adSet: AdSet & { _campaign: Campaign };
  channel: string;
  assets: GeneratedAsset[];
}

function AdSetCard({ adSet, channel, assets }: AdSetCardProps) {
  const tier = (adSet.targeting_tier ?? adSet.targeting_type ?? "broad").toString();
  const borderColor = tier === "hyper" ? "#6B21A8" : tier === "hot" ? "#f59e0b" : "#22c55e";
  const demo = adSet.demographics ?? {};
  const dailyBudget = adSet.daily_budget;
  const creatives = useMemo(() => matchCreatives(adSet, assets, channel), [adSet, assets, channel]);
  const hookTypes = adSet.creative_assignment_rule?.hook_types ?? [];
  const personaLabel = adSet.persona_key ? adSet.persona_key.replace(/_/g, " ") : "—";

  return (
    <div className="bg-white border border-[var(--border)] rounded-xl px-4 py-3.5" style={{ borderLeft: `3px solid ${borderColor}` }}>
      <div className="flex items-start justify-between mb-1">
        <div>
          <h4 className="text-[13px] font-bold text-[var(--foreground)] m-0">{adSet.name ?? "Ad Set"}</h4>
          <div className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
            {dailyBudget ? `$${Number(dailyBudget).toLocaleString()}/day` : "—"} · persona: <span className="capitalize">{personaLabel}</span>
          </div>
        </div>
        <TierBadge tier={tier} />
      </div>

      <AgeBar min={demo.age_min} max={demo.age_max} gender={demo.gender} />
      <InterestTags interests={adSet.interests ?? []} />
      <GeoTags location={demo.location} />

      <CreativeThumbStrip creatives={creatives} hookTypes={hookTypes} />

      <RulesRow killRule={adSet.kill_rule} scaleRule={adSet.scale_rule} />
    </div>
  );
}

interface ChannelBlockProps {
  block: ChannelBlockData;
  expanded: boolean;
  onToggle: () => void;
  assets: GeneratedAsset[];
  isRatio: boolean;
  totalMonthly: number | null;
}

function ChannelBlock({ block, expanded, onToggle, assets, isRatio, totalMonthly }: ChannelBlockProps) {
  const meta = getPlatformMeta(block.channel.toLowerCase() + "_feed");
  const channelMonthly = !isRatio && totalMonthly ? Math.round(totalMonthly * block.pct) : null;
  const channelDaily = channelMonthly ? Math.round(channelMonthly / 30) : null;
  const pctLabel = `${Math.round(block.pct * 100)}% of country spend`;
  const objectivesLabel = block.objectives.length > 0 ? block.objectives.join(" · ") : "—";
  const creativeCount = block.adSets.reduce((s, a) => s + matchCreatives(a, assets, block.channel).length, 0);

  return (
    <div className="bg-white border border-[var(--border)] rounded-xl mb-3 overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-[var(--muted)]/30 transition-colors text-left"
        style={{ borderLeft: `4px solid ${meta.color}` }}
      >
        <div className="flex items-center gap-3.5">
          <PlatformLogo brand={meta.brand} className="w-10 h-10" />
          <div>
            <h3 className="text-[16px] font-bold text-[var(--foreground)] m-0">{block.channel}</h3>
            <div className="flex items-center gap-2 text-[12px] text-[var(--muted-foreground)] mt-0.5">
              <span className="px-2 py-0.5 rounded-full bg-[var(--muted)] font-semibold capitalize">
                {objectivesLabel.replace(/_/g, " ")}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[var(--muted)] font-semibold">
                {block.adSets.length} ad set{block.adSets.length === 1 ? "" : "s"}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[var(--muted)] font-semibold">
                {creativeCount} creative{creativeCount === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </div>
        <div className="text-right">
          {isRatio ? (
            <div className="text-[12px] font-semibold text-[var(--muted-foreground)] uppercase">{Math.round(block.pct * 100)}%</div>
          ) : (
            <>
              <div className="text-[18px] font-extrabold text-[var(--foreground)]">
                ${Number(channelMonthly ?? 0).toLocaleString()}
                <span className="text-[11px] font-medium text-[var(--muted-foreground)]">/mo</span>
              </div>
              <div className="text-[11px] text-[var(--muted-foreground)]">
                {channelDaily ? `$${channelDaily}/day · ` : ""}{pctLabel}
              </div>
            </>
          )}
        </div>
      </button>
      {expanded ? (
        <div className="px-5 pt-3 pb-5 border-t border-[var(--border)] bg-[#FCFCFC]">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-2.5 mt-1">Ad Sets</div>
          {block.adSets.length === 0 ? (
            <div className="text-[12px] italic text-[var(--muted-foreground)] py-3">
              No ad sets assigned to this channel yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {block.adSets.map((as, i) => (
                <AdSetCard key={`${as.name ?? "adset"}-${i}`} adSet={as} channel={block.channel} assets={assets} />
              ))}
            </div>
          )}
        </div>
      ) : null}
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
