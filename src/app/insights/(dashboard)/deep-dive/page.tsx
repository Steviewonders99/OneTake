import { requireRole } from '@/lib/auth';
import { listProjects } from '@/lib/db/projects';
import { isProxyEnabled, proxyListProjects } from '@/lib/db-proxy';
import { DeepDiveClient } from '@/components/insights/deep-dive/DeepDiveClient';
import type { Project } from '@/lib/types/projects';

export const dynamic = 'force-dynamic';

export default async function DeepDivePage() {
  await requireRole(['admin', 'recruiter']);
  const projects = isProxyEnabled()
    ? (await proxyListProjects('active')) as Project[]
    : await listProjects('active');
  return <DeepDiveClient initialProjects={projects} />;
}
