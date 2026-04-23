"use client";

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';

interface GscData {
  connected: boolean;
  queries: { query: string; clicks: number; impressions: number; ctr: number; position: number }[];
  pages: { page: string; clicks: number; impressions: number; ctr: number; position: number }[];
}

export default function GscQueriesWidget({ config }: { config: Record<string, unknown> }) {
  const [data, setData] = useState<GscData | null>(null);

  useEffect(() => {
    fetch('/api/insights/metrics/gsc-queries').then(r => r.json()).then(setData).catch(() => {});
  }, []);

  if (!data) return <div className="h-full skeleton rounded-lg" />;

  if (!data.connected) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 text-center p-4">
        <Search className="w-8 h-8 text-[var(--muted-foreground)]" />
        <p className="text-xs font-semibold text-[var(--foreground)]">GSC Not Connected</p>
        <p className="text-[10px] text-[var(--muted-foreground)]">Configure seo-ai MCP to enable search query data</p>
      </div>
    );
  }

  if (data.queries.length === 0) {
    return <div className="h-full flex items-center justify-center text-xs text-[var(--muted-foreground)]">No search query data yet</div>;
  }

  return (
    <div className="h-full overflow-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[var(--border)]">
            <th className="text-left py-2 px-2 font-semibold text-[var(--muted-foreground)] uppercase tracking-wider text-[10px]">Query</th>
            <th className="text-right py-2 px-2 font-semibold text-[var(--muted-foreground)] uppercase tracking-wider text-[10px]">Clicks</th>
            <th className="text-right py-2 px-2 font-semibold text-[var(--muted-foreground)] uppercase tracking-wider text-[10px]">Impr</th>
            <th className="text-right py-2 px-2 font-semibold text-[var(--muted-foreground)] uppercase tracking-wider text-[10px]">CTR</th>
            <th className="text-right py-2 px-2 font-semibold text-[var(--muted-foreground)] uppercase tracking-wider text-[10px]">Pos</th>
          </tr>
        </thead>
        <tbody>
          {data.queries.map((q, i) => (
            <tr key={i} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--muted)]">
              <td className="py-2 px-2 text-[var(--foreground)] font-medium truncate max-w-[180px]">{q.query}</td>
              <td className="py-2 px-2 text-right text-[var(--foreground)]">{q.clicks}</td>
              <td className="py-2 px-2 text-right text-[var(--muted-foreground)]">{q.impressions}</td>
              <td className="py-2 px-2 text-right text-[var(--foreground)]">{(q.ctr * 100).toFixed(1)}%</td>
              <td className="py-2 px-2 text-right text-[var(--muted-foreground)]">{q.position.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
