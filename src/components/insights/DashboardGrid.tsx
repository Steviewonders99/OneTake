"use client";

import { useCallback } from 'react';
import { ResponsiveGridLayout, useContainerWidth, verticalCompactor } from 'react-grid-layout';
import type { Layout, ResponsiveLayouts } from 'react-grid-layout';
import { LayoutGrid } from 'lucide-react';
import { useDashboard } from './DashboardContext';
import { WidgetRenderer } from './WidgetRenderer';
import 'react-grid-layout/css/styles.css';

export function DashboardGrid() {
  const { state, updateLayouts, selectWidget, removeWidget } = useDashboard();
  const { layoutData, isEditMode, selectedWidgetId } = state;
  const { width, containerRef, mounted } = useContainerWidth({ initialWidth: 1200 });

  const handleLayoutChange = useCallback((_current: Layout, allLayouts: ResponsiveLayouts<'lg' | 'md' | 'sm'>) => {
    if (!isEditMode) return;
    updateLayouts({
      lg: [...(allLayouts.lg || [])],
      md: [...(allLayouts.md || [])],
      sm: [...(allLayouts.sm || [])],
    });
  }, [isEditMode, updateLayouts]);

  if (layoutData.widgets.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-[var(--muted)] flex items-center justify-center mx-auto mb-4">
            {isEditMode ? <span className="text-3xl text-[var(--muted-foreground)]">+</span> : <LayoutGrid className="w-7 h-7 text-[var(--muted-foreground)]" />}
          </div>
          <h3 className="text-sm font-medium text-[var(--foreground)] mb-1">{isEditMode ? 'Start building' : 'No widgets yet'}</h3>
          <p className="text-xs text-[var(--muted-foreground)]">{isEditMode ? 'Add widgets from the palette on the left' : 'Switch to edit mode to add widgets'}</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-auto p-5 bg-[#f7f7f8]">
      {mounted && (
        <ResponsiveGridLayout
          className="layout"
          width={width}
          layouts={{ lg: layoutData.gridLayouts.lg, md: layoutData.gridLayouts.md, sm: layoutData.gridLayouts.sm }}
          breakpoints={{ lg: 1200, md: 768, sm: 480 }}
          cols={{ lg: 12, md: 8, sm: 4 }}
          rowHeight={80}
          margin={[16, 16] as const}
          containerPadding={[0, 0] as const}
          dragConfig={{ enabled: isEditMode, handle: '.drag-handle' }}
          resizeConfig={{ enabled: isEditMode }}
          onLayoutChange={handleLayoutChange}
          compactor={verticalCompactor}
        >
          {layoutData.widgets.map(widget => (
            <div key={widget.id}>
              <WidgetRenderer widget={widget} isEditMode={isEditMode} isSelected={selectedWidgetId === widget.id} onSelect={selectWidget} onRemove={removeWidget} />
            </div>
          ))}
        </ResponsiveGridLayout>
      )}
    </div>
  );
}
