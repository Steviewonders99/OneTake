import { requireRole } from '@/lib/auth';
import { listDashboards } from '@/lib/db/dashboards';
import { InsightsDashboardList } from './InsightsDashboardList';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const FEATURED_DASHBOARDS = [
  {
    href: '/insights/command-center',
    title: 'Project Command Center',
    tagline: 'Full portfolio — paid, organic, email, physical, recruiter. All channels, one view.',
    gradient: 'linear-gradient(135deg, #0348B2 0%, #7C3AED 50%, #DB2777 100%)',
    stats: '53 projects · 14 channels · Real-time',
  },
  {
    href: '/insights/deep-dive',
    title: 'Project Deep Dive',
    tagline: '9-stage funnel from ad click to active worker. Per-project, per-source, per-locale.',
    gradient: 'linear-gradient(135deg, #DB2777 0%, #9333EA 100%)',
    stats: '9 stages · 95% accuracy · Cross-domain',
  },
  {
    href: '/insights/channel-intel',
    title: 'Channel Intelligence',
    tagline: 'Start from the channel. GSC keywords, post audit, creative gallery, recruiter UTM tracking.',
    gradient: 'linear-gradient(135deg, #7C3AED 0%, #2563EB 100%)',
    stats: '18 channels · GSC + GA4 · Per-region',
  },
];

export default async function InsightsPage() {
  const { role } = await requireRole(['admin', 'recruiter']);
  const dashboards = await listDashboards();
  return (
    <div className="px-6 pt-6 pb-10 max-w-[1400px]">
      {/* Single header */}
      <h1 className="text-2xl font-bold text-[#111827] mb-1">Analytics</h1>
      <p className="text-sm text-[#9CA3AF] mb-6">Real-time marketing intelligence across all channels</p>

      {/* Featured Dashboards */}
      <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#9CA3AF] mb-3">Featured</div>
      <div className="grid grid-cols-3 gap-4 mb-8">
        {FEATURED_DASHBOARDS.map(d => (
          <Link key={d.href} href={d.href}
                className="group relative overflow-hidden rounded-2xl p-6 text-white transition-all hover:scale-[1.02] hover:shadow-xl flex flex-col justify-between min-h-[140px]"
                style={{ background: d.gradient, boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
            <div className="absolute -top-1/2 -right-[30%] w-[60%] h-[200%] pointer-events-none"
                 style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 60%)' }} />
            <div className="relative z-10">
              <h3 className="text-[15px] font-bold mb-1.5">{d.title}</h3>
              <p className="text-[11px] opacity-80 leading-relaxed">{d.tagline}</p>
            </div>
            <div className="relative z-10 flex justify-between items-end mt-3">
              <div className="text-[10px] opacity-60 font-medium">{d.stats}</div>
              <div className="text-[10px] font-semibold opacity-0 group-hover:opacity-80 transition-opacity">Open →</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Widget Dashboards — no duplicate header */}
      <InsightsDashboardList dashboards={dashboards} role={role} hideHeader />
    </div>
  );
}
