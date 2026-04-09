"use client";

import { useState } from "react";
import {
  Target,
  MessageSquare,
  Users,
  Globe,
  Shield,
  Palette,
  Megaphone,
  Heart,
  AlertTriangle,
  Sparkles,
  Languages,
} from "lucide-react";
import EditableField from "@/components/EditableField";
import MiniTabs from "@/components/MiniTabs";
import { toReadable } from "@/lib/format";

interface CampaignStrategy {
  id: string;
  country: string;
  tier: number;
  monthly_budget: number;
  budget_mode: string;
  strategy_data: Record<string, any>;
}

interface BriefExecutiveProps {
  briefData: Record<string, any>;
  channelResearch?: Record<string, any> | null;
  designDirection?: Record<string, any> | null;
  campaignStrategies?: CampaignStrategy[];
  editable?: boolean;
  onFieldSave?: (path: string, value: string) => void;
}

function SectionHeader({
  icon: Icon,
  title,
  color = "#6B21A8",
}: {
  icon: React.ComponentType<Record<string, any>>;
  title: string;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div
        className="w-6 h-6 rounded-md flex items-center justify-center"
        style={{ backgroundColor: `${color}10`, color }}
      >
        <Icon size={13} />
      </div>
      <h3 className="text-[12px] font-bold uppercase tracking-[0.06em] text-[var(--foreground)]">
        {title}
      </h3>
    </div>
  );
}

function Divider() {
  return <div className="border-t border-[var(--border)] my-6" />;
}

function Tag({ children, color = "#6B21A8" }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      className="inline-flex px-2.5 py-1 rounded-lg text-[11px] font-medium leading-none"
      style={{ backgroundColor: `${color}08`, color, border: `1px solid ${color}15` }}
    >
      {children}
    </span>
  );
}

function normalizeToString(val: unknown): string {
  if (typeof val === "string") return val;
  if (val && typeof val === "object") {
    const obj = val as Record<string, unknown>;
    return (obj.text || obj.value || obj.proposition || obj.description || obj.message || JSON.stringify(val)) as string;
  }
  return String(val ?? "");
}

function cleanChannelName(name: string): string {
  return name.replace(/\s*\(.*$/, "").trim();
}

function BulletList({
  items,
  color = "#6B21A8",
  editable = false,
  onItemSave,
}: {
  items: unknown[];
  color?: string;
  editable?: boolean;
  onItemSave?: (index: number, value: string) => void;
}) {
  return (
    <ul className="space-y-1">
      {items.map((raw, i) => {
        const item = normalizeToString(raw);
        return (
          <li key={i} className="flex items-start gap-2.5">
            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-[7px]" style={{ backgroundColor: color }} />
            {editable ? (
              <EditableField
                value={item}
                editable
                onSave={(v) => onItemSave?.(i, v)}
                textClassName="text-[13px] leading-relaxed text-[var(--foreground)]"
              />
            ) : (
              <span className="text-[13px] text-[var(--foreground)] leading-relaxed">{item}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function PersonaHookCard({
  personaKey,
  hook,
  motivations,
  painPoints,
  psychologyHook,
  editable = false,
  onSave,
}: {
  personaKey: string;
  hook?: string;
  motivations?: string[];
  painPoints?: string[];
  psychologyHook?: string;
  editable?: boolean;
  onSave?: (field: string, value: string) => void;
}) {
  const colors: Record<string, string> = {
    0: "#6B21A8",
    1: "#0693E3",
    2: "#E91E8C",
    3: "#22c55e",
  };
  const color = colors[String(Object.keys(colors).length % 4)] || "#6B21A8";

  return (
    <div className="border border-[var(--border)] rounded-xl p-4 space-y-2" style={{ borderTopColor: color, borderTopWidth: "2px" }}>
      <h4 className="text-[12px] font-bold text-[var(--foreground)] capitalize">
        {personaKey.replace(/_/g, " ")}
      </h4>
      {hook && (
        editable ? (
          <EditableField
            value={hook}
            editable
            onSave={(v) => onSave?.(`${personaKey}_hook`, v)}
            textClassName="text-[13px] text-[var(--foreground)] font-medium leading-relaxed italic"
          />
        ) : (
          <p className="text-[13px] text-[var(--foreground)] font-medium leading-relaxed">
            &ldquo;{hook}&rdquo;
          </p>
        )
      )}
      {motivations && motivations.length > 0 && (
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Motivations</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {motivations.map((m, i) => (
              <span key={i} className="text-[11px] px-2 py-0.5 bg-[var(--muted)] rounded-md text-[var(--foreground)]">{m}</span>
            ))}
          </div>
        </div>
      )}
      {painPoints && painPoints.length > 0 && (
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Pain Points</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {painPoints.map((p, i) => (
              <span key={i} className="text-[11px] px-2 py-0.5 bg-red-50 text-red-700 rounded-md">{p}</span>
            ))}
          </div>
        </div>
      )}
      {psychologyHook && (
        <p className="text-[11px] text-[var(--muted-foreground)] italic">Psychology: {psychologyHook}</p>
      )}
    </div>
  );
}

function PersonaTable({ personas, targetAudience }: { personas: any[]; targetAudience: Record<string, any> }) {
  if (!personas || personas.length === 0) return null;

  const motivations = targetAudience.motivations_by_persona || {};
  const painPoints = targetAudience.pain_points_by_persona || {};
  const psychology = targetAudience.psychology_hooks_by_persona || {};

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b-2 border-[var(--border)]">
            <th className="text-left py-2 pr-4 text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Persona</th>
            <th className="text-left py-2 pr-4 text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Age</th>
            <th className="text-left py-2 pr-4 text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Region</th>
            <th className="text-left py-2 pr-4 text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Motivations</th>
            <th className="text-left py-2 pr-4 text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Pain Points</th>
            <th className="text-left py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Psychology Hook</th>
          </tr>
        </thead>
        <tbody>
          {personas.map((p: any, i: number) => {
            const key = p.archetype_key || `persona_${i + 1}`;
            const colors = ["#6B21A8", "#0693E3", "#E91E8C", "#22c55e"];
            const color = colors[i % colors.length];
            const tp = p.targeting_profile?.demographics || {};

            return (
              <tr key={key} className="border-b border-[var(--border)] last:border-0">
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <div>
                      <span className="font-semibold text-[var(--foreground)] block">{p.persona_name || p.name || key.replace(/_/g, " ")}</span>
                      <span className="text-[10px] text-[var(--muted-foreground)]">{p.archetype || tp.occupation || ""}</span>
                    </div>
                  </div>
                </td>
                <td className="py-3 pr-4 text-[var(--foreground)] whitespace-nowrap">
                  {p.age_range || (tp.age_min && tp.age_max ? `${tp.age_min}-${tp.age_max}` : p.age || "—")}
                </td>
                <td className="py-3 pr-4 text-[var(--foreground)]">
                  {p.region || "—"}
                </td>
                <td className="py-3 pr-4">
                  <div className="flex flex-wrap gap-1">
                    {((motivations[key] || p.motivations || []) as string[]).slice(0, 2).map((m: string, j: number) => (
                      <span key={j} className="px-1.5 py-0.5 bg-[#22c55e08] text-[#22c55e] rounded text-[10px] border border-[#22c55e15]">{m}</span>
                    ))}
                  </div>
                </td>
                <td className="py-3 pr-4">
                  <div className="flex flex-wrap gap-1">
                    {((painPoints[key] || p.pain_points || []) as string[]).slice(0, 2).map((pp: string, j: number) => (
                      <span key={j} className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded text-[10px] border border-red-100">{pp}</span>
                    ))}
                  </div>
                </td>
                <td className="py-3">
                  <span className="text-[11px] text-[var(--muted-foreground)] italic">
                    {(psychology[key] || p.psychology_profile?.primary_bias || "—") as string}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function resolvePersonaKey(persona: any, index: number, perPersona: Record<string, any>): string {
  const candidates = [
    persona.archetype_key,
    persona.persona_name,
    persona.name,
    persona.persona_name?.toLowerCase().replace(/\s+/g, "_"),
    persona.name?.toLowerCase().replace(/\s+/g, "_"),
    `persona_${index + 1}`,
  ].filter(Boolean);
  return candidates.find((k) => k && perPersona[k]) || candidates[0] || `persona_${index + 1}`;
}

function ChannelMatrix({ channels, personas }: { channels: Record<string, any>; personas: any[] }) {
  const [showAll, setShowAll] = useState(false);
  const perPersona = channels.per_persona || {};
  const rawChannels = new Set<string>();

  // Collect all unique channels (raw names)
  (channels.primary || []).forEach((c: string) => rawChannels.add(c));
  (channels.secondary || []).forEach((c: string) => rawChannels.add(c));
  Object.values(perPersona).forEach((chs: any) => {
    if (Array.isArray(chs)) chs.forEach((c: string) => rawChannels.add(c));
  });

  if (rawChannels.size === 0) return null;

  const channelList = Array.from(rawChannels);
  const primaryCleaned = new Set((channels.primary || []).map((c: string) => cleanChannelName(c)));
  const secondaryCleaned = new Set((channels.secondary || []).map((c: string) => cleanChannelName(c)));

  // Split into prioritized (primary/secondary) and unassigned
  const prioritized = channelList.filter((ch) => {
    const cleaned = cleanChannelName(ch);
    return primaryCleaned.has(cleaned) || secondaryCleaned.has(cleaned);
  });
  const unassigned = channelList.filter((ch) => {
    const cleaned = cleanChannelName(ch);
    return !primaryCleaned.has(cleaned) && !secondaryCleaned.has(cleaned);
  });

  const visibleChannels = showAll ? channelList : prioritized;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b-2 border-[var(--border)]">
            <th className="text-left py-2 pr-4 text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Channel</th>
            <th className="text-left py-2 pr-4 text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Priority</th>
            {personas.map((p: any, i: number) => (
              <th key={i} className="text-center py-2 px-2 text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                {p.persona_name || p.name || `P${i + 1}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleChannels.map((ch) => {
            const cleaned = cleanChannelName(ch);
            const isPrimary = primaryCleaned.has(cleaned);
            const isSecondary = secondaryCleaned.has(cleaned);

            return (
              <tr
                key={ch}
                className={[
                  "border-b border-[var(--border)] last:border-0",
                  isPrimary ? "bg-[#0693E3]/[0.03]" : "",
                ].join(" ")}
              >
                <td className="py-2.5 pr-4 font-medium text-[var(--foreground)]">{cleaned}</td>
                <td className="py-2.5 pr-4">
                  {isPrimary ? (
                    <span className="px-2 py-0.5 bg-[#0693E308] text-[#0693E3] rounded-md text-[10px] font-semibold border border-[#0693E315]">Primary</span>
                  ) : isSecondary ? (
                    <span className="px-2 py-0.5 bg-gray-50 text-gray-500 rounded-md text-[10px] font-semibold border border-gray-200">Secondary</span>
                  ) : (
                    <span className="text-[var(--muted-foreground)] text-[10px]">&mdash;</span>
                  )}
                </td>
                {personas.map((p: any, i: number) => {
                  const key = resolvePersonaKey(p, i, perPersona);
                  const personaChannels: string[] = Array.isArray(perPersona[key]) ? perPersona[key] : [];
                  const cleanedPersonaChannels = personaChannels.map(cleanChannelName);
                  const isActive = cleanedPersonaChannels.includes(cleaned);

                  return (
                    <td key={i} className="py-2.5 px-2 text-center">
                      {isActive ? (
                        <div className="w-5 h-5 rounded-full bg-[#0693E310] flex items-center justify-center mx-auto">
                          <div className="w-2 h-2 rounded-full bg-[#0693E3]" />
                        </div>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {unassigned.length > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="text-[11px] text-[#737373] hover:text-[#1a1a1a] mt-2 cursor-pointer transition-colors"
        >
          {showAll ? "Hide" : `Show ${unassigned.length} more`} unassigned channels
        </button>
      )}
    </div>
  );
}

const PLATFORM_TARGETING: Record<string, { label: string; hyper: string; hot: string; broad: string }> = {
  Instagram: { label: "Meta (IG)", hyper: "Interest targeting", hot: "Stacked interests", broad: "Broad demographics" },
  Facebook: { label: "Meta (FB)", hyper: "Interest targeting", hot: "Stacked interests", broad: "Broad demographics" },
  TikTok: { label: "TikTok", hyper: "Interest targeting", hot: "Behavior + interest", broad: "Broad age/geo" },
  LinkedIn: { label: "LinkedIn", hyper: "Job title + skill", hot: "Industry + seniority", broad: "Company size" },
  Telegram: { label: "Telegram", hyper: "Channel targeting", hot: "Group interests", broad: "Broad geo" },
  YouTube: { label: "YouTube", hyper: "In-market + affinity", hot: "Custom intent", broad: "Demographics" },
  Twitter: { label: "X (Twitter)", hyper: "Keyword + follower LLA", hot: "Conversation topics", broad: "Interest categories" },
  X: { label: "X (Twitter)", hyper: "Keyword + follower LLA", hot: "Conversation topics", broad: "Interest categories" },
  Snapchat: { label: "Snapchat", hyper: "Lifestyle Categories", hot: "Stacked interests", broad: "Demographics + geo" },
  WhatsApp: { label: "WhatsApp", hyper: "Via Meta Ads", hot: "Via Meta Ads", broad: "Via Meta Ads" },
  WeChat: { label: "WeChat", hyper: "Interest + behavior", hot: "Stacked tags", broad: "Demographics" },
  Pinterest: { label: "Pinterest", hyper: "Interest + keyword", hot: "Actalike targeting", broad: "Broad interests" },
};

function TargetingTable({ personas, channels }: { personas: any[]; channels: Record<string, any> }) {
  const allChannels = [...new Set([...(channels.primary || []), ...(channels.secondary || [])])];
  if (allChannels.length === 0 || personas.length === 0) return null;

  return (
    <div className="space-y-4">
      {personas.map((p: any, pi: number) => {
        const tp = p.targeting_profile || {};
        const interests = tp.interests || {};
        const demo = tp.demographics || {};
        const behaviors: string[] = tp.behaviors || [];
        const psycho = tp.psychographics || {};
        const colors = ["#6B21A8", "#0693E3", "#E91E8C", "#22c55e"];
        const color = colors[pi % colors.length];
        const personaChannels = (channels.per_persona?.[p.archetype_key] || allChannels) as string[];

        const hyperAll: string[] = interests.hyper || [];
        const hotAll: string[] = interests.hot || [];
        const broadAll: string[] = interests.broad || [];

        return (
          <div key={pi} className="border border-[var(--border)] rounded-xl overflow-hidden">
            {/* Persona header */}
            <div className="px-4 py-2.5 bg-[var(--muted)] flex items-center justify-between" style={{ borderLeft: `3px solid ${color}` }}>
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-[var(--foreground)]">
                  {p.persona_name || p.name || p.archetype_key?.replace(/_/g, " ")}
                </span>
                <span className="text-[11px] text-[var(--muted-foreground)]">
                  {demo.age_min && demo.age_max ? `${demo.age_min}-${demo.age_max}` : p.age_range || ""}
                  {demo.occupation ? ` · ${demo.occupation}` : ""}
                </span>
              </div>
              <div className="flex gap-1">
                {hyperAll.slice(0, 3).map((h: string, i: number) => (
                  <span key={i} className="px-1.5 py-0.5 rounded text-[9px] font-medium" style={{ backgroundColor: `${color}08`, color, border: `1px solid ${color}15` }}>
                    {h}
                  </span>
                ))}
              </div>
            </div>

            {/* Platform targeting — 3 ad set tiers per platform */}
            <div className="divide-y divide-[var(--border)]">
              {personaChannels.map((ch: string, ci: number) => {
                const cleaned = cleanChannelName(ch);
                const platform = PLATFORM_TARGETING[cleaned] || { label: cleaned, hyper: "Interest targeting", hot: "Stacked interests", broad: "Broad" };

                // Rotate different interests across platforms so each shows unique values
                const hyperSlice = hyperAll.length > 0
                  ? [hyperAll[ci % hyperAll.length], hyperAll[(ci + 1) % hyperAll.length]].filter((v, idx, arr) => arr.indexOf(v) === idx)
                  : [];
                const hotSlice = hotAll.length > 0
                  ? [hotAll[ci % hotAll.length]]
                  : [];
                const broadSlice = broadAll.length > 0
                  ? [broadAll[ci % broadAll.length]]
                  : behaviors.slice(0, 1);

                return (
                  <div key={ch} className="px-4 py-2.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[12px] font-semibold text-[var(--foreground)]">{platform.label}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {/* Hyper tier */}
                      <div>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[#6B21A8] block mb-1">Hyper</span>
                        <span className="text-[10px] text-[var(--muted-foreground)] block mb-1">{platform.hyper}</span>
                        <div className="flex flex-wrap gap-0.5">
                          {hyperSlice.map((h: string, i: number) => (
                            <span key={i} className="px-1 py-0.5 bg-[#6B21A808] text-[#6B21A8] rounded text-[9px] border border-[#6B21A815]">{h}</span>
                          ))}
                        </div>
                      </div>
                      {/* Hot tier */}
                      <div>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[#f59e0b] block mb-1">Hot</span>
                        <span className="text-[10px] text-[var(--muted-foreground)] block mb-1">{platform.hot}</span>
                        <div className="flex flex-wrap gap-0.5">
                          {hotSlice.map((h: string, i: number) => (
                            <span key={i} className="px-1 py-0.5 bg-[#f59e0b08] text-[#f59e0b] rounded text-[9px] border border-[#f59e0b15]">{h}</span>
                          ))}
                        </div>
                      </div>
                      {/* Broad tier */}
                      <div>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[#22c55e] block mb-1">Broad</span>
                        <span className="text-[10px] text-[var(--muted-foreground)] block mb-1">{platform.broad}</span>
                        <div className="flex flex-wrap gap-0.5">
                          {broadSlice.map((h: string, i: number) => (
                            <span key={i} className="px-1 py-0.5 bg-[#22c55e08] text-[#22c55e] rounded text-[9px] border border-[#22c55e15]">{h}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function BriefExecutive({
  briefData,
  channelResearch,
  designDirection,
  campaignStrategies = [],
  editable = false,
  onFieldSave,
}: BriefExecutiveProps) {
  const messaging = briefData.messaging_strategy || {};
  const targetAudience = briefData.target_audience || {};
  const contentLang = briefData.content_language || {};
  const channels = briefData.channels || {};
  const guardrails = briefData.cultural_guardrails || {};
  const personas = briefData.personas || [];

  const perPersonaHooks = messaging.per_persona_hooks || {};
  const motivationsByPersona = targetAudience.motivations_by_persona || {};
  const painPointsByPersona = targetAudience.pain_points_by_persona || {};
  const psychologyByPersona = targetAudience.psychology_hooks_by_persona || {};

  // Build tab content
  const hasPersonas = personas.length > 0 || Object.keys(perPersonaHooks).length > 0;
  const hasChannels = channels.primary?.length > 0 || channels.secondary?.length > 0;
  const hasCulture = guardrails.things_to_avoid?.length > 0 || guardrails.things_to_lean_into?.length > 0 || contentLang.primary;
  const hasStrategy = campaignStrategies.length > 0 || briefData.campaign_strategies_summary;

  return (
    <div>
      {/* Campaign Objective — always visible above tabs */}
      <div className="mb-4">
        <EditableField
          value={briefData.campaign_objective || briefData.summary || ""}
          editable={editable}
          onSave={(v) => onFieldSave?.("campaign_objective", v)}
          textClassName="text-[15px] leading-relaxed text-[var(--foreground)]"
          multiline
        />
      </div>

      {/* Derived Requirements — AI-generated analysis */}
      {briefData.derived_requirements && (
        <details className="card p-5 mb-4">
          <summary className="cursor-pointer text-sm font-semibold text-[var(--foreground)] flex items-center justify-between list-none">
            <span className="flex items-center gap-2">
              <Sparkles size={14} className="text-[#0693e3]" />
              Derived Requirements (AI-generated analysis)
            </span>
            <span className="text-xs text-[var(--muted-foreground)]">click to expand</span>
          </summary>

          <div className="mt-4 space-y-5 text-xs">
            {/* Credential summary */}
            {briefData.derived_requirements.credential_summary && (
              <div>
                <div className="font-semibold text-[var(--foreground)] mb-1">
                  Credential summary
                </div>
                <div className="text-[var(--muted-foreground)] leading-relaxed">
                  {briefData.derived_requirements.credential_summary}
                </div>
              </div>
            )}

            {/* Pillar weighting */}
            {briefData.derived_requirements.pillar_weighting && (
              <div>
                <div className="font-semibold text-[var(--foreground)] mb-1">
                  Pillar weighting:{' '}
                  <span className="uppercase text-[#0693e3]">
                    {briefData.derived_requirements.pillar_weighting.primary}
                  </span>
                  {' → '}
                  <span className="uppercase text-[var(--muted-foreground)]">
                    {briefData.derived_requirements.pillar_weighting.secondary}
                  </span>
                </div>
                {briefData.derived_requirements.pillar_weighting.reasoning && (
                  <div className="text-[var(--muted-foreground)] italic leading-relaxed">
                    {briefData.derived_requirements.pillar_weighting.reasoning}
                  </div>
                )}
              </div>
            )}

            {/* Visual direction */}
            {briefData.derived_requirements.visual_direction && (
              <div>
                <div className="font-semibold text-[var(--foreground)] mb-2">
                  Visual direction
                </div>
                <dl className="space-y-1 text-[var(--muted-foreground)]">
                  {briefData.derived_requirements.visual_direction.work_environment && (
                    <div>
                      <span className="font-medium text-[var(--foreground)]">Work environment:</span>{' '}
                      {briefData.derived_requirements.visual_direction.work_environment}
                    </div>
                  )}
                  {briefData.derived_requirements.visual_direction.wardrobe && (
                    <div>
                      <span className="font-medium text-[var(--foreground)]">Wardrobe:</span>{' '}
                      {briefData.derived_requirements.visual_direction.wardrobe}
                    </div>
                  )}
                  {Array.isArray(briefData.derived_requirements.visual_direction.visible_tools) &&
                    briefData.derived_requirements.visual_direction.visible_tools.length > 0 && (
                      <div>
                        <span className="font-medium text-[var(--foreground)]">Visible tools:</span>{' '}
                        {briefData.derived_requirements.visual_direction.visible_tools.join(', ')}
                      </div>
                    )}
                  {briefData.derived_requirements.visual_direction.emotional_tone && (
                    <div>
                      <span className="font-medium text-[var(--foreground)]">Emotional tone:</span>{' '}
                      {briefData.derived_requirements.visual_direction.emotional_tone}
                    </div>
                  )}
                  {briefData.derived_requirements.visual_direction.cultural_adaptations && (
                    <div>
                      <span className="font-medium text-[var(--foreground)]">Cultural adaptations:</span>{' '}
                      {briefData.derived_requirements.visual_direction.cultural_adaptations}
                    </div>
                  )}
                </dl>
              </div>
            )}

            {/* Persona constraints */}
            {briefData.derived_requirements.persona_constraints && (
              <div>
                <div className="font-semibold text-[var(--foreground)] mb-2">
                  Persona constraints
                </div>
                <dl className="space-y-2 text-[var(--muted-foreground)]">
                  {briefData.derived_requirements.persona_constraints.minimum_credentials && (
                    <div>
                      <span className="font-medium text-[var(--foreground)]">Minimum credentials:</span>{' '}
                      {briefData.derived_requirements.persona_constraints.minimum_credentials}
                    </div>
                  )}
                  {briefData.derived_requirements.persona_constraints.age_range_hint && (
                    <div>
                      <span className="font-medium text-[var(--foreground)]">Age range:</span>{' '}
                      {briefData.derived_requirements.persona_constraints.age_range_hint}
                    </div>
                  )}
                  {Array.isArray(briefData.derived_requirements.persona_constraints.acceptable_tiers) &&
                    briefData.derived_requirements.persona_constraints.acceptable_tiers.length > 0 && (
                      <div>
                        <div className="font-medium text-[var(--foreground)] mb-1">
                          Acceptable tiers:
                        </div>
                        <ul className="list-disc pl-5">
                          {briefData.derived_requirements.persona_constraints.acceptable_tiers.map(
                            (tier: string, i: number) => (
                              <li key={i}>{tier}</li>
                            )
                          )}
                        </ul>
                      </div>
                    )}
                  {Array.isArray(briefData.derived_requirements.persona_constraints.excluded_archetypes) &&
                    briefData.derived_requirements.persona_constraints.excluded_archetypes.length > 0 && (
                      <div>
                        <div className="font-medium text-[var(--foreground)] mb-1">
                          Excluded archetypes:
                        </div>
                        <ul className="list-disc pl-5">
                          {briefData.derived_requirements.persona_constraints.excluded_archetypes.map(
                            (arch: string, i: number) => (
                              <li key={i}>{arch}</li>
                            )
                          )}
                        </ul>
                      </div>
                    )}
                </dl>
              </div>
            )}

            {/* Narrative angle */}
            {briefData.derived_requirements.narrative_angle && (
              <div>
                <div className="font-semibold text-[var(--foreground)] mb-1">
                  Narrative angle
                </div>
                <div className="text-[var(--muted-foreground)] italic leading-relaxed">
                  &ldquo;{briefData.derived_requirements.narrative_angle}&rdquo;
                </div>
              </div>
            )}
          </div>
        </details>
      )}

      {/* Mini Tabs */}
      <MiniTabs
        defaultTab="messaging"
        tabs={[
          // Tab 1: Messaging
          {
            key: "messaging",
            label: "Messaging",
            content: (
              <div className="space-y-4">
                {(messaging.primary_message || messaging.tone) ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 sm:gap-8">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-1">Primary Message</span>
                        <EditableField
                          value={messaging.primary_message || ""}
                          editable={editable}
                          onSave={(v) => onFieldSave?.("messaging_strategy.primary_message", v)}
                          textClassName="text-[14px] leading-relaxed text-[var(--foreground)] font-medium"
                        />
                      </div>
                      {messaging.tone && (
                        <div className="text-right min-w-[100px]">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-1">Tone</span>
                          <Tag color="#6B21A8">{messaging.tone}</Tag>
                        </div>
                      )}
                    </div>
                    {messaging.value_propositions?.length > 0 && (
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-2">Value Propositions</span>
                        <BulletList items={messaging.value_propositions} color="#22c55e" editable={editable} onItemSave={(i, v) => onFieldSave?.(`value_proposition_${i}`, v)} />
                      </div>
                    )}
                  </>
                ) : Array.isArray(briefData.messaging_strategy) ? (
                  <BulletList items={briefData.messaging_strategy} color="#6B21A8" editable={editable} onItemSave={(i, v) => onFieldSave?.(`messaging_${i}`, v)} />
                ) : null}
                {briefData.value_props && !messaging.value_propositions && (
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-2">Value Propositions</span>
                    <BulletList items={briefData.value_props} color="#E91E8C" editable={editable} onItemSave={(i, v) => onFieldSave?.(`value_prop_${i}`, v)} />
                  </div>
                )}
              </div>
            ),
          },

          // Tab 2: Personas
          ...(hasPersonas ? [{
            key: "personas",
            label: "Personas",
            count: personas.length || Object.keys(perPersonaHooks).length,
            content: (
              <div className="space-y-4">
                {personas.length > 0 ? (
                  <PersonaTable personas={personas} targetAudience={targetAudience} />
                ) : Object.keys(perPersonaHooks).length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {Object.entries(perPersonaHooks).map(([key, hook]) => (
                      <PersonaHookCard
                        key={key}
                        personaKey={key}
                        hook={String(hook)}
                        motivations={motivationsByPersona[key] as string[]}
                        painPoints={painPointsByPersona[key] as string[]}
                        psychologyHook={psychologyByPersona[key] as string}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ),
          }] : []),

          // Tab 3: Channels
          ...(hasChannels ? [{
            key: "channels",
            label: "Channels",
            count: (channels.primary?.length || 0) + (channels.secondary?.length || 0),
            content: (
              <div className="space-y-5">
                <ChannelMatrix channels={channels} personas={personas} />
                {channels.rationale && (
                  <p className="text-[12px] text-[var(--muted-foreground)] leading-relaxed italic">{channels.rationale}</p>
                )}
              </div>
            ),
          }] : []),

          // Tab 4: Targeting
          ...(hasChannels && personas.length > 0 ? [{
            key: "targeting",
            label: "Targeting",
            content: (
              <div>
                <p className="text-[12px] text-[var(--muted-foreground)] mb-3">
                  How each persona&apos;s targeting profile translates to platform-specific ad methods.
                </p>
                <TargetingTable personas={personas} channels={channels} />
              </div>
            ),
          }] : []),

          // Tab 5: Culture & Language
          ...(hasCulture ? [{
            key: "culture",
            label: "Culture & Language",
            content: (
              <div className="space-y-5">
                {(contentLang.primary || contentLang.dialect_notes) && (
                  <div>
                    <SectionHeader icon={Languages} title="Language Configuration" color="#9B51E0" />
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                      {contentLang.primary && (
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-1">Primary</span>
                          <span className="text-[13px] font-medium text-[var(--foreground)]">{contentLang.primary}</span>
                        </div>
                      )}
                      {contentLang.secondary && (
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-1">Secondary</span>
                          <span className="text-[13px] text-[var(--foreground)]">{contentLang.secondary}</span>
                        </div>
                      )}
                      {contentLang.formality && (
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-1">Formality</span>
                          <Tag color="#9B51E0">{contentLang.formality}</Tag>
                        </div>
                      )}
                      {contentLang.dialect_notes && (
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-1">Dialect</span>
                          <span className="text-[12px] text-[var(--muted-foreground)]">{contentLang.dialect_notes}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {(guardrails.things_to_avoid?.length > 0 || guardrails.things_to_lean_into?.length > 0) && (
                  <div>
                    <SectionHeader icon={Shield} title="Cultural Guardrails" color="#f59e0b" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
                      {guardrails.things_to_lean_into?.length > 0 && (
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#22c55e] block mb-2">Lean Into</span>
                          <BulletList items={guardrails.things_to_lean_into} color="#22c55e" editable={editable} onItemSave={(i, v) => onFieldSave?.(`lean_into_${i}`, v)} />
                        </div>
                      )}
                      {guardrails.things_to_avoid?.length > 0 && (
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#ef4444] block mb-2">Avoid</span>
                          <BulletList items={guardrails.things_to_avoid} color="#ef4444" editable={editable} onItemSave={(i, v) => onFieldSave?.(`avoid_${i}`, v)} />
                        </div>
                      )}
                    </div>
                    {guardrails.trust_signals?.length > 0 && (
                      <div className="mt-4">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-1.5">Trust Signals</span>
                        <div className="flex flex-wrap gap-1.5">
                          {guardrails.trust_signals.map((s: string, i: number) => (
                            <Tag key={i} color="#22c55e">{s}</Tag>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ),
          }] : []),

          // Tab 6: Media Strategy
          ...(hasStrategy ? [{
            key: "media",
            label: "Media Strategy",
            count: campaignStrategies.length,
            content: (
              <div className="space-y-4">
                {/* Summary from brief (always available if strategy was generated) */}
                {briefData.campaign_strategies_summary && (
                  <div>
                    <SectionHeader icon={Megaphone} title="Strategy Summary" color="#0693E3" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {Object.entries(briefData.campaign_strategies_summary as Record<string, any>).map(([region, summary]: [string, any]) => (
                        <div key={region} className="border border-[var(--border)] rounded-xl p-4" style={{ borderTopColor: "#0693E3", borderTopWidth: "2px" }}>
                          <h4 className="text-[12px] font-bold text-[var(--foreground)] mb-2">{region}</h4>
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-[11px]">
                              <span className="text-[var(--muted-foreground)]">Tier</span>
                              <Tag color="#0693E3">Tier {summary.tier || 1}</Tag>
                            </div>
                            <div className="flex justify-between text-[11px]">
                              <span className="text-[var(--muted-foreground)]">Ad Sets</span>
                              <span className="text-[var(--foreground)] font-medium">{summary.ad_set_count || "—"}</span>
                            </div>
                            {summary.split_test_variable && (
                              <div className="flex justify-between text-[11px]">
                                <span className="text-[var(--muted-foreground)]">Split Test</span>
                                <span className="text-[var(--foreground)] font-medium capitalize">{summary.split_test_variable}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Full strategy details from campaign_strategies table */}
                {campaignStrategies.length > 0 && (
                  <div>
                    <SectionHeader icon={Target} title="Campaign Plans" color="#6B21A8" />
                    <div className="space-y-3">
                      {campaignStrategies.map((strat) => {
                        const sd = strat.strategy_data || {};
                        const campaigns: any[] = sd.campaigns || [];
                        const splitTest = sd.split_test || {};
                        const rules = sd.rules || {};

                        return (
                          <div key={strat.id} className="border border-[var(--border)] rounded-xl overflow-hidden">
                            <div className="px-4 py-3 bg-[var(--muted)] flex items-center justify-between" style={{ borderLeft: "3px solid #6B21A8" }}>
                              <div className="flex items-center gap-3">
                                <span className="text-[13px] font-semibold text-[var(--foreground)]">{strat.country}</span>
                                <Tag color="#6B21A8">Tier {strat.tier}</Tag>
                                <Tag color="#0693E3">{strat.budget_mode}</Tag>
                              </div>
                              <span className="text-[13px] font-bold text-[var(--foreground)]">
                                ${strat.monthly_budget?.toLocaleString()}/mo
                              </span>
                            </div>

                            {/* Campaigns + ad sets */}
                            {campaigns.length > 0 && (
                              <div className="px-4 py-3 space-y-3">
                                {campaigns.map((camp: any, ci: number) => (
                                  <div key={ci}>
                                    <div className="flex items-center gap-2 mb-2">
                                      <span className="text-[11px] font-bold text-[var(--foreground)]">
                                        Campaign {ci + 1}: {camp.name || camp.objective || "Recruitment"}
                                      </span>
                                    </div>
                                    {camp.ad_sets?.length > 0 && (
                                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                                        {camp.ad_sets.map((adSet: any, ai: number) => (
                                          <div key={ai} className="border border-[var(--border)] rounded-lg p-2.5">
                                            <span className="text-[10px] font-bold text-[var(--foreground)] block mb-1">
                                              {adSet.name || `Ad Set ${ai + 1}`}
                                            </span>
                                            {adSet.targeting_tier && (
                                              <Tag color={adSet.targeting_tier === "hyper" ? "#6B21A8" : adSet.targeting_tier === "hot" ? "#f59e0b" : "#22c55e"}>
                                                {adSet.targeting_tier}
                                              </Tag>
                                            )}
                                            {adSet.daily_budget && (
                                              <span className="text-[10px] text-[var(--muted-foreground)] block mt-1">${adSet.daily_budget}/day</span>
                                            )}
                                            {adSet.interests?.length > 0 && (
                                              <div className="flex flex-wrap gap-0.5 mt-1">
                                                {adSet.interests.slice(0, 2).map((int: string, ii: number) => (
                                                  <span key={ii} className="text-[8px] px-1 py-0.5 bg-[var(--muted)] rounded text-[var(--foreground)]">{int}</span>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Split test + rules */}
                            {(splitTest.variable || rules.kill_threshold) && (
                              <div className="px-4 py-2.5 bg-[var(--muted)] border-t border-[var(--border)] flex flex-wrap gap-4 text-[11px]">
                                {splitTest.variable && (
                                  <span className="text-[var(--muted-foreground)]">
                                    Split test: <span className="font-medium text-[var(--foreground)] capitalize">{splitTest.variable}</span>
                                  </span>
                                )}
                                {rules.kill_threshold && (
                                  <span className="text-[var(--muted-foreground)]">
                                    Kill: <span className="font-medium text-[var(--foreground)]">{rules.kill_threshold}</span>
                                  </span>
                                )}
                                {rules.scale_trigger && (
                                  <span className="text-[var(--muted-foreground)]">
                                    Scale: <span className="font-medium text-[var(--foreground)]">{rules.scale_trigger}</span>
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Budget breakdown from brief */}
                {briefData.budget_data && (
                  <div>
                    <SectionHeader icon={Globe} title="Budget Allocation" color="#22c55e" />
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {Object.entries(briefData.budget_data as Record<string, any>).map(([key, val]: [string, any]) => {
                        if (typeof val !== "object" || !val) return null;
                        return (
                          <div key={key} className="border border-[var(--border)] rounded-lg p-3">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-1">{key}</span>
                            {val.monthly_budget && (
                              <span className="text-[14px] font-bold text-[var(--foreground)]">${Number(val.monthly_budget).toLocaleString()}</span>
                            )}
                            {val.weight_pct && (
                              <span className="text-[10px] text-[var(--muted-foreground)] block">{val.weight_pct}% of total</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ),
          }] : []),
        ]}
      />
    </div>
  );
}
