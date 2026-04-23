import { requireRole } from '@/lib/auth';
import { getDashboard } from '@/lib/db/dashboards';
import { notFound } from 'next/navigation';
import { BuilderClient } from './BuilderClient';
import type { DashboardLayoutData } from '@/components/insights/types';

export const dynamic = 'force-dynamic';

export default async function InsightsBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { role } = await requireRole(['admin', 'recruiter']);
  const { id } = await params;
  const dashboard = await getDashboard(id);
  if (!dashboard) notFound();

  const layoutData: DashboardLayoutData = (dashboard.layout_data as DashboardLayoutData) || {
    widgets: [],
    gridLayouts: { lg: [], md: [], sm: [] },
  };

  return (
    <BuilderClient
      dashboardId={id}
      initialTitle={dashboard.title}
      initialDescription={dashboard.description || ''}
      initialLayoutData={layoutData}
      canEdit={role === 'admin'}
    />
  );
}
