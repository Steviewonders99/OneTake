"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, BarChart3 } from 'lucide-react';
import { DashboardCard } from '@/components/insights/DashboardCard';
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
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)]">Insights</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">Build custom analytics dashboards for your recruitment pipeline</p>
        </div>
        {isAdmin && (
          <button onClick={handleCreate} className="btn-primary cursor-pointer">
            <Plus className="w-4 h-4" /> New Dashboard
          </button>
        )}
      </div>

      {dashboards.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--muted)] flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="w-7 h-7 text-[var(--muted-foreground)]" />
          </div>
          <h3 className="text-sm font-semibold text-[var(--foreground)] mb-1">No dashboards yet</h3>
          <p className="text-xs text-[var(--muted-foreground)] mb-4">
            {isAdmin ? 'Create your first custom dashboard to track pipeline metrics' : 'No dashboards have been shared with you yet'}
          </p>
          {isAdmin && (
            <button onClick={handleCreate} className="btn-primary cursor-pointer">
              <Plus className="w-4 h-4" /> Create Dashboard
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dashboards.map(d => (
            <DashboardCard key={d.id} dashboard={d} onDuplicate={handleDuplicate} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
