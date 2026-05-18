import {
  LayoutDashboard, Users, Megaphone, GitBranch, Palette, TrendingUp, Target,
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
 */
export const DASHBOARD_META: Record<string, DashboardMeta> = {
  'Project Command Center': {
    icon: Target,
    accent: '#7C3AED',
    accentBg: '#F5F3FF',
    tagline: 'Full portfolio — paid, organic, email, physical, recruiter. All channels, one view.',
    order: 0,
  },
  'Executive Overview': {
    icon: LayoutDashboard,
    accent: '#3b82f6',
    accentBg: '#eff6ff',
    tagline: 'Performance at a glance — paid, organic, funnel, top content',
    order: 1,
  },
  'Organic Social': {
    icon: Users,
    accent: '#22c55e',
    accentBg: '#f0fdf4',
    tagline: 'Platform engagement, follower growth, pipeline attribution',
    order: 2,
  },
  'Paid Media': {
    icon: Megaphone,
    accent: '#8b5cf6',
    accentBg: '#f5f3ff',
    tagline: 'Ad spend distribution, campaign ROI, creative performance',
    order: 3,
  },
  'Recruitment Pipeline': {
    icon: GitBranch,
    accent: '#f59e0b',
    accentBg: '#fffbeb',
    tagline: 'Pipeline status, urgency, timeline, creative output',
    order: 4,
  },
  'Creative Intelligence': {
    icon: Palette,
    accent: '#ec4899',
    accentBg: '#fdf2f8',
    tagline: 'Which creatives drive results across Meta, Reddit, TikTok',
    order: 5,
  },
  'Recruitment ROI': {
    icon: TrendingUp,
    accent: '#14b8a6',
    accentBg: '#f0fdfa',
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
  accent: '#a3a3a3',
  accentBg: '#f5f5f5',
  tagline: '',
  order: 99,
};
