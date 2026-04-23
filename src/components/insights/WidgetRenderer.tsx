"use client";

import { Suspense, Component, type ReactNode } from 'react';
import { GripVertical, Settings2, X } from 'lucide-react';
import { WIDGET_REGISTRY } from './widgetRegistry';
import type { WidgetInstance } from './types';

class WidgetErrorBoundary extends Component<{ children: ReactNode; widgetType: string }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full text-sm text-red-500 p-4">
          <div className="text-center">
            <div className="font-medium">Widget error</div>
            <div className="text-xs text-[var(--muted-foreground)] mt-1">{this.props.widgetType}</div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function WidgetSkeleton() {
  return <div className="h-full w-full"><div className="h-full rounded-lg skeleton" /></div>;
}

interface WidgetRendererProps {
  widget: WidgetInstance;
  isEditMode?: boolean;
  isSelected?: boolean;
  onSelect?: (widgetId: string | null) => void;
  onRemove?: (widgetId: string) => void;
}

export function WidgetRenderer({ widget, isEditMode = false, isSelected = false, onSelect, onRemove }: WidgetRendererProps) {
  const entry = WIDGET_REGISTRY[widget.type];
  if (!entry) {
    return <div className="flex items-center justify-center h-full text-[var(--muted-foreground)] text-sm">Unknown widget: {widget.type}</div>;
  }

  const WidgetComponent = entry.component;

  return (
    <div
      className={`group h-full flex flex-col rounded-xl border transition-all duration-200 overflow-hidden bg-white ${
        isSelected ? 'border-[var(--ring)] shadow-[0_0_0_2px_rgba(6,147,227,0.15)]' : 'border-[var(--border)] hover:border-[#d4d4d4]'
      }`}
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)] shrink-0 bg-[var(--muted)]">
        {isEditMode && (
          <div className="drag-handle cursor-grab active:cursor-grabbing text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
            <GripVertical className="w-4 h-4" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-xs font-semibold text-[var(--foreground)] truncate">{widget.title}</h3>
        </div>
        {isEditMode && (
          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={(e) => { e.stopPropagation(); onSelect?.(isSelected ? null : widget.id); }} className="p-1 rounded hover:bg-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors cursor-pointer" title="Configure">
              <Settings2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onRemove?.(widget.id); }} className="p-1 rounded hover:bg-red-50 text-[var(--muted-foreground)] hover:text-red-600 transition-colors cursor-pointer" title="Remove">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
      <div className="flex-1 p-3 overflow-auto">
        <WidgetErrorBoundary widgetType={widget.type}>
          <Suspense fallback={<WidgetSkeleton />}>
            <WidgetComponent config={widget.config} />
          </Suspense>
        </WidgetErrorBoundary>
      </div>
    </div>
  );
}
