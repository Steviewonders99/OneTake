"use client";

import { useState } from 'react';
import { Search, Plus, Check } from 'lucide-react';
import { WIDGET_REGISTRY, WIDGET_CATEGORIES } from './widgetRegistry';
import { useDashboard } from './DashboardContext';
import type { WidgetType } from './types';

export function WidgetPalette() {
  const { addWidget, state } = useDashboard();
  const [search, setSearch] = useState('');

  const addedTypes = new Set(state.layoutData.widgets.map(w => w.type));
  const filteredEntries = Object.entries(WIDGET_REGISTRY).filter(([, entry]) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return entry.label.toLowerCase().includes(q) || entry.description.toLowerCase().includes(q) || entry.category.toLowerCase().includes(q);
  });

  return (
    <div className="w-[220px] shrink-0 flex flex-col h-full border-r border-[var(--border)] bg-white">
      <div className="p-3 border-b border-[var(--border)]">
        <h2 className="text-sm font-semibold text-[var(--foreground)] mb-2">Widgets</h2>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--muted-foreground)]" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search widgets..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-[var(--muted)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none focus:border-[var(--ring)] transition-colors" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {WIDGET_CATEGORIES.map(category => {
          const entries = filteredEntries.filter(([, e]) => e.category === category.id);
          if (entries.length === 0) return null;
          return (
            <div key={category.id}>
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">{category.label}</div>
              <div className="space-y-0.5 mt-1">
                {entries.map(([type, entry]) => {
                  const Icon = entry.icon;
                  const isAdded = addedTypes.has(type as WidgetType);
                  return (
                    <button key={type} onClick={() => addWidget(type as WidgetType)}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-[var(--muted)] transition-colors group cursor-pointer">
                      <div className="h-8 w-8 rounded-lg bg-[var(--muted)] flex items-center justify-center shrink-0 group-hover:bg-[var(--border)] transition-colors">
                        <Icon className="w-4 h-4 text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-[var(--foreground)] truncate flex items-center gap-1.5">
                          {entry.label}
                          {isAdded && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] bg-green-50 text-green-600"><Check className="w-2.5 h-2.5" /></span>}
                        </div>
                        <div className="text-[10px] text-[var(--muted-foreground)] truncate">{entry.description}</div>
                      </div>
                      <Plus className="w-3.5 h-3.5 text-[var(--muted-foreground)] group-hover:text-[var(--foreground)] shrink-0 transition-colors" />
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
