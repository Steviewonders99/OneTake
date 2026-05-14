"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, ChevronRight, Sparkles, Send, BarChart3, Clock, Copy, Trash2 } from 'lucide-react';
import { DASHBOARD_META, DEFAULT_META, getDashboardMeta } from '@/components/insights/dashboard-meta';
import { toast } from 'sonner';
import type { Dashboard } from '@/components/insights/types';
import type { UserRole } from '@/lib/types';

export function InsightsDashboardList({ dashboards: initial, role }: { dashboards: Dashboard[]; role: UserRole }) {
  const router = useRouter();
  const [dashboards, setDashboards] = useState(initial);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const isAdmin = role === 'admin';

  // Split into pre-built (system) and custom dashboards
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

  const handleAiCompose = async () => {
    if (!aiPrompt.trim() || aiLoading) return;
    setAiLoading(true);
    try {
      const res = await fetch('/api/insights/ai/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt.trim() }),
      });
      const d = await res.json();
      if (d.id) {
        router.push(`/insights/${d.id}`);
      } else {
        toast.error(d.error || 'Failed to generate dashboard');
      }
    } catch {
      toast.error('Failed to generate dashboard');
    } finally {
      setAiLoading(false);
    }
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
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-2xl font-semibold text-[#1a1a1a] tracking-tight">Analytics</h1>
        <p className="text-sm text-[#a3a3a3] mt-1">Real-time marketing intelligence across all channels</p>
      </div>

      {/* Featured Pre-built Dashboards */}
      {prebuilt.length > 0 && (
        <div className="mb-12">
          <div className="text-[9px] font-semibold text-[#a3a3a3] uppercase tracking-[0.1em] mb-4">
            Dashboards
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {prebuilt.map(d => {
              const meta = getDashboardMeta(d.title) || DEFAULT_META;
              const Icon = meta.icon;
              const widgetCount = d.layout_data?.widgets?.length ?? 0;

              return (
                <Link
                  key={d.id}
                  href={`/insights/${d.id}`}
                  className="group relative bg-white rounded-xl border border-[#e5e5e5] hover:border-[#d4d4d4] transition-all duration-200 hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 cursor-pointer overflow-hidden"
                >
                  {/* Accent top bar */}
                  <div className="h-1 w-full" style={{ backgroundColor: meta.accent }} />

                  <div className="p-5">
                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: meta.accentBg }}
                      >
                        <Icon className="w-5 h-5" style={{ color: meta.accent }} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-[15px] font-semibold text-[#1a1a1a] truncate">
                            {d.title}
                          </h3>
                          <ChevronRight className="w-4 h-4 text-[#d4d4d4] group-hover:text-[#a3a3a3] group-hover:translate-x-0.5 transition-all shrink-0" />
                        </div>
                        <p className="text-[11px] text-[#737373] mt-1 line-clamp-2 leading-relaxed">
                          {meta.tagline}
                        </p>
                        <div className="flex items-center gap-3 mt-3">
                          <span className="text-[10px] font-medium tabular-nums px-2 py-0.5 rounded-md" style={{ backgroundColor: meta.accentBg, color: meta.accent }}>
                            {widgetCount} widgets
                          </span>
                          <span className="flex items-center gap-1 text-[10px] text-[#a3a3a3]">
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

      {/* AI Composer — compact */}
      <div className="mb-12">
        <div className="text-[9px] font-semibold text-[#a3a3a3] uppercase tracking-[0.1em] mb-4">
          AI Composer
        </div>
        <div className="bg-white rounded-xl border border-[#e5e5e5] p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6] flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <input
                type="text"
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAiCompose()}
                placeholder="Ask anything — &quot;Humus full funnel by channel&quot;, &quot;Reddit vs Meta efficiency&quot;..."
                className="w-full text-sm text-[#1a1a1a] placeholder-[#d4d4d4] outline-none bg-transparent"
                disabled={aiLoading}
              />
            </div>
            <button
              onClick={handleAiCompose}
              disabled={!aiPrompt.trim() || aiLoading}
              className="w-8 h-8 rounded-lg bg-[#1a1a1a] hover:bg-[#333] disabled:bg-[#e5e5e5] flex items-center justify-center transition-colors cursor-pointer disabled:cursor-not-allowed shrink-0"
            >
              {aiLoading ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5 text-white" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Custom Dashboards */}
      {(custom.length > 0 || isAdmin) && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="text-[9px] font-semibold text-[#a3a3a3] uppercase tracking-[0.1em]">
              Custom Dashboards
            </div>
            {isAdmin && (
              <button onClick={handleCreate} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-[#525252] bg-[#f5f5f5] hover:bg-[#ebebeb] cursor-pointer transition-colors">
                <Plus className="w-3.5 h-3.5" /> New Dashboard
              </button>
            )}
          </div>
          {custom.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#e5e5e5] p-8 text-center">
              <p className="text-sm text-[#a3a3a3]">No custom dashboards yet — use the AI Composer above or create one manually</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {custom.map(d => {
                const widgetCount = d.layout_data?.widgets?.length ?? 0;
                const diff = Date.now() - new Date(d.updated_at).getTime();
                const mins = Math.floor(diff / 60000);
                const updatedAgo = mins < 1 ? 'Just now' : mins < 60 ? `${mins}m ago` : Math.floor(mins / 60) < 24 ? `${Math.floor(mins / 60)}h ago` : `${Math.floor(mins / 1440)}d ago`;

                return (
                  <div key={d.id} className="group bg-white rounded-xl border border-[#e5e5e5] hover:border-[#d4d4d4] transition-all hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">
                    <Link href={`/insights/${d.id}`} className="block p-5 cursor-pointer">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-[#f5f5f5] flex items-center justify-center shrink-0">
                          <BarChart3 className="w-4 h-4 text-[#a3a3a3]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-[#1a1a1a] truncate">{d.title}</h3>
                          {d.description && <p className="text-[11px] text-[#a3a3a3] mt-1 line-clamp-2">{d.description}</p>}
                          <div className="flex items-center gap-3 mt-2 text-[10px] text-[#a3a3a3]">
                            <span>{widgetCount} widgets</span>
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {updatedAgo}</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                    {isAdmin && (
                      <div className="flex items-center gap-1 px-5 pb-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleDuplicate(d.id)} className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-[#a3a3a3] hover:bg-[#f5f5f5] hover:text-[#525252] transition-colors cursor-pointer"><Copy className="w-3 h-3" /> Duplicate</button>
                        <button onClick={() => handleDelete(d.id)} className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-[#a3a3a3] hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"><Trash2 className="w-3 h-3" /> Delete</button>
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
