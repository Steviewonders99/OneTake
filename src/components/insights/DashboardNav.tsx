"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DASHBOARD_META, getDashboardMeta, DEFAULT_META } from './dashboard-meta';

interface NavDashboard {
  id: string;
  title: string;
  created_by: string;
}

export function DashboardNav({ currentId }: { currentId: string }) {
  const router = useRouter();
  const [dashboards, setDashboards] = useState<NavDashboard[]>([]);

  useEffect(() => {
    fetch('/api/insights')
      .then(r => r.json())
      .then((all: NavDashboard[]) => {
        // Only show pre-built (system) dashboards in the nav
        const prebuilt = all
          .filter((d: NavDashboard) => d.created_by === 'system')
          .sort((a: NavDashboard, b: NavDashboard) => {
            const metaA = getDashboardMeta(a.title);
            const metaB = getDashboardMeta(b.title);
            return (metaA?.order ?? 99) - (metaB?.order ?? 99);
          });
        setDashboards(prebuilt);
      })
      .catch(() => {});
  }, []);

  if (dashboards.length === 0) return null;

  return (
    <div className="flex items-center gap-1 px-4 py-1.5 border-b border-[#f0f0f0] bg-white overflow-x-auto">
      {dashboards.map(d => {
        const meta = getDashboardMeta(d.title) || DEFAULT_META;
        const Icon = meta.icon;
        const isActive = d.id === currentId;

        return (
          <button
            key={d.id}
            onClick={() => { if (!isActive) router.push(`/insights/${d.id}`); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium whitespace-nowrap transition-all cursor-pointer ${
              isActive
                ? 'text-white'
                : 'text-[#737373] hover:text-[#525252] hover:bg-[#f5f5f5]'
            }`}
            style={isActive ? { backgroundColor: meta.accent } : undefined}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{d.title}</span>
          </button>
        );
      })}
    </div>
  );
}
