import { requireRole } from '@/lib/auth';
import { listProjects } from '@/lib/db/projects';
import { isProxyEnabled, proxyListProjects } from '@/lib/db-proxy';
import { ChannelIntelClient } from '@/components/insights/channel-intel/ChannelIntelClient';
import type { Project } from '@/lib/types/projects';

export const dynamic = 'force-dynamic';

export default async function ChannelIntelPage() {
  await requireRole(['admin', 'recruiter']);
  const projects = isProxyEnabled()
    ? (await proxyListProjects('active')) as Project[]
    : await listProjects('active');
  return <ChannelIntelClient initialProjects={projects} />;
}
