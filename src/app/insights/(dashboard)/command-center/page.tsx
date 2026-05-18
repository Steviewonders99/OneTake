import { requireRole } from '@/lib/auth';
import { listProjects } from '@/lib/db/projects';
import { CommandCenterClient } from '@/components/insights/command-center/CommandCenterClient';

export const dynamic = 'force-dynamic';

export default async function CommandCenterPage() {
  await requireRole(['admin', 'recruiter']);
  const projects = await listProjects('active');
  return <CommandCenterClient initialProjects={projects} />;
}
