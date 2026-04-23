"use client";

import { useEffect } from 'react';
import { DashboardProvider, useDashboard } from '@/components/insights/DashboardContext';
import { DashboardToolbar } from '@/components/insights/DashboardToolbar';
import { WidgetPalette } from '@/components/insights/WidgetPalette';
import { DashboardGrid } from '@/components/insights/DashboardGrid';
import { WidgetConfigPanel } from '@/components/insights/WidgetConfigPanel';
import type { DashboardLayoutData } from '@/components/insights/types';

function BuilderInner({ dashboardId, canEdit }: { dashboardId: string; canEdit: boolean }) {
  const { state, toggleEditMode } = useDashboard();

  // If recruiter (canEdit=false), force view mode
  useEffect(() => {
    if (!canEdit && state.isEditMode) {
      toggleEditMode();
    }
  }, [canEdit, state.isEditMode, toggleEditMode]);

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] -mx-6 -mt-6">
      <DashboardToolbar dashboardId={dashboardId} />
      <div className="flex flex-1 overflow-hidden">
        {state.isEditMode && canEdit && <WidgetPalette />}
        <div className="flex-1 bg-[var(--muted)] overflow-hidden flex">
          <DashboardGrid />
        </div>
        {state.isEditMode && canEdit && state.selectedWidgetId && <WidgetConfigPanel />}
      </div>
    </div>
  );
}

interface BuilderClientProps {
  dashboardId: string;
  initialTitle: string;
  initialDescription: string;
  initialLayoutData: DashboardLayoutData;
  canEdit: boolean;
}

export function BuilderClient({
  dashboardId,
  initialTitle,
  initialDescription,
  initialLayoutData,
  canEdit,
}: BuilderClientProps) {
  return (
    <DashboardProvider
      dashboardId={dashboardId}
      initialTitle={initialTitle}
      initialDescription={initialDescription}
      initialLayoutData={initialLayoutData}
    >
      <BuilderInner dashboardId={dashboardId} canEdit={canEdit} />
    </DashboardProvider>
  );
}
