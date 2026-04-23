"use client";

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { ScrollText } from 'lucide-react';
import { AXIS_STYLE, GRID_STYLE, TOOLTIP_STYLE } from '../chartTheme';

interface ScrollBand { depth_band: string; sessions_reached: number; pct_of_total: number; }

export default function HieScrollmapWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<{ bands: ScrollBand[] } | null>(null);
  const pageUrl = config.pageUrl as string;

  useEffect(() => {
    if (!pageUrl) return;
    fetch(`/api/hie/scrollmap?page_url=${encodeURIComponent(pageUrl)}`).then(r => r.json()).then(setData).catch(() => {});
  }, [pageUrl]);

  if (!pageUrl) return <div className="h-full flex items-center justify-center text-xs text-[var(--muted-foreground)]">Configure a page URL in widget settings</div>;
  if (!data) return <div className="h-full skeleton rounded-lg" />;
  if (data.bands.length === 0) return (
    <div className="h-full flex flex-col items-center justify-center gap-2 text-center p-4">
      <ScrollText className="w-8 h-8 text-[var(--muted-foreground)]" />
      <p className="text-xs font-semibold text-[var(--foreground)]">No Scroll Data</p>
      <p className="text-[10px] text-[var(--muted-foreground)]">Deploy nova-tracking-hie.js to start collecting scroll data</p>
    </div>
  );

  const getBarColor = (pct: number) => {
    if (pct >= 80) return '#16a34a';
    if (pct >= 50) return '#ca8a04';
    if (pct >= 25) return '#ea580c';
    return '#dc2626';
  };

  return (
    <div className="h-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data.bands} layout="vertical" margin={{ left: 40 }}>
          <CartesianGrid {...GRID_STYLE} />
          <XAxis type="number" domain={[0, 100]} {...AXIS_STYLE} tickFormatter={(v: number) => `${v}%`} />
          <YAxis type="category" dataKey="depth_band" {...AXIS_STYLE} width={38} tick={{ fontSize: 9 }} />
          <Tooltip {...TOOLTIP_STYLE} />
          <Bar dataKey="pct_of_total" radius={[0, 4, 4, 0]} fill="#0693e3" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
