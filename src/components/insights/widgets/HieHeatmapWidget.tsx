"use client";

import { useEffect, useState } from 'react';
import { MousePointerClick } from 'lucide-react';

interface HeatmapCell { grid_x: number; grid_y: number; click_count: number; unique_sessions: number; }

export default function HieHeatmapWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<{ cells: HeatmapCell[]; page_url: string } | null>(null);
  const pageUrl = config.pageUrl as string;

  useEffect(() => {
    if (!pageUrl) return;
    fetch(`/api/hie/heatmap?page_url=${encodeURIComponent(pageUrl)}`).then(r => r.json()).then(setData).catch(() => {});
  }, [pageUrl]);

  if (!pageUrl) return <div className="h-full flex items-center justify-center text-xs text-[var(--muted-foreground)]">Configure a page URL in widget settings</div>;
  if (!data) return <div className="h-full skeleton rounded-lg" />;
  if (data.cells.length === 0) return (
    <div className="h-full flex flex-col items-center justify-center gap-2 text-center p-4">
      <MousePointerClick className="w-8 h-8 text-[var(--muted-foreground)]" />
      <p className="text-xs font-semibold text-[var(--foreground)]">No Click Data</p>
      <p className="text-[10px] text-[var(--muted-foreground)]">Deploy nova-tracking-hie.js on your landing pages via GTM</p>
    </div>
  );

  const maxClicks = Math.max(...data.cells.map(c => c.click_count), 1);
  const gridSize = 50;

  return (
    <div className="h-full overflow-auto">
      <div className="text-[10px] font-semibold text-[var(--muted-foreground)] mb-2 truncate">{data.page_url}</div>
      <div className="relative" style={{ width: gridSize * 6, height: gridSize * 8 }}>
        {data.cells.map((cell, i) => {
          const opacity = 0.1 + (cell.click_count / maxClicks) * 0.9;
          return (
            <div
              key={i}
              className="absolute rounded-sm"
              style={{
                left: (cell.grid_x / gridSize) * 100 + '%',
                top: (cell.grid_y / gridSize) * 100 + '%',
                width: (1 / gridSize) * 100 + '%',
                height: (1 / gridSize) * 100 + '%',
                background: `rgba(220, 38, 38, ${opacity})`,
              }}
              title={`${cell.click_count} clicks, ${cell.unique_sessions} sessions`}
            />
          );
        })}
      </div>
      <div className="flex items-center gap-2 mt-2 text-[10px] text-[var(--muted-foreground)]">
        <span>Low</span>
        <div className="flex-1 h-2 rounded-full" style={{ background: 'linear-gradient(to right, rgba(220,38,38,0.1), rgba(220,38,38,1))' }} />
        <span>High</span>
      </div>
    </div>
  );
}
