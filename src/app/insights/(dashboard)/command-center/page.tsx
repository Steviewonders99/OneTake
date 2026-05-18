import { requireRole } from '@/lib/auth';
import { listProjects } from '@/lib/db/projects';
import { isProxyEnabled, proxyListProjects } from '@/lib/db-proxy';
import { CommandCenterClient } from '@/components/insights/command-center/CommandCenterClient';
import type { Project } from '@/lib/types/projects';

export const dynamic = 'force-dynamic';

export default async function CommandCenterPage() {
  await requireRole(['admin', 'recruiter']);
  const projects = isProxyEnabled()
    ? (await proxyListProjects('active')) as Project[]
    : await listProjects('active');
  return <CommandCenterClient initialProjects={projects} />;
}
