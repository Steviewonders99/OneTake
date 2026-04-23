"use client";

import { useEffect, useState } from 'react';
import { HeartPulse, AlertTriangle, AlertCircle, Info } from 'lucide-react';

interface HealthIssue {
  type: string;
  message: string;
  recommended_action: string;
  severity: 'critical' | 'warning' | 'info';
  deduction: number;
}

interface HealthData {
  computed: boolean;
  score: number;
  issues: HealthIssue[];
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#16a34a';
  if (score >= 60) return '#ca8a04';
  if (score >= 40) return '#ea580c';
  return '#dc2626';
}

const SEVERITY_ICONS = { critical: AlertTriangle, warning: AlertCircle, info: Info };
const SEVERITY_STYLES = {
  critical: 'bg-red-50 text-red-700 border-red-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  info: 'bg-blue-50 text-blue-600 border-blue-200',
};

export default function AudienceHealthWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<HealthData | null>(null);
  const requestId = config.requestId as string;

  useEffect(() => {
    if (!requestId) return;
    fetch(`/api/audienceiq/health/${requestId}`).then(r => r.json()).then(setData).catch(() => {});
  }, [requestId]);

  if (!requestId) return <div className="h-full flex items-center justify-center text-xs text-[var(--muted-foreground)]">Configure a campaign in widget settings</div>;
  if (!data) return <div className="h-full skeleton rounded-lg" />;
  if (!data.computed) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 text-center p-4">
        <HeartPulse className="w-8 h-8 text-[var(--muted-foreground)]" />
        <p className="text-xs font-semibold text-[var(--foreground)]">No Health Data</p>
        <p className="text-[10px] text-[var(--muted-foreground)]">Trigger drift computation to generate health scores</p>
      </div>
    );
  }

  const color = getScoreColor(data.score);
  const circumference = 2 * Math.PI * 45;
  const strokeDasharray = `${(data.score / 100) * circumference} ${circumference}`;

  return (
    <div className="h-full flex flex-col gap-3 overflow-auto">
      <div className="flex items-center justify-center py-2">
        <div className="relative w-28 h-28">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="45" fill="none" stroke="var(--muted)" strokeWidth="8" />
            <circle cx="50" cy="50" r="45" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={strokeDasharray} className="transition-all duration-1000" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold" style={{ color }}>{data.score}</span>
            <span className="text-[9px] text-[var(--muted-foreground)]">/ 100</span>
          </div>
        </div>
      </div>
      {data.issues.length > 0 && (
        <div className="space-y-1.5">
          {data.issues.map((issue, i) => {
            const Icon = SEVERITY_ICONS[issue.severity];
            const styles = SEVERITY_STYLES[issue.severity];
            return (
              <div key={i} className={`flex gap-2 p-2.5 rounded-lg border ${styles}`}>
                <Icon className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold">{issue.message}</div>
                  <div className="text-[9px] opacity-80 mt-0.5">{issue.recommended_action}</div>
                </div>
                {issue.deduction > 0 && <span className="text-[9px] font-bold shrink-0">-{issue.deduction}</span>}
              </div>
            );
          })}
        </div>
      )}
      {data.issues.length === 0 && <div className="text-center text-xs text-green-600 font-medium">No issues detected</div>}
    </div>
  );
}
