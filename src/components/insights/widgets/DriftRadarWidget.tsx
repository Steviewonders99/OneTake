"use client";

import { useEffect, useState } from 'react';
import { Radar, AlertTriangle, CheckCircle } from 'lucide-react';

interface DriftData {
  computed: boolean;
  declared_vs_paid: number;
  declared_vs_organic: number;
  paid_vs_converted: number;
  organic_vs_converted: number;
  overall_drift: number;
  severity: 'low' | 'moderate' | 'high';
  segment_mismatch: boolean;
  recommendations: string[];
}

const SEVERITY_COLORS = {
  low: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', icon: CheckCircle },
  moderate: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: AlertTriangle },
  high: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: AlertTriangle },
};

const PAIR_LABELS: Record<string, string> = {
  declared_vs_paid: 'Declared vs Paid',
  declared_vs_organic: 'Declared vs Organic',
  paid_vs_converted: 'Paid vs Converted',
  organic_vs_converted: 'Organic vs Converted',
};

const PAIR_COLORS: Record<string, string> = {
  declared_vs_paid: '#0693e3',
  declared_vs_organic: '#9b51e0',
  paid_vs_converted: '#dc2626',
  organic_vs_converted: '#ca8a04',
};

export default function DriftRadarWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<DriftData | null>(null);
  const requestId = config.requestId as string;

  useEffect(() => {
    if (!requestId) return;
    fetch(`/api/audienceiq/drift/${requestId}`).then(r => r.json()).then(setData).catch(() => {});
  }, [requestId]);

  if (!requestId) {
    return <div className="h-full flex items-center justify-center text-xs text-[var(--muted-foreground)]">Configure a campaign in widget settings</div>;
  }
  if (!data) return <div className="h-full skeleton rounded-lg" />;
  if (!data.computed) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 text-center p-4">
        <Radar className="w-8 h-8 text-[var(--muted-foreground)]" />
        <p className="text-xs font-semibold text-[var(--foreground)]">No Drift Data</p>
        <p className="text-[10px] text-[var(--muted-foreground)]">Trigger drift computation from the admin panel</p>
      </div>
    );
  }

  const sev = SEVERITY_COLORS[data.severity];
  const SevIcon = sev.icon;
  const pairs = ['declared_vs_paid', 'declared_vs_organic', 'paid_vs_converted', 'organic_vs_converted'] as const;

  return (
    <div className="h-full flex flex-col gap-3 overflow-auto">
      <div className={`flex items-center gap-3 p-3 rounded-xl border ${sev.bg} ${sev.border}`}>
        <SevIcon className={`w-5 h-5 ${sev.text}`} />
        <div>
          <div className={`text-lg font-bold ${sev.text}`}>{data.overall_drift}%</div>
          <div className="text-[10px] font-medium text-[var(--muted-foreground)] uppercase">Overall Drift — {data.severity}</div>
        </div>
      </div>
      <div className="space-y-2.5">
        {pairs.map(key => {
          const value = data[key];
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-medium text-[var(--muted-foreground)]">{PAIR_LABELS[key]}</span>
                <span className="text-xs font-bold text-[var(--foreground)]">{value}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-[var(--muted)] overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(value, 100)}%`, background: PAIR_COLORS[key] }} />
              </div>
            </div>
          );
        })}
      </div>
      {data.recommendations.length > 0 && (
        <div className="space-y-1.5 mt-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Recommendations</div>
          {data.recommendations.map((rec, i) => (
            <div key={i} className="text-[10px] text-[var(--foreground)] bg-[var(--muted)] rounded-lg px-3 py-2">{rec}</div>
          ))}
        </div>
      )}
    </div>
  );
}
