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
        <div className="flex items-center justify-center h-full p-6">
          <div className="text-center">
            <div className="text-xs font-medium text-red-400">Widget error</div>
            <div className="text-[10px] text-[#a3a3a3] mt-1">{this.props.widgetType}</div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function WidgetSkeleton() {
  return (
    <div className="h-full w-full animate-pulse">
      <div className="h-full rounded bg-[#f5f5f5]" />
    </div>
  );
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
    return <div className="flex items-center justify-center h-full text-[#a3a3a3] text-xs">Unknown: {widget.type}</div>;
  }

  const WidgetComponent = entry.component;

  return (
    <div
      className={`group h-full flex flex-col overflow-hidden transition-all duration-200 ${
        isSelected
          ? 'rounded-xl ring-1 ring-[#3b82f6]/30 bg-white'
          : 'rounded-xl bg-white border border-[#f0f0f0] hover:border-[#e0e0e0]'
      }`}
    >
      {/* Header — minimal, no background color. Title + controls only. */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-1 shrink-0">
        {isEditMode && (
          <div className="drag-handle cursor-grab active:cursor-grabbing text-[#d4d4d4] hover:text-[#a3a3a3] transition-colors">
            <GripVertical className="w-3.5 h-3.5" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-[10px] font-medium uppercase tracking-[0.08em] text-[#a3a3a3] truncate">
            {widget.title}
          </h3>
        </div>
        {isEditMode && (
          <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={(e) => { e.stopPropagation(); onSelect?.(isSelected ? null : widget.id); }} className="p-1 rounded hover:bg-[#f5f5f5] text-[#d4d4d4] hover:text-[#737373] transition-colors cursor-pointer" title="Configure">
              <Settings2 className="w-3 h-3" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onRemove?.(widget.id); }} className="p-1 rounded hover:bg-red-50 text-[#d4d4d4] hover:text-red-400 transition-colors cursor-pointer" title="Remove">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Content — generous padding, clean space */}
      <div className="flex-1 px-4 pb-4 pt-1 overflow-auto">
        <WidgetErrorBoundary widgetType={widget.type}>
          <Suspense fallback={<WidgetSkeleton />}>
            <WidgetComponent config={widget.config} />
          </Suspense>
        </WidgetErrorBoundary>
      </div>
    </div>
  );
}
