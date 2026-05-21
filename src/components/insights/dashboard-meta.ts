import {
  LayoutDashboard, Users, Megaphone, GitBranch, Palette, TrendingUp, Target, Zap, Radio,
  type LucideIcon,
} from 'lucide-react';

export interface DashboardMeta {
  icon: LucideIcon;
  accent: string;
  accentBg: string;
  tagline: string;
  order: number;
}

/**
 * Visual identity for each pre-built dashboard.
 * Keyed by dashboard title — must match seed-dashboards.ts titles exactly.
 * Uses a cohesive purple/blue/pink palette matching the BRAND system.
 */
export const DASHBOARD_META: Record<string, DashboardMeta> = {
  'Project Command Center': {
    icon: Target,
    accent: '#7C3AED',
    accentBg: '#F5F3FF',
    tagline: 'Full portfolio — paid, organic, email, physical, recruiter. All channels, one view.',
    order: 0,
  },
  'Project Deep Dive': {
    icon: Zap,
    accent: '#DB2777',
    accentBg: '#FDF2F8',
    tagline: '9-stage funnel from ad click to active worker. Per-project, per-source, per-locale.',
    order: 0.5,
  },
  'Channel Intelligence': {
    icon: Radio,
    accent: '#2563EB',
    accentBg: '#EFF6FF',
    tagline: 'Start from the channel. Post audit, campaign drill-down, creative gallery, recruiter UTM.',
    order: 0.7,
  },
  'Executive Overview': {
    icon: LayoutDashboard,
    accent: '#4F46E5',
    accentBg: '#EEF2FF',
    tagline: 'Performance at a glance — paid, organic, funnel, top content',
    order: 1,
  },
  'Organic Social': {
    icon: Users,
    accent: '#7C3AED',
    accentBg: '#F5F3FF',
    tagline: 'Platform engagement, follower growth, pipeline attribution',
    order: 2,
  },
  'Paid Media': {
    icon: Megaphone,
    accent: '#2563EB',
    accentBg: '#EFF6FF',
    tagline: 'Ad spend distribution, campaign ROI, creative performance',
    order: 3,
  },
  'Recruitment Pipeline': {
    icon: GitBranch,
    accent: '#DB2777',
    accentBg: '#FDF2F8',
    tagline: 'Pipeline status, urgency, timeline, creative output',
    order: 4,
  },
  'Creative Intelligence': {
    icon: Palette,
    accent: '#9333EA',
    accentBg: '#FAF5FF',
    tagline: 'Which creatives drive results across Meta, Reddit, TikTok',
    order: 5,
  },
  'Recruitment ROI': {
    icon: TrendingUp,
    accent: '#0348B2',
    accentBg: '#EFF6FF',
    tagline: 'Prove marketing dollars drive results at scale',
    order: 6,
  },
};

export function getDashboardMeta(title: string): DashboardMeta | null {
  return DASHBOARD_META[title] ?? null;
}

/** Default fallback for custom dashboards */
export const DEFAULT_META: DashboardMeta = {
  icon: LayoutDashboard,
  accent: '#6B7280',
  accentBg: '#F3F4F6',
  tagline: '',
  order: 99,
};
