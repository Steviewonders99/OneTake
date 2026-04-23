"use client";

import { X, Trash2 } from 'lucide-react';
import { useDashboard } from './DashboardContext';
import { WIDGET_REGISTRY } from './widgetRegistry';

export function WidgetConfigPanel() {
  const { state, selectWidget, updateWidget, removeWidget } = useDashboard();
  const widget = state.layoutData.widgets.find(w => w.id === state.selectedWidgetId);
  if (!widget) return null;
  const entry = WIDGET_REGISTRY[widget.type];
  if (!entry) return null;
  const Icon = entry.icon;

  const handleTitleChange = (title: string) => updateWidget(widget.id, { title });
  const handleConfigChange = (key: string, value: unknown) => updateWidget(widget.id, { config: { ...widget.config, [key]: value } });
  const handleRemove = () => { removeWidget(widget.id); selectWidget(null); };

  const isUtmWidget = ['click-analytics', 'utm-funnel', 'recruiter-leaderboard', 'campaign-roi', 'source-heatmap', 'creative-performance'].includes(widget.type);

  return (
    <div className="w-72 shrink-0 flex flex-col h-full border-l border-[var(--border)] bg-white">
      <div className="flex items-center gap-2 p-3 border-b border-[var(--border)]">
        <div className="h-8 w-8 rounded-lg bg-[var(--muted)] flex items-center justify-center">
          <Icon className="w-4 h-4 text-[var(--muted-foreground)]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-[var(--foreground)] truncate">{entry.label}</div>
          <div className="text-[10px] text-[var(--muted-foreground)]">{entry.category}</div>
        </div>
        <button onClick={() => selectWidget(null)} className="p-1 rounded hover:bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-1.5">Title</label>
          <input type="text" value={widget.title} onChange={(e) => handleTitleChange(e.target.value)} className="input-base text-xs !py-1.5" />
        </div>
        {widget.type !== 'text-note' && widget.type !== 'link-builder' && (
          <>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-1.5">Date Range</label>
              <div className="space-y-2">
                <input type="date" value={(widget.config.startDate as string) || ''} onChange={(e) => handleConfigChange('startDate', e.target.value)} className="input-base text-xs !py-1.5" />
                <input type="date" value={(widget.config.endDate as string) || ''} onChange={(e) => handleConfigChange('endDate', e.target.value)} className="input-base text-xs !py-1.5" />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-1.5">Status Filter</label>
              <select value={(widget.config.statusFilter as string) || ''} onChange={(e) => handleConfigChange('statusFilter', e.target.value || undefined)} className="input-base text-xs !py-1.5">
                <option value="">All statuses</option>
                <option value="draft">Draft</option>
                <option value="generating">Generating</option>
                <option value="review">Review</option>
                <option value="approved">Approved</option>
                <option value="sent">Sent</option>
              </select>
            </div>
          </>
        )}
        {isUtmWidget && (
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-1.5">Recruiter Scope</label>
            <select value={(widget.config.recruiterScope as string) || ''} onChange={(e) => handleConfigChange('recruiterScope', e.target.value || undefined)} className="input-base text-xs !py-1.5">
              <option value="">All Recruiters</option>
              <option value="self">My Data Only</option>
            </select>
          </div>
        )}
      </div>
      <div className="p-3 border-t border-[var(--border)]">
        <button onClick={handleRemove} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs text-red-600 hover:bg-red-50 transition-colors cursor-pointer">
          <Trash2 className="w-3.5 h-3.5" /> Remove Widget
        </button>
      </div>
    </div>
  );
}
