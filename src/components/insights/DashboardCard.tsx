"use client";

import Link from 'next/link';
import { BarChart3, Clock, Copy, Trash2, Share2 } from 'lucide-react';
import type { Dashboard } from './types';

interface DashboardCardProps { dashboard: Dashboard; onDuplicate: (id: string) => void; onDelete: (id: string) => void; }

export function DashboardCard({ dashboard, onDuplicate, onDelete }: DashboardCardProps) {
  const widgetCount = dashboard.layout_data?.widgets?.length ?? 0;
  const diff = Date.now() - new Date(dashboard.updated_at).getTime();
  const mins = Math.floor(diff / 60000);
  const updatedAgo = mins < 1 ? 'Just now' : mins < 60 ? `${mins}m ago` : Math.floor(mins / 60) < 24 ? `${Math.floor(mins / 60)}h ago` : `${Math.floor(mins / 1440)}d ago`;

  return (
    <div className="card p-5 group">
      <Link href={`/insights/${dashboard.id}`} className="block cursor-pointer">
        <div className="flex items-start justify-between mb-3">
          <div className="h-10 w-10 rounded-xl bg-[var(--muted)] flex items-center justify-center"><BarChart3 className="w-5 h-5 text-[var(--muted-foreground)]" /></div>
          {dashboard.is_shared && <span className="badge badge-sent"><Share2 className="w-3 h-3" /> Shared</span>}
        </div>
        <h3 className="text-sm font-semibold text-[var(--foreground)] mb-1 truncate">{dashboard.title}</h3>
        {dashboard.description?.toLowerCase().includes('ai') ? (
          <span className="inline-flex text-[9px] font-medium px-2 py-0.5 rounded bg-[#f0f9ff] text-[#3b82f6] mt-1">
            AI Generated
          </span>
        ) : dashboard.created_by === 'system' ? (
          <span className="inline-flex text-[9px] font-medium px-2 py-0.5 rounded bg-[#f5f5f5] text-[#a3a3a3] mt-1">
            Pre-built
          </span>
        ) : null}
        {dashboard.description && <p className="text-xs text-[var(--muted-foreground)] mb-3 line-clamp-2">{dashboard.description}</p>}
        <div className="flex items-center gap-3 text-[10px] text-[var(--muted-foreground)]">
          <span>{widgetCount} widget{widgetCount !== 1 ? 's' : ''}</span>
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {updatedAgo}</span>
        </div>
      </Link>
      <div className="flex items-center gap-1 mt-3 pt-3 border-t border-[var(--border)] opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={(e) => { e.preventDefault(); onDuplicate(dashboard.id); }} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors cursor-pointer"><Copy className="w-3 h-3" /> Duplicate</button>
        <button onClick={(e) => { e.preventDefault(); onDelete(dashboard.id); }} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] text-[var(--muted-foreground)] hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"><Trash2 className="w-3 h-3" /> Delete</button>
      </div>
    </div>
  );
}
