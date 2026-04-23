"use client";

import { useEffect, useState } from 'react';
import { ArrowDown, Unplug } from 'lucide-react';

interface FunnelStage {
  stage: string;
  label: string;
  count: number;
  conversion_rate: number | null;
}

interface FunnelData {
  connected: boolean;
  message?: string;
  stages: FunnelStage[];
}

const STAGE_COLORS = ['#0693e3', '#9b51e0', '#16a34a', '#ca8a04'];

export default function ContributorFunnelWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<FunnelData | null>(null);
  const requestId = config.requestId as string;

  useEffect(() => {
    if (!requestId) return;
    fetch(`/api/audienceiq/funnel/${requestId}`).then(r => r.json()).then(setData).catch(() => {});
  }, [requestId]);

  if (!requestId) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-[var(--muted-foreground)]">
        Configure a campaign in widget settings to see the contributor funnel
      </div>
    );
  }

  if (!data) return <div className="h-full skeleton rounded-lg" />;

  if (!data.connected) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 text-center p-4">
        <Unplug className="w-8 h-8 text-[var(--muted-foreground)]" />
        <p className="text-xs font-semibold text-[var(--foreground)]">CRM Not Connected</p>
        <p className="text-[10px] text-[var(--muted-foreground)]">Set CRM_DATABASE_URL to enable the contributor funnel</p>
      </div>
    );
  }

  const maxCount = Math.max(...data.stages.map(s => s.count), 1);

  return (
    <div className="h-full flex flex-col justify-center gap-2 px-4">
      {data.stages.map((stage, i) => (
        <div key={stage.stage}>
          <div className="flex items-center gap-3">
            <div className="w-24 text-right">
              <span className="text-[10px] font-medium text-[var(--muted-foreground)]">{stage.label}</span>
            </div>
            <div className="flex-1 relative">
              <div className="h-9 rounded-lg bg-[var(--muted)] overflow-hidden">
                <div
                  className="h-full rounded-lg transition-all duration-500"
                  style={{
                    width: `${Math.max((stage.count / maxCount) * 100, 4)}%`,
                    background: STAGE_COLORS[i] ?? '#737373',
                  }}
                />
              </div>
            </div>
            <div className="w-16 text-right">
              <span className="text-sm font-bold text-[var(--foreground)]">{stage.count}</span>
            </div>
          </div>
          {stage.conversion_rate !== null && i > 0 && (
            <div className="flex items-center gap-3 ml-24 pl-3 my-0.5">
              <ArrowDown className="w-3 h-3 text-[var(--muted-foreground)]" />
              <span className="text-[10px] text-[var(--muted-foreground)]">{stage.conversion_rate}% conversion</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
