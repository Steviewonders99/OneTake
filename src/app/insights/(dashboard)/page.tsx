import { requireRole } from '@/lib/auth';
import { listDashboards } from '@/lib/db/dashboards';
import { InsightsDashboardList } from './InsightsDashboardList';

export const dynamic = 'force-dynamic';

export default async function InsightsPage() {
  const { role } = await requireRole(['admin', 'recruiter']);
  const dashboards = await listDashboards();
  return <InsightsDashboardList dashboards={dashboards} role={role} />;
}
