"use client";

import { useEffect, useState } from 'react';
import { Eye, Users, TrendingUp, MousePointerClick } from 'lucide-react';

interface OrganicOverview {
  impressions: number;
  reach: number;
  engagement: number;
  clicks: number;
  followers_delta: number;
  engagement_rate: number;
}

export default function OrganicKpiWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<OrganicOverview | null>(null);

  useEffect(() => {
    const days = (config.days as number) || 30;
    fetch(`/api/insights/metrics/organic-overview?days=${days}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {});
  }, [config.days]);

  if (!data) return <div className="h-full skeleton rounded-lg" />;

  const cards = [
    { label: 'Impressions', value: data.impressions.toLocaleString(), Icon: Eye },
    { label: 'Reach', value: data.reach.toLocaleString(), Icon: Users },
    { label: 'Engagement', value: data.engagement.toLocaleString(), Icon: TrendingUp },
    { label: 'Clicks', value: data.clicks.toLocaleString(), Icon: MousePointerClick },
    {
      label: 'Followers +/-',
      value: (data.followers_delta >= 0 ? '+' : '') + data.followers_delta.toLocaleString(),
      Icon: Users,
    },
    {
      label: 'Eng Rate',
      value: `${data.engagement_rate.toFixed(2)}%`,
      Icon: TrendingUp,
    },
  ];

  return (
    <div className="h-full grid grid-cols-3 gap-2 content-start">
      {cards.map(({ label, value, Icon }) => (
        <div
          key={label}
          className="px-3 py-3 rounded-lg bg-[var(--muted)] cursor-pointer flex flex-col items-center gap-1 hover:bg-[#ebebeb] transition-colors"
        >
          <Icon className="w-4 h-4 text-[var(--muted-foreground)]" />
          <div className="text-sm font-bold text-[var(--foreground)] leading-none">{value}</div>
          <div className="text-[10px] text-[var(--muted-foreground)] text-center">{label}</div>
        </div>
      ))}
    </div>
  );
}
