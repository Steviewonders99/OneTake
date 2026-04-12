"use client";

import { useState, useMemo } from "react";
import { getActiveChannels, CHANNEL_DEFINITIONS } from "@/lib/channels";
import AdSetCard from "./AdSetCard";
import type { GeneratedAsset } from "@/lib/types";

interface Persona {
  persona_name?: string;
  name?: string;
  archetype_key?: string;
  best_channels?: string[];
  targeting_profile?: {
    budget_weight_pct?: number;
    interests?: { hyper?: string[]; hot?: string[]; broad?: string[] };
  };
}

interface AgencyChannelsTabProps {
  assets: GeneratedAsset[];
  personas: Persona[];
  campaignSlug: string;
  trackingBaseUrl: string | null;
  strategiesSummary: Record<string, { tier?: number; ad_set_count?: number; split_test_variable?: string }> | null;
}

export default function AgencyChannelsTab({
  assets,
  personas,
  campaignSlug,
  trackingBaseUrl,
  strategiesSummary,
}: AgencyChannelsTabProps) {
  const channels = useMemo(() => getActiveChannels(assets), [assets]);
  const [activeChannel, setActiveChannel] = useState(() => channels[0] ?? "");

  // Build ad sets for the active channel by mapping personas that target this channel
  const adSets = useMemo(() => {
    const channelDef = CHANNEL_DEFINITIONS[activeChannel];
    if (!channelDef) return [];

    const channelPlatforms = new Set(channelDef.platforms);
    const channelAssets = assets.filter(
      (a) => a.asset_type === "composed_creative" && channelPlatforms.has(a.platform),
    );

    // Group by persona
    return personas
      .filter((p) => {
        const bestCh = (p.best_channels ?? []).map((c) =>
          c.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase())
        );
        // Check if persona targets this channel (fuzzy match on channel name)
        return bestCh.some((ch) =>
          ch.toLowerCase().includes(activeChannel.toLowerCase()) ||
          activeChannel.toLowerCase().includes(ch.toLowerCase().split(" ")[0])
        );
      })
      .map((p, i) => {
        const personaKey = p.archetype_key || `persona_${i}`;
        const personaName = p.persona_name || p.name || personaKey.replace(/_/g, " ");
        const tp = p.targeting_profile ?? {};
        const interests = tp.interests ?? {};

        // Filter assets for this persona
        const personaAssets = channelAssets.filter((a) => {
          const content = (a.content || {}) as Record<string, string>;
          return content.persona === personaKey || content.actor_name?.toLowerCase().includes(personaName.split(" ")[0]?.toLowerCase() || "");
        });

        // If no persona-specific match, include all channel assets (fallback)
        const finalAssets = personaAssets.length > 0 ? personaAssets : channelAssets;
        const pillar = ((finalAssets[0]?.content || {}) as Record<string, string>).pillar || "earn";

        return {
          adSet: {
            name: `${personaName.split("—")[0].trim()} — ${activeChannel}`,
            personaName: personaName.split("—")[0].trim(),
            pillar: pillar.charAt(0).toUpperCase() + pillar.slice(1),
            objective: "Lead Generation",
            dailyBudget: tp.budget_weight_pct ? String(Math.round((tp.budget_weight_pct / 100) * 150)) : undefined,
            splitTestVariable: strategiesSummary ? Object.values(strategiesSummary)[0]?.split_test_variable : undefined,
            interests: {
              hyper: (interests.hyper as string[]) ?? [],
              hot: (interests.hot as string[]) ?? [],
              broad: (interests.broad as string[]) ?? [],
            },
          },
          assets: finalAssets,
        };
      })
      .filter((entry) => entry.assets.length > 0);
  }, [activeChannel, assets, personas, strategiesSummary]);

  // Count ad sets per channel for the tabs
  const channelAdSetCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const ch of channels) {
      const channelDef = CHANNEL_DEFINITIONS[ch];
      if (!channelDef) continue;
      const matching = personas.filter((p) => {
        const bestCh = (p.best_channels ?? []).map((c) =>
          c.replace(/_/g, " ").replace(/\b\w/g, (x) => x.toUpperCase())
        );
        return bestCh.some((c) => c.toLowerCase().includes(ch.toLowerCase()) || ch.toLowerCase().includes(c.toLowerCase().split(" ")[0]));
      });
      counts[ch] = Math.max(matching.length, 1);
    }
    return counts;
  }, [channels, personas]);

  if (channels.length === 0) {
    return <div style={{ padding: "48px 0", textAlign: "center", fontSize: 13, color: "#8A8A8E" }}>No creatives generated yet.</div>;
  }

  return (
    <div>
      {/* Channel sub-tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
        {channels.map((ch) => (
          <button
            key={ch}
            onClick={() => setActiveChannel(ch)}
            style={{
              fontSize: 12, fontWeight: 600, padding: "6px 16px", borderRadius: 9999,
              border: `1px solid ${activeChannel === ch ? "#32373C" : "#E8E8EA"}`,
              background: activeChannel === ch ? "#32373C" : "white",
              color: activeChannel === ch ? "white" : "#8A8A8E",
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            {ch} · {channelAdSetCounts[ch] ?? 0} ad sets
          </button>
        ))}
      </div>

      {/* Ad set cards */}
      {adSets.map((entry, i) => (
        <AdSetCard
          key={`${activeChannel}-${i}`}
          adSet={entry.adSet}
          assets={entry.assets}
          channelName={activeChannel}
          campaignSlug={campaignSlug}
          trackingBaseUrl={trackingBaseUrl}
        />
      ))}

      {adSets.length === 0 && (
        <div style={{ padding: "32px 0", textAlign: "center", fontSize: 13, color: "#8A8A8E" }}>
          No ad sets for {activeChannel}. Creatives may not be mapped to personas yet.
        </div>
      )}
    </div>
  );
}
