"use client";

import { useState, useEffect } from "react";
import {
  Target,
  DollarSign,
  TrendingUp,
  Layers,
  FlaskConical,
  ArrowRight,
  Shield,
  Zap,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdSet {
  name: string;
  persona?: string;
  targeting_type?: "hyper" | "hot" | "broad" | string;
  interests?: string[];
  daily_budget?: number;
  kill_threshold?: number;
  placements?: string[];
  description?: string;
}

interface SplitTest {
  variable?: string;
  description?: string;
  measurement?: string;
}

interface ProgressionRule {
  next_tier_trigger?: string;
  what_gets_added?: string;
  estimated_timeline?: string;
}

interface ScalingRules {
  winning_rule?: string;
  losing_rule?: string;
  creative_rule?: string;
}

interface StrategyData {
  tier_label?: string;
  split_test?: SplitTest;
  ad_sets?: AdSet[];
  progression?: ProgressionRule;
  scaling_rules?: ScalingRules;
  notes?: string;
}

interface CampaignStrategy {
  id: string;
  request_id: string;
  country: string;
  tier: number;
  monthly_budget: string | number | null;
  budget_mode: "fixed" | "ratio";
  strategy_data: StrategyData;
  evaluation_score: string | number | null;
  evaluation_passed: boolean | null;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function targetingColor(type: string | undefined) {
  switch (type) {
    case "hyper":
      return "bg-purple-100 text-purple-700";
    case "hot":
      return "bg-orange-100 text-orange-700";
    case "broad":
      return "bg-blue-100 text-blue-700";
    default:
      return "bg-[var(--muted)] text-[var(--muted-foreground)]";
  }
}

function formatBudget(value: string | number | null) {
  if (value === null || value === undefined) return "—";
  const n = typeof value === "string" ? parseFloat(value) : value;
  return isNaN(n) ? "—" : `$${n.toLocaleString()}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-[var(--muted-foreground)]">{icon}</span>
      <h3 className="text-sm font-semibold text-[var(--foreground)]">{title}</h3>
    </div>
  );
}

function SplitTestCard({ test }: { test: SplitTest }) {
  return (
    <div className="border border-[var(--border)] rounded-[var(--radius-md)] p-4 space-y-2">
      {test.variable && (
        <div className="flex items-start gap-2">
          <span className="text-xs font-semibold text-[var(--muted-foreground)] w-24 shrink-0">
            Variable
          </span>
          <span className="text-xs text-[var(--foreground)]">{test.variable}</span>
        </div>
      )}
      {test.description && (
        <div className="flex items-start gap-2">
          <span className="text-xs font-semibold text-[var(--muted-foreground)] w-24 shrink-0">
            Description
          </span>
          <span className="text-xs text-[var(--foreground)] leading-relaxed">
            {test.description}
          </span>
        </div>
      )}
      {test.measurement && (
        <div className="flex items-start gap-2">
          <span className="text-xs font-semibold text-[var(--muted-foreground)] w-24 shrink-0">
            Measurement
          </span>
          <span className="text-xs text-[var(--foreground)]">{test.measurement}</span>
        </div>
      )}
    </div>
  );
}

function AdSetCard({ adSet }: { adSet: AdSet }) {
  return (
    <div className="border border-[var(--border)] rounded-[var(--radius-md)] p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[var(--foreground)]">{adSet.name}</p>
          {adSet.persona && (
            <span className="inline-block text-[10px] font-medium px-2 py-0.5 bg-[var(--muted)] text-[var(--muted-foreground)] rounded-full">
              {adSet.persona}
            </span>
          )}
        </div>
        {adSet.targeting_type && (
          <span
            className={`inline-block text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${targetingColor(
              adSet.targeting_type
            )}`}
          >
            {adSet.targeting_type}
          </span>
        )}
      </div>

      {/* Description */}
      {adSet.description && (
        <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
          {adSet.description}
        </p>
      )}

      {/* Interests */}
      {adSet.interests && adSet.interests.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-[var(--muted-foreground)] mb-1.5 uppercase tracking-wide">
            Interests
          </p>
          <div className="flex flex-wrap gap-1.5">
            {adSet.interests.map((interest) => (
              <span
                key={interest}
                className="text-[10px] px-2 py-0.5 border border-[var(--border)] rounded-full text-[var(--muted-foreground)]"
              >
                {interest}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Placements */}
      {adSet.placements && adSet.placements.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-[var(--muted-foreground)] mb-1.5 uppercase tracking-wide">
            Placements
          </p>
          <div className="flex flex-wrap gap-1.5">
            {adSet.placements.map((p) => (
              <span
                key={p}
                className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full border border-blue-100"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Budget row */}
      {(adSet.daily_budget !== undefined || adSet.kill_threshold !== undefined) && (
        <div className="flex items-center gap-4 pt-1 border-t border-[var(--border)]">
          {adSet.daily_budget !== undefined && (
            <div>
              <p className="text-[10px] text-[var(--muted-foreground)]">Daily budget</p>
              <p className="text-xs font-semibold text-[var(--foreground)]">
                ${adSet.daily_budget}/day
              </p>
            </div>
          )}
          {adSet.kill_threshold !== undefined && (
            <div>
              <p className="text-[10px] text-[var(--muted-foreground)]">Kill threshold</p>
              <p className="text-xs font-semibold text-red-600">${adSet.kill_threshold}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProgressionCard({ rule }: { rule: ProgressionRule }) {
  return (
    <div className="border border-[var(--border)] rounded-[var(--radius-md)] p-4 space-y-3">
      {rule.next_tier_trigger && (
        <div className="flex items-start gap-3">
          <ArrowRight size={14} className="text-[var(--muted-foreground)] mt-0.5 shrink-0" />
          <div>
            <p className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wide mb-0.5">
              Next tier trigger
            </p>
            <p className="text-xs text-[var(--foreground)] leading-relaxed">
              {rule.next_tier_trigger}
            </p>
          </div>
        </div>
      )}
      {rule.what_gets_added && (
        <div className="flex items-start gap-3">
          <Zap size={14} className="text-[var(--muted-foreground)] mt-0.5 shrink-0" />
          <div>
            <p className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wide mb-0.5">
              What gets added
            </p>
            <p className="text-xs text-[var(--foreground)] leading-relaxed">
              {rule.what_gets_added}
            </p>
          </div>
        </div>
      )}
      {rule.estimated_timeline && (
        <div className="flex items-start gap-3">
          <TrendingUp size={14} className="text-[var(--muted-foreground)] mt-0.5 shrink-0" />
          <div>
            <p className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wide mb-0.5">
              Estimated timeline
            </p>
            <p className="text-xs text-[var(--foreground)]">{rule.estimated_timeline}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function ScalingCard({ rules }: { rules: ScalingRules }) {
  const items: { icon: React.ReactNode; label: string; value: string }[] = [];
  if (rules.winning_rule)
    items.push({
      icon: <TrendingUp size={13} className="text-green-600" />,
      label: "Winning",
      value: rules.winning_rule,
    });
  if (rules.losing_rule)
    items.push({
      icon: <Shield size={13} className="text-red-500" />,
      label: "Losing",
      value: rules.losing_rule,
    });
  if (rules.creative_rule)
    items.push({
      icon: <Layers size={13} className="text-blue-500" />,
      label: "Creative",
      value: rules.creative_rule,
    });

  return (
    <div className="border border-[var(--border)] rounded-[var(--radius-md)] divide-y divide-[var(--border)]">
      {items.map((item) => (
        <div key={item.label} className="flex items-start gap-3 p-4">
          <span className="mt-0.5 shrink-0">{item.icon}</span>
          <div>
            <p className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wide mb-0.5">
              {item.label} ad set
            </p>
            <p className="text-xs text-[var(--foreground)] leading-relaxed">{item.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-[var(--muted)] rounded-[var(--radius-sm)] ${className ?? ""}`}
    />
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <SkeletonBlock className="h-8 w-24 rounded-full" />
        <SkeletonBlock className="h-8 w-24 rounded-full" />
      </div>
      <div className="space-y-3">
        <SkeletonBlock className="h-5 w-32" />
        <SkeletonBlock className="h-20 w-full" />
      </div>
      <div className="space-y-3">
        <SkeletonBlock className="h-5 w-24" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SkeletonBlock className="h-36" />
          <SkeletonBlock className="h-36" />
        </div>
      </div>
    </div>
  );
}

// ─── Single strategy panel ────────────────────────────────────────────────────

function StrategyPanel({ strategy }: { strategy: CampaignStrategy }) {
  const data = strategy.strategy_data ?? {};
  const adSets = data.ad_sets ?? [];
  const hasProgression = data.progression && Object.keys(data.progression).length > 0;
  const hasScaling = data.scaling_rules && Object.keys(data.scaling_rules).length > 0;
  const hasSplitTest = data.split_test && Object.keys(data.split_test).length > 0;

  return (
    <div className="space-y-6">
      {/* Tier badge + budget summary */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full border border-[var(--border)] bg-[var(--muted)] text-[var(--foreground)]">
          <Layers size={12} />
          Tier {strategy.tier}
          {data.tier_label ? ` — ${data.tier_label}` : ""}
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full border border-[var(--border)] bg-[var(--muted)] text-[var(--foreground)]">
          <DollarSign size={12} />
          {formatBudget(strategy.monthly_budget)} / mo
          {strategy.budget_mode === "ratio" && (
            <span className="font-normal text-[var(--muted-foreground)]">(ratio)</span>
          )}
        </span>
        {strategy.evaluation_score !== null && strategy.evaluation_score !== undefined && (
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full ${
              strategy.evaluation_passed
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-yellow-50 text-yellow-700 border border-yellow-200"
            }`}
          >
            <Target size={12} />
            Score: {Number(strategy.evaluation_score).toFixed(2)}
          </span>
        )}
      </div>

      {/* Split Test */}
      {hasSplitTest && (
        <div>
          <SectionHeader icon={<FlaskConical size={15} />} title="Split Test" />
          <SplitTestCard test={data.split_test!} />
        </div>
      )}

      {/* Ad Sets */}
      {adSets.length > 0 && (
        <div>
          <SectionHeader icon={<Target size={15} />} title={`Ad Sets (${adSets.length})`} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {adSets.map((adSet, i) => (
              <AdSetCard key={adSet.name ?? i} adSet={adSet} />
            ))}
          </div>
        </div>
      )}

      {/* Progression Rules */}
      {hasProgression && (
        <div>
          <SectionHeader icon={<ArrowRight size={15} />} title="Progression Rules" />
          <ProgressionCard rule={data.progression!} />
        </div>
      )}

      {/* Scaling Rules */}
      {hasScaling && (
        <div>
          <SectionHeader icon={<TrendingUp size={15} />} title="Scaling Rules" />
          <ScalingCard rules={data.scaling_rules!} />
        </div>
      )}

      {/* Notes */}
      {data.notes && (
        <div className="p-4 bg-[var(--muted)] rounded-[var(--radius-md)]">
          <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">{data.notes}</p>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface CampaignStrategyViewProps {
  requestId: string;
}

export default function CampaignStrategyView({ requestId }: CampaignStrategyViewProps) {
  const [strategies, setStrategies] = useState<CampaignStrategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCountry, setActiveCountry] = useState<string | null>(null);

  useEffect(() => {
    const fetchStrategies = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/generate/${requestId}/strategy`);
        if (!res.ok) throw new Error(`Failed to load strategies (${res.status})`);
        const data = await res.json();
        const rows: CampaignStrategy[] = data.strategies ?? [];
        setStrategies(rows);
        if (rows.length > 0) {
          setActiveCountry(rows[0].country);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchStrategies();
  }, [requestId]);

  if (loading) return <LoadingSkeleton />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <Shield size={32} className="text-red-400" />
        <p className="text-sm font-medium text-[var(--foreground)]">Failed to load strategies</p>
        <p className="text-xs text-[var(--muted-foreground)]">{error}</p>
      </div>
    );
  }

  if (strategies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <Layers size={36} className="text-[var(--muted-foreground)]" />
        <p className="text-sm font-medium text-[var(--foreground)]">
          No campaign strategy generated yet
        </p>
        <p className="text-xs text-[var(--muted-foreground)]">
          Run the full pipeline to generate a tiered media plan for each target country.
        </p>
      </div>
    );
  }

  // Deduplicate by country — keep most recent (already ordered by created_at DESC)
  const byCountry = strategies.reduce<Record<string, CampaignStrategy>>((acc, s) => {
    if (!acc[s.country]) acc[s.country] = s;
    return acc;
  }, {});
  const countries = Object.keys(byCountry);
  const activeStrategy = activeCountry ? byCountry[activeCountry] : byCountry[countries[0]];

  return (
    <div className="space-y-6">
      {/* Country tabs — only shown when there are multiple */}
      {countries.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {countries.map((country) => (
            <button
              key={country}
              type="button"
              onClick={() => setActiveCountry(country)}
              className={`px-4 py-1.5 text-xs font-semibold rounded-full border transition-colors cursor-pointer ${
                activeCountry === country
                  ? "bg-[#32373C] text-white border-[#32373C]"
                  : "bg-white text-[var(--foreground)] border-[var(--border)] hover:border-[#32373C]"
              }`}
            >
              {country}
            </button>
          ))}
        </div>
      )}

      {activeStrategy && <StrategyPanel strategy={activeStrategy} />}
    </div>
  );
}
