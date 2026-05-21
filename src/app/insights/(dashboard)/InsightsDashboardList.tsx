"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, ChevronRight, BarChart3, Clock, Copy, Trash2 } from 'lucide-react';
import { DASHBOARD_META, DEFAULT_META, getDashboardMeta } from '@/components/insights/dashboard-meta';
import { toast } from 'sonner';
import type { Dashboard } from '@/components/insights/types';
import type { UserRole } from '@/lib/types';

export function InsightsDashboardList({ dashboards: initial, role, hideHeader }: { dashboards: Dashboard[]; role: UserRole; hideHeader?: boolean }) {
  const router = useRouter();
  const [dashboards, setDashboards] = useState(initial);
  const isAdmin = role === 'admin';

  const prebuilt = dashboards
    .filter(d => d.created_by === 'system')
    .sort((a, b) => {
      const metaA = getDashboardMeta(a.title);
      const metaB = getDashboardMeta(b.title);
      return (metaA?.order ?? 99) - (metaB?.order ?? 99);
    });
  const custom = dashboards.filter(d => d.created_by !== 'system');

  const handleCreate = async () => {
    try {
      const res = await fetch('/api/insights', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Untitled Dashboard' }) });
      const d = await res.json();
      router.push(`/insights/${d.id}`);
    } catch { toast.error('Failed to create dashboard'); }
  };

  const handleDuplicate = async (id: string) => {
    if (!isAdmin) return;
    try {
      const res = await fetch(`/api/insights/${id}/duplicate`, { method: 'POST' });
      const d = await res.json();
      setDashboards(prev => [d, ...prev]);
      toast.success('Dashboard duplicated');
    } catch { toast.error('Failed to duplicate'); }
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) return;
    if (!confirm('Delete this dashboard?')) return;
    try {
      await fetch(`/api/insights/${id}`, { method: 'DELETE' });
      setDashboards(prev => prev.filter(d => d.id !== id));
      toast.success('Dashboard deleted');
    } catch { toast.error('Failed to delete'); }
  };

  return (
    <div className={hideHeader ? '' : 'max-w-7xl mx-auto px-6 py-8'}>
      {!hideHeader && (
        <div className="mb-10">
          <h1 className="text-2xl font-semibold text-[#1a1a1a] tracking-tight">Analytics</h1>
          <p className="text-sm text-[#a3a3a3] mt-1">Real-time marketing intelligence across all channels</p>
        </div>
      )}

      {/* Pre-built Dashboards */}
      {prebuilt.length > 0 && (
        <div className="mb-10">
          <div className="text-[9px] font-semibold text-[#9CA3AF] uppercase tracking-[0.12em] mb-3">
            Dashboards
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {prebuilt.map(d => {
              const meta = getDashboardMeta(d.title) || DEFAULT_META;
              const Icon = meta.icon;
              const widgetCount = d.layout_data?.widgets?.length ?? 0;

              return (
                <Link
                  key={d.id}
                  href={`/insights/${d.id}`}
                  className="group relative bg-white rounded-xl border border-[#E5E7EB] hover:border-[#D1D5DB] transition-all duration-200 hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] hover:-translate-y-0.5 cursor-pointer overflow-hidden"
                >
                  <div className="h-[3px] w-full" style={{ backgroundColor: meta.accent }} />
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: meta.accentBg }}
                      >
                        <Icon className="w-4 h-4" style={{ color: meta.accent }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-[13px] font-semibold text-[#111827] truncate">
                            {d.title}
                          </h3>
                          <ChevronRight className="w-3.5 h-3.5 text-[#D1D5DB] group-hover:text-[#9CA3AF] group-hover:translate-x-0.5 transition-all shrink-0" />
                        </div>
                        <p className="text-[10px] text-[#6B7280] mt-0.5 line-clamp-1 leading-relaxed">
                          {meta.tagline}
                        </p>
                        <div className="flex items-center gap-2.5 mt-2">
                          <span className="text-[9px] font-medium tabular-nums px-1.5 py-0.5 rounded" style={{ backgroundColor: meta.accentBg, color: meta.accent }}>
                            {widgetCount} widgets
                          </span>
                          <span className="flex items-center gap-1 text-[9px] text-[#9CA3AF]">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                            Live
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Custom Dashboards */}
      {(custom.length > 0 || isAdmin) && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="text-[9px] font-semibold text-[#9CA3AF] uppercase tracking-[0.12em]">
              Custom Dashboards
            </div>
            {isAdmin && (
              <button onClick={handleCreate} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-[#4B5563] bg-[#F3F4F6] hover:bg-[#E5E7EB] cursor-pointer transition-colors">
                <Plus className="w-3.5 h-3.5" /> New Dashboard
              </button>
            )}
          </div>
          {custom.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 text-center">
              <p className="text-[12px] text-[#9CA3AF]">No custom dashboards yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {custom.map(d => {
                const widgetCount = d.layout_data?.widgets?.length ?? 0;
                const diff = Date.now() - new Date(d.updated_at).getTime();
                const mins = Math.floor(diff / 60000);
                const updatedAgo = mins < 1 ? 'Just now' : mins < 60 ? `${mins}m ago` : Math.floor(mins / 60) < 24 ? `${Math.floor(mins / 60)}h ago` : `${Math.floor(mins / 1440)}d ago`;

                return (
                  <div key={d.id} className="group bg-white rounded-xl border border-[#E5E7EB] hover:border-[#D1D5DB] transition-all hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">
                    <Link href={`/insights/${d.id}`} className="block p-4 cursor-pointer">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-[#F3F4F6] flex items-center justify-center shrink-0">
                          <BarChart3 className="w-4 h-4 text-[#9CA3AF]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-[13px] font-semibold text-[#111827] truncate">{d.title}</h3>
                          {d.description && <p className="text-[10px] text-[#9CA3AF] mt-0.5 line-clamp-1">{d.description}</p>}
                          <div className="flex items-center gap-2.5 mt-2 text-[9px] text-[#9CA3AF]">
                            <span>{widgetCount} widgets</span>
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {updatedAgo}</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                    {isAdmin && (
                      <div className="flex items-center gap-1 px-4 pb-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleDuplicate(d.id)} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#4B5563] transition-colors cursor-pointer"><Copy className="w-3 h-3" /> Duplicate</button>
                        <button onClick={() => handleDelete(d.id)} className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-[#9CA3AF] hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"><Trash2 className="w-3 h-3" /> Delete</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
