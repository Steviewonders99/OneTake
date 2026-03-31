"use client";

import {
  Globe,
  Smartphone,
  TrendingUp,
  Users,
  Shield,
  MessageSquare,
  Brain,
  Languages,
  AlertTriangle,
} from "lucide-react";
import MiniTabs from "@/components/MiniTabs";
import EditableField from "@/components/EditableField";
import { toReadable } from "@/lib/format";

interface ResearchPanelProps {
  channelResearch: Record<string, any>;
  culturalResearch?: Record<string, any>;
  regions?: string[];
  editable?: boolean;
  onFieldSave?: (path: string, value: string) => void;
}

function ResearchDimension({
  icon: Icon,
  title,
  data,
  color = "#6B21A8",
  editable = false,
  onSave,
}: {
  icon: React.ComponentType<Record<string, any>>;
  title: string;
  data: any;
  color?: string;
  editable?: boolean;
  onSave?: (value: string) => void;
}) {
  if (!data) return null;

  // Handle string data
  if (typeof data === "string") {
    return (
      <div className="border border-[var(--border)] rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: `${color}10`, color }}>
            <Icon size={13} />
          </div>
          <h4 className="text-[12px] font-bold uppercase tracking-wider text-[var(--foreground)]">{title}</h4>
        </div>
        {editable ? (
          <EditableField
            value={data}
            editable
            onSave={(v) => onSave?.(v)}
            textClassName="text-[13px] text-[var(--foreground)] leading-relaxed"
            multiline
          />
        ) : (
          <p className="text-[13px] text-[var(--foreground)] leading-relaxed">{data}</p>
        )}
      </div>
    );
  }

  // Handle object data — render key-value pairs
  if (typeof data === "object" && !Array.isArray(data)) {
    const entries = Object.entries(data).filter(([_, v]) => v !== null && v !== undefined && v !== "");
    if (entries.length === 0) return null;

    return (
      <div className="border border-[var(--border)] rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: `${color}10`, color }}>
            <Icon size={13} />
          </div>
          <h4 className="text-[12px] font-bold uppercase tracking-wider text-[var(--foreground)]">{title}</h4>
        </div>
        <div className="space-y-2">
          {entries.map(([key, val]) => (
            <div key={key}>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                {key.replace(/_/g, " ")}
              </span>
              {typeof val === "string" ? (
                <p className="text-[12px] text-[var(--foreground)] leading-relaxed">{val}</p>
              ) : Array.isArray(val) ? (
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {val.map((item: string, i: number) => (
                    <span key={i} className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)]">
                      {typeof item === "string" ? item : toReadable(item)}
                    </span>
                  ))}
                </div>
              ) : typeof val === "object" ? (
                <p className="text-[12px] text-[var(--foreground)] leading-relaxed">{toReadable(val)}</p>
              ) : (
                <p className="text-[12px] text-[var(--foreground)]">{String(val)}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

function ChannelResearchGrid({ data }: { data: Record<string, any> }) {
  // Channel research is typically an array of channel objects or a keyed object
  const channels = Array.isArray(data) ? data :
    data.channels ? (Array.isArray(data.channels) ? data.channels : Object.values(data.channels)) :
    Object.entries(data).map(([k, v]) => ({ name: k, ...((typeof v === "object" && v) ? v as Record<string, any> : { value: v }) }));

  if (!channels || channels.length === 0) return null;

  return (
    <div className="space-y-3">
      {channels.map((ch: any, i: number) => {
        const name = ch.name || ch.channel || `Channel ${i + 1}`;
        const effectiveness = ch.effectiveness || ch.score || ch.relevance;
        return (
          <div key={i} className="border border-[var(--border)] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[13px] font-semibold text-[var(--foreground)]">{name}</h4>
              {effectiveness !== undefined && (
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 bg-[var(--muted)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, typeof effectiveness === "number" ? effectiveness : parseInt(effectiveness) || 0)}%`,
                        background: "linear-gradient(90deg, #0693E3, #6B21A8)",
                      }}
                    />
                  </div>
                  <span className="text-[11px] font-semibold text-[var(--foreground)]">
                    {typeof effectiveness === "number" ? `${effectiveness}%` : effectiveness}
                  </span>
                </div>
              )}
            </div>
            {ch.rationale && (
              <p className="text-[12px] text-[var(--muted-foreground)] leading-relaxed">{ch.rationale}</p>
            )}
            {ch.formats && Array.isArray(ch.formats) && ch.formats.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {ch.formats.map((f: string, j: number) => (
                  <span key={j} className="px-2 py-0.5 rounded text-[10px] bg-[#0693E308] text-[#0693E3] border border-[#0693E315]">{f}</span>
                ))}
              </div>
            )}
            {ch.sources && Array.isArray(ch.sources) && ch.sources.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {ch.sources.map((s: string, j: number) => (
                  <span key={j} className="text-[10px] text-[var(--muted-foreground)] italic">{s}</span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const DIMENSION_CONFIG: {
  key: string;
  label: string;
  icon: React.ComponentType<Record<string, any>>;
  color: string;
}[] = [
  { key: "ai_fatigue", label: "AI Fatigue", icon: Brain, color: "#ef4444" },
  { key: "gig_work_perception", label: "Gig Work Perception", icon: TrendingUp, color: "#22c55e" },
  { key: "data_annotation_trust", label: "Data Annotation Trust", icon: Shield, color: "#6B21A8" },
  { key: "platform_reality", label: "Platform Reality", icon: Smartphone, color: "#0693E3" },
  { key: "demographic_channel_map", label: "Demographics & Channels", icon: Users, color: "#E91E8C" },
  { key: "economic_context", label: "Economic Context", icon: TrendingUp, color: "#f59e0b" },
  { key: "cultural_sensitivities", label: "Cultural Sensitivities", icon: AlertTriangle, color: "#ef4444" },
  { key: "tech_literacy", label: "Tech Literacy", icon: Smartphone, color: "#0693E3" },
  { key: "language_nuance", label: "Language Nuance", icon: Languages, color: "#9B51E0" },
];

export default function ResearchPanel({
  channelResearch,
  culturalResearch,
  regions = [],
  editable = false,
  onFieldSave,
}: ResearchPanelProps) {
  // Merge cultural research from brief and progress data
  const research = culturalResearch || channelResearch || {};

  // If research is per-region (keyed by region name), build tabs per region
  const regionKeys = Object.keys(research).filter(
    (k) => typeof research[k] === "object" && !Array.isArray(research[k]) && regions.includes(k)
  );

  const hasPerRegion = regionKeys.length > 0;

  // Build dimension tabs from all research data
  const allDimensions = hasPerRegion
    ? DIMENSION_CONFIG.filter((d) =>
        regionKeys.some((r) => research[r]?.[d.key])
      )
    : DIMENSION_CONFIG.filter((d) => research[d.key]);

  return (
    <MiniTabs
      defaultTab={hasPerRegion ? "overview" : (allDimensions[0]?.key || "channels")}
      tabs={[
        // Overview — channel research
        {
          key: "overview",
          label: "Channels",
          content: <ChannelResearchGrid data={channelResearch || {}} />,
        },

        // Per-dimension tabs
        ...allDimensions.map((dim) => ({
          key: dim.key,
          label: dim.label,
          content: (
            <div className="space-y-3">
              {hasPerRegion ? (
                // Show per-region cards
                regionKeys.map((region) => {
                  const regionData = research[region]?.[dim.key];
                  if (!regionData) return null;
                  return (
                    <div key={region}>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-1.5">
                        {region}
                      </span>
                      <ResearchDimension
                        icon={dim.icon}
                        title={dim.label}
                        data={regionData}
                        color={dim.color}
                      />
                    </div>
                  );
                })
              ) : (
                // Show single dimension
                <ResearchDimension
                  icon={dim.icon}
                  title={dim.label}
                  data={research[dim.key]}
                  color={dim.color}
                />
              )}
            </div>
          ),
        })),
      ]}
    />
  );
}
