"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { DashboardCard } from '@/components/insights/DashboardCard';
import { AiComposerHero } from '@/components/insights/AiComposerHero';
import { toast } from 'sonner';
import type { Dashboard } from '@/components/insights/types';
import type { UserRole } from '@/lib/types';

export function InsightsDashboardList({ dashboards: initial, role }: { dashboards: Dashboard[]; role: UserRole }) {
  const router = useRouter();
  const [dashboards, setDashboards] = useState(initial);
  const isAdmin = role === 'admin';

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
    <div className="max-w-6xl mx-auto pb-12">
      <AiComposerHero />
      <div className="px-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[9px] font-medium text-[#a3a3a3] uppercase tracking-[0.08em]">
            Your Dashboards
          </div>
          {isAdmin && (
            <button onClick={handleCreate} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-[#525252] bg-[#f5f5f5] hover:bg-[#ebebeb] cursor-pointer transition-colors">
              <Plus className="w-3.5 h-3.5" /> New Dashboard
            </button>
          )}
        </div>
        {dashboards.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-sm text-[#a3a3a3]">No dashboards yet — try asking a question above</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dashboards.map(d => (
              <DashboardCard key={d.id} dashboard={d} onDuplicate={handleDuplicate} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
